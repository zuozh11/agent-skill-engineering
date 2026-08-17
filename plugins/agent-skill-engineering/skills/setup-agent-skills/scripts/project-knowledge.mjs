#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fs.realpathSync(fileURLToPath(import.meta.url));
const AGENTS_DIR = path.dirname(SCRIPT_PATH);
const ROOT = path.resolve(AGENTS_DIR, "..", "..");
const DOCS_DIR = path.join(ROOT, "docs");
const RULES_DIR = path.join(DOCS_DIR, "rules");
const RULE_FILE_PATTERN = /^([A-Z]+)([0-9]{2})-([^-]+)-(.+)\.md$/;

class KnowledgeError extends Error {
  constructor(messages) {
    super(messages.join("\n"));
    this.messages = messages;
  }
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function relativeToRoot(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function resolveExistingFile(declaredPath, boundary, label, errors) {
  let realPath;
  try {
    if (!fs.statSync(declaredPath).isFile()) {
      errors.push(`${label}：不是普通文件`);
      return null;
    }
    realPath = fs.realpathSync(declaredPath);
  } catch (error) {
    errors.push(`${label}：${error.code === "ENOENT" ? "文件不存在" : error.message}`);
    return null;
  }

  const realBoundary = fs.existsSync(boundary) ? fs.realpathSync(boundary) : path.resolve(boundary);
  if (!isInside(realBoundary, realPath)) {
    errors.push(`${label}：规范路径逃出 ${relativeToRoot(boundary)}`);
    return null;
  }
  return realPath;
}

function splitFrontmatter(raw, fileLabel, errors) {
  const normalized = raw.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    return { body: normalized, lines: null };
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) {
    errors.push(`${fileLabel}：Frontmatter 缺少结束分隔符`);
    return { body: normalized, lines: [] };
  }
  return {
    body: normalized.slice(end + 5),
    lines: normalized.slice(4, end).split("\n"),
  };
}

function parseContextDescription(raw, fileLabel, errors) {
  const { lines } = splitFrontmatter(raw, fileLabel, errors);
  if (!lines) {
    errors.push(`${fileLabel}：缺少 description Frontmatter`);
    return null;
  }
  if (lines.length !== 1 || !lines[0].startsWith("description:")) {
    errors.push(`${fileLabel}：Frontmatter 只接受单行 description`);
    return null;
  }
  const description = lines[0].slice("description:".length).trim();
  if (!description || /^[\[\]{|}>&*!"']/.test(description) || description.includes(" #")) {
    errors.push(`${fileLabel}：description 必须是非空单行普通文本`);
    return null;
  }
  return description;
}

function parseRuleReferences(raw, fileLabel, errors) {
  const { lines } = splitFrontmatter(raw, fileLabel, errors);
  if (!lines) {
    return [];
  }
  if (lines[0] !== "references:" || lines.length < 2) {
    errors.push(`${fileLabel}：RULE Frontmatter 只接受非空 references 列表`);
    return [];
  }

  const references = [];
  for (const line of lines.slice(1)) {
    const match = /^  - ([^/\\]+\.md)$/.exec(line);
    if (!match) {
      errors.push(`${fileLabel}：references 必须使用“  - 完整文件名.md”`);
      continue;
    }
    references.push(match[1]);
  }
  if (new Set(references).size !== references.length) {
    errors.push(`${fileLabel}：references 存在重复项`);
  }
  const sorted = [...references].sort(compareUtf8);
  if (references.some((value, index) => value !== sorted[index])) {
    errors.push(`${fileLabel}：references 必须按完整文件名字节序排列`);
  }
  return references;
}

function detectLayout(errors) {
  const singlePath = path.join(DOCS_DIR, "CONTEXT.md");
  const mapPath = path.join(DOCS_DIR, "CONTEXT-MAP.md");
  const single = fs.existsSync(singlePath);
  const multiple = fs.existsSync(mapPath);
  if (single && multiple) {
    errors.push("docs/CONTEXT.md 与 docs/CONTEXT-MAP.md 不能同时存在");
  }
  if (!single && !multiple) {
    return { adopted: false };
  }
  return multiple
    ? { adopted: true, mode: "multiple", fixedPath: mapPath }
    : { adopted: true, mode: "single", fixedPath: singlePath };
}

function parseContextMap(mapPath, errors) {
  const label = relativeToRoot(mapPath);
  const raw = fs.readFileSync(mapPath, "utf8").replaceAll("\r\n", "\n");
  const lines = raw.split("\n");
  const headings = lines.flatMap((line, index) => (line === "## Contexts" ? [index] : []));
  if (headings.length !== 1) {
    errors.push(`${label}：必须且只能包含一个“## Contexts”`);
    return [];
  }

  const entries = [];
  const texts = new Set();
  const realPaths = new Set();
  for (let index = headings[0] + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) break;
    if (line === "") continue;
    const match = /^- \[([^\]]+)\]\(([^)]+)\)$/.exec(line);
    if (!match) {
      errors.push(`${label}:${index + 1}：Contexts 只接受普通 Markdown 链接列表`);
      continue;
    }
    const [, text, target] = match;
    if (texts.has(text)) errors.push(`${label}:${index + 1}：Context 链接文本重复`);
    texts.add(text);
    if (path.isAbsolute(target) || /^(?:[a-z]+:|#)/i.test(target) || /[?#*]/.test(target) || path.basename(target) !== "CONTEXT.md") {
      errors.push(`${label}:${index + 1}：Context 必须是指向 CONTEXT.md 的相对文件路径`);
      continue;
    }
    const declaredPath = path.resolve(path.dirname(mapPath), target);
    const realPath = resolveExistingFile(declaredPath, ROOT, `${label}:${index + 1}`, errors);
    if (!realPath) continue;
    if (realPaths.has(realPath)) {
      errors.push(`${label}:${index + 1}：Context 规范路径重复`);
      continue;
    }
    realPaths.add(realPath);
    entries.push({ path: relativeToRoot(realPath), realPath });
  }
  return entries;
}

function parseRules(errors) {
  if (!fs.existsSync(RULES_DIR)) return [];
  let files;
  try {
    files = fs.readdirSync(RULES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort(compareUtf8);
  } catch (error) {
    errors.push(`docs/rules：${error.message}`);
    return [];
  }

  const rules = [];
  const encodings = new Set();
  const codeToName = new Map();
  const nameToCode = new Map();
  for (const filename of files) {
    const label = `docs/rules/${filename}`;
    const match = RULE_FILE_PATTERN.exec(filename);
    if (!match) {
      errors.push(`${label}：文件名不符合“场景编码+两位编号-场景名称-规则名称.md”`);
      continue;
    }
    const [, code, number, sceneName] = match;
    const encoding = `${code}${number}`;
    if (encodings.has(encoding)) errors.push(`${label}：完整编码 ${encoding} 重复`);
    encodings.add(encoding);
    if (codeToName.has(code) && codeToName.get(code) !== sceneName) {
      errors.push(`${label}：场景编码 ${code} 对应了多个场景名称`);
    }
    if (nameToCode.has(sceneName) && nameToCode.get(sceneName) !== code) {
      errors.push(`${label}：场景名称 ${sceneName} 对应了多个场景编码`);
    }
    codeToName.set(code, sceneName);
    nameToCode.set(sceneName, code);
    const absolutePath = path.join(RULES_DIR, filename);
    const raw = fs.readFileSync(absolutePath, "utf8");
    rules.push({
      code,
      number: Number(number),
      sceneName,
      filename,
      path: label,
      absolutePath,
      raw,
      references: parseRuleReferences(raw, label, errors),
    });
  }

  const byFilename = new Map(rules.map((rule) => [rule.filename, rule]));
  for (const rule of rules) {
    for (const reference of rule.references) {
      if (!byFilename.has(reference)) {
        errors.push(`${rule.path}：references 目标不存在：${reference}`);
      }
    }
  }
  return rules;
}

function findCycles(rules) {
  const byFilename = new Map(rules.map((rule) => [rule.filename, rule]));
  const state = new Map();
  const stack = [];
  const cycles = new Set();

  function visit(filename) {
    if (state.get(filename) === 2) return;
    if (state.get(filename) === 1) {
      const start = stack.indexOf(filename);
      cycles.add([...stack.slice(start), filename].join(" -> "));
      return;
    }
    state.set(filename, 1);
    stack.push(filename);
    const rule = byFilename.get(filename);
    for (const reference of rule?.references ?? []) {
      if (byFilename.has(reference)) visit(reference);
    }
    stack.pop();
    state.set(filename, 2);
  }

  for (const rule of rules) visit(rule.filename);
  return [...cycles].sort(compareUtf8);
}

function buildKnowledge() {
  const contextErrors = [];
  const ruleErrors = [];
  const layout = detectLayout(contextErrors);
  if (!layout.adopted) {
    return { adopted: false, contextErrors, ruleErrors, rules: [], cycles: [] };
  }

  const fixedRealPath = resolveExistingFile(layout.fixedPath, ROOT, relativeToRoot(layout.fixedPath), contextErrors);
  let contexts = [];
  if (layout.mode === "single" && fixedRealPath) {
    parseContextDescription(fs.readFileSync(fixedRealPath, "utf8"), "docs/CONTEXT.md", contextErrors);
  }
  if (layout.mode === "multiple" && fixedRealPath) {
    contexts = parseContextMap(fixedRealPath, contextErrors).map((context) => ({
      ...context,
      description: parseContextDescription(fs.readFileSync(context.realPath, "utf8"), context.path, contextErrors),
    }));
  }

  const rules = parseRules(ruleErrors);
  return {
    adopted: true,
    mode: layout.mode,
    fixedPath: fixedRealPath,
    contexts,
    rules,
    cycles: findCycles(rules),
    contextErrors,
    ruleErrors,
  };
}

function assertValid(knowledge) {
  const errors = [...knowledge.contextErrors, ...knowledge.ruleErrors];
  if (errors.length) throw new KnowledgeError(errors);
}

function createScope(knowledge) {
  const scenes = new Map();
  for (const rule of knowledge.rules) {
    if (!scenes.has(rule.code)) scenes.set(rule.code, { code: rule.code, name: rule.sceneName, rules: [] });
    scenes.get(rule.code).rules.push(rule);
  }
  const ruleSceneOptions = [...scenes.values()]
    .sort((left, right) => compareUtf8(left.code, right.code))
    .map((scene) => ({
      code: scene.code,
      name: scene.name,
      paths: scene.rules
        .sort((left, right) => left.number - right.number || compareUtf8(left.filename, right.filename))
        .map((rule) => rule.path),
    }));

  if (knowledge.mode === "single") {
    return { context_mode: "single", rule_scene_options: ruleSceneOptions };
  }
  return {
    context_mode: "multiple",
    context_options: knowledge.contexts.map((context) => ({ path: context.path, description: context.description })),
    rule_scene_options: ruleSceneOptions,
  };
}

function parseLoadArguments(args) {
  const contexts = [];
  const rules = [];
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option !== "--context" && option !== "--rule") {
      throw new KnowledgeError([`load：未知参数 ${option}`]);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new KnowledgeError([`load：${option} 缺少值`]);
    }
    (option === "--context" ? contexts : rules).push(value);
    index += 1;
  }
  return { contexts: [...new Set(contexts)], rules: [...new Set(rules)] };
}

function renderLoad(knowledge, args) {
  const selection = parseLoadArguments(args);
  const contextByPath = new Map(knowledge.contexts.map((context) => [context.path, context]));
  const sceneCodes = new Set(knowledge.rules.map((rule) => rule.code));
  const errors = [];

  if (knowledge.mode === "single" && selection.contexts.length) {
    errors.push("load：单 Context 项目不能传入 --context");
  }
  if (knowledge.mode === "multiple" && !selection.contexts.length) {
    errors.push("load：多 Context 项目至少选择一个 --context");
  }
  for (const contextPath of selection.contexts) {
    if (!contextByPath.has(contextPath)) errors.push(`load：未知 Context ${contextPath}`);
  }
  for (const code of selection.rules) {
    if (!sceneCodes.has(code)) errors.push(`load：未知 RULE 场景 ${code}`);
  }
  if (errors.length) throw new KnowledgeError(errors);

  const selectedRules = new Set(knowledge.rules.filter((rule) => selection.rules.includes(rule.code)).map((rule) => rule.filename));
  const byFilename = new Map(knowledge.rules.map((rule) => [rule.filename, rule]));
  const pending = [...selectedRules];
  while (pending.length) {
    const filename = pending.pop();
    for (const reference of byFilename.get(filename).references) {
      if (!selectedRules.has(reference)) {
        selectedRules.add(reference);
        pending.push(reference);
      }
    }
  }

  const documents = [{ path: relativeToRoot(knowledge.fixedPath), absolutePath: knowledge.fixedPath }];
  if (knowledge.mode === "multiple") {
    for (const context of knowledge.contexts) {
      if (selection.contexts.includes(context.path)) documents.push({ path: context.path, absolutePath: context.realPath });
    }
  }
  for (const rule of knowledge.rules.filter((candidate) => selectedRules.has(candidate.filename)).sort((a, b) => compareUtf8(a.path, b.path))) {
    documents.push({ path: rule.path, absolutePath: rule.absolutePath });
  }

  return documents.map((document) => {
    const raw = fs.readFileSync(document.absolutePath, "utf8");
    return `===== ${document.path} =====\n${raw.replace(/[\r\n]+$/u, "")}`;
  }).join("\n\n") + "\n";
}

function printWarnings(cycles) {
  for (const cycle of cycles) process.stderr.write(`warning: RULE 引用环：${cycle}\n`);
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new KnowledgeError(["缺少子命令：validate-context、validate-rules、scope 或 load"]);
  const knowledge = buildKnowledge();

  if (command === "validate-context") {
    if (knowledge.contextErrors.length) throw new KnowledgeError(knowledge.contextErrors);
    process.stdout.write(knowledge.adopted ? `Context 校验通过（${knowledge.mode === "single" ? "单 Context" : `${knowledge.contexts.length} 个 Context`}）\n` : "项目未采用 Context 布局\n");
    return;
  }
  if (command === "validate-rules") {
    if (knowledge.ruleErrors.length) throw new KnowledgeError(knowledge.ruleErrors);
    printWarnings(knowledge.cycles);
    process.stdout.write(`RULE 校验通过（${knowledge.rules.length} 条）\n`);
    return;
  }
  if (command !== "scope" && command !== "load") {
    throw new KnowledgeError([`未知子命令：${command}`]);
  }
  if (!knowledge.adopted) return;
  assertValid(knowledge);
  printWarnings(knowledge.cycles);
  if (command === "scope") {
    if (args.length) throw new KnowledgeError(["scope 不接受参数"]);
    process.stdout.write(`${JSON.stringify(createScope(knowledge))}\n`);
    return;
  }
  process.stdout.write(renderLoad(knowledge, args));
}

try {
  main();
} catch (error) {
  const messages = error instanceof KnowledgeError ? error.messages : [error.message];
  for (const message of messages) process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
