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

function parseReferences(raw, fileLabel, errors, required = false) {
  const { lines } = splitFrontmatter(raw, fileLabel, errors);
  if (!lines) {
    if (required) errors.push(`${fileLabel}：RULE 必须提供 references Frontmatter`);
    return [];
  }
  if (lines.length === 1 && lines[0] === "references: []") {
    return [];
  }
  if (lines[0] !== "references:" || lines.length < 2) {
    errors.push(`${fileLabel}：Frontmatter 只接受 references 列表；无引用时使用 references: []`);
    return [];
  }

  const references = [];
  for (const line of lines.slice(1)) {
    const match = /^  - (.+\.md)$/.exec(line);
    if (!match) {
      errors.push(`${fileLabel}：references 必须使用“  - 相对路径.md”`);
      continue;
    }
    const reference = match[1];
    if (path.isAbsolute(reference) || /^(?:[a-z]+:|#)/i.test(reference) || /[\\?#*]/.test(reference)) {
      errors.push(`${fileLabel}：references 必须是使用 / 分隔的 Markdown 相对路径：${reference}`);
      continue;
    }
    references.push(reference);
  }
  if (new Set(references).size !== references.length) {
    errors.push(`${fileLabel}：references 存在重复项`);
  }
  const sorted = [...references].sort(compareUtf8);
  if (references.some((value, index) => value !== sorted[index])) {
    errors.push(`${fileLabel}：references 必须按相对路径字节序排列`);
  }
  return references;
}

function validateRuleBody(raw, fileLabel, errors) {
  const normalized = raw.replaceAll("\r\n", "\n");
  const frontmatterEnd = normalized.startsWith("---\n") ? normalized.indexOf("\n---\n", 4) : -1;
  const body = frontmatterEnd >= 0 ? normalized.slice(frontmatterEnd + 5) : normalized;
  const lines = body.split("\n");
  const headings = lines.filter((line) => /^(#{1,6})\s+\S/.test(line));
  if (headings.length > 1 || (headings.length === 1 && !/^#\s+\S/.test(headings[0]))) {
    errors.push(`${fileLabel}：RULE 正文只允许一个一级标题，不得包含多章节`);
  }

  const contentLines = lines.filter((line) => !/^#{1,6}\s+/.test(line));
  const listItems = contentLines.filter((line) => /^\s*(?:[-*+]|\d+[.)])\s+\S/.test(line));
  if (listItems.length >= 3) {
    errors.push(`${fileLabel}：RULE 正文不得使用长清单，请拆成多个原子 RULE`);
  }
  if (contentLines.some((line) => /[；;]/.test(line))) {
    errors.push(`${fileLabel}：RULE 正文不得使用分号串联多个约束，请拆成多个原子 RULE`);
  }

  const blocks = [];
  let paragraph = [];
  function flushParagraph() {
    if (paragraph.length) blocks.push(paragraph.join(" ").trim());
    paragraph = [];
  }
  for (const line of contentLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
    } else if (/^(?:[-*+]|\d+[.)])\s+\S/.test(trimmed)) {
      flushParagraph();
      blocks.push(trimmed.replace(/^(?:[-*+]|\d+[.)])\s+/, ""));
    } else {
      paragraph.push(trimmed);
    }
  }
  flushParagraph();

  const sentences = blocks.flatMap((block) => block
    .replace(/(?:[。！？!?]+|[.]+(?=\s|$))/g, "$&\n")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean));
  if (sentences.length < 1 || sentences.length > 3) {
    errors.push(`${fileLabel}：RULE 正文必须包含 1–3 句话，当前为 ${sentences.length} 句`);
  }
}

function resolveReference(source, reference, errors) {
  const declaredPath = path.resolve(path.dirname(source.absolutePath), reference);
  const label = `${source.path}：references 目标 ${reference}`;
  if (!isInside(ROOT, declaredPath)) {
    errors.push(`${label}：路径逃出项目根目录`);
    return null;
  }
  return resolveExistingFile(declaredPath, ROOT, label, errors);
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
  if (!fs.existsSync(RULES_DIR)) return { rules: [], documents: new Map() };
  let files;
  try {
    files = fs.readdirSync(RULES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort(compareUtf8);
  } catch (error) {
    errors.push(`docs/rules：${error.message}`);
    return { rules: [], documents: new Map() };
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
    validateRuleBody(raw, label, errors);
    rules.push({
      code,
      number: Number(number),
      sceneName,
      filename,
      path: label,
      absolutePath,
      raw,
      declaredReferences: parseReferences(raw, label, errors, true),
    });
  }

  const documents = new Map(rules.map((rule) => [fs.realpathSync(rule.absolutePath), {
    path: rule.path,
    absolutePath: fs.realpathSync(rule.absolutePath),
    raw: rule.raw,
    declaredReferences: rule.declaredReferences,
    references: [],
  }]));

  function visit(document) {
    if (document.resolved) return;
    document.resolved = true;
    const targets = new Set();
    for (const reference of document.declaredReferences) {
      const realPath = resolveReference(document, reference, errors);
      if (!realPath) continue;
      if (targets.has(realPath)) {
        errors.push(`${document.path}：references 规范路径重复：${reference}`);
        continue;
      }
      targets.add(realPath);
      let target = documents.get(realPath);
      if (!target) {
        const targetPath = relativeToRoot(realPath);
        const raw = fs.readFileSync(realPath, "utf8");
        target = {
          path: targetPath,
          absolutePath: realPath,
          raw,
          declaredReferences: parseReferences(raw, targetPath, errors),
          references: [],
        };
        documents.set(realPath, target);
      }
      document.references.push(realPath);
      visit(target);
    }
  }

  for (const document of documents.values()) visit(document);
  return { rules, documents };
}

function findCycles(documents) {
  const state = new Map();
  const stack = [];
  const cycles = new Set();

  function visit(realPath) {
    if (state.get(realPath) === 2) return;
    if (state.get(realPath) === 1) {
      const start = stack.indexOf(realPath);
      cycles.add([...stack.slice(start), realPath].map((item) => documents.get(item).path).join(" -> "));
      return;
    }
    state.set(realPath, 1);
    stack.push(realPath);
    for (const reference of documents.get(realPath)?.references ?? []) visit(reference);
    stack.pop();
    state.set(realPath, 2);
  }

  for (const realPath of documents.keys()) visit(realPath);
  return [...cycles].sort(compareUtf8);
}

function buildKnowledge() {
  const contextErrors = [];
  const ruleErrors = [];
  const layout = detectLayout(contextErrors);
  const { rules, documents } = parseRules(ruleErrors);
  if (!layout.adopted) {
    return { adopted: false, contextErrors, ruleErrors, rules, documents, cycles: findCycles(documents) };
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

  return {
    adopted: true,
    mode: layout.mode,
    fixedPath: fixedRealPath,
    contexts,
    rules,
    documents,
    cycles: findCycles(documents),
    contextErrors,
    ruleErrors,
  };
}

function assertValid(knowledge) {
  const errors = [...knowledge.contextErrors, ...knowledge.ruleErrors];
  if (errors.length) throw new KnowledgeError(errors);
}

function createScope(knowledge, compact = false) {
  const scenes = new Map();
  for (const rule of knowledge.rules) {
    if (!scenes.has(rule.code)) scenes.set(rule.code, { code: rule.code, name: rule.sceneName, rules: [] });
    scenes.get(rule.code).rules.push(rule);
  }
  const ruleSceneOptions = [...scenes.values()]
    .sort((left, right) => compareUtf8(left.code, right.code))
    .map((scene) => compact
      ? { code: scene.code, name: scene.name, count: scene.rules.length }
      : {
          code: scene.code,
          name: scene.name,
          paths: scene.rules
            .sort((left, right) => left.number - right.number || compareUtf8(left.filename, right.filename))
            .map((rule) => rule.path),
        });

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

  const selectedDocuments = new Set(knowledge.rules
    .filter((rule) => selection.rules.includes(rule.code))
    .map((rule) => fs.realpathSync(rule.absolutePath)));
  const pending = [...selectedDocuments];
  while (pending.length) {
    const realPath = pending.pop();
    for (const reference of knowledge.documents.get(realPath).references) {
      if (!selectedDocuments.has(reference)) {
        selectedDocuments.add(reference);
        pending.push(reference);
      }
    }
  }

  const documents = new Map();
  function addDocument(document) {
    documents.set(fs.realpathSync(document.absolutePath), document);
  }
  addDocument({ path: relativeToRoot(knowledge.fixedPath), absolutePath: knowledge.fixedPath });
  if (knowledge.mode === "multiple") {
    for (const context of knowledge.contexts) {
      if (selection.contexts.includes(context.path)) addDocument({ path: context.path, absolutePath: context.realPath });
    }
  }
  for (const realPath of [...selectedDocuments].sort((left, right) => compareUtf8(relativeToRoot(left), relativeToRoot(right)))) {
    addDocument(knowledge.documents.get(realPath));
  }

  return [...documents.values()].map((document) => {
    const raw = fs.readFileSync(document.absolutePath, "utf8");
    return `===== ${document.path} =====\n${raw.replace(/[\r\n]+$/u, "")}`;
  }).join("\n\n") + "\n";
}

function printWarnings(cycles) {
  for (const cycle of cycles) process.stderr.write(`warning: references 引用环：${cycle}\n`);
}

function quotePosix(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function quoteWindows(value) {
  if (!/[\s"&%]/.test(value)) return value;
  let result = '"';
  let backslashes = 0;
  for (const character of value) {
    if (character === "\\") {
      backslashes += 1;
    } else if (character === '"') {
      result += "\\".repeat(backslashes * 2 + 1) + '"';
      backslashes = 0;
    } else {
      result += "\\".repeat(backslashes) + character;
      backslashes = 0;
    }
  }
  return result + "\\".repeat(backslashes * 2) + '"';
}

function eventInstruction(eventName) {
  if (eventName === "UserPromptSubmit") {
    return "同一任务且已加载范围完整覆盖时直接继续；否则用 Node 运行该脚本的 scope --compact，选择全部可能相关项，按 path/code 传入 --context/--rule，只执行一次 load。";
  }
  if (eventName === "SessionStart") {
    return "上下文已压缩；用 Node 运行该脚本的 scope --compact，根据当前任务选择全部可能相关项，按 path/code 传入 --context/--rule，只执行一次 load。";
  }
  if (eventName === "SubagentStart") {
    return "先为当前子任务用 Node 运行该脚本的 scope --compact，选择全部可能相关项，按 path/code 传入 --context/--rule，只执行一次 load。";
  }
  throw new KnowledgeError([`hook：不支持事件 ${eventName}`]);
}

function renderHookContext(hookInput) {
  const quote = process.platform === "win32" ? quoteWindows : quotePosix;
  return `项目知识脚本：${quote(SCRIPT_PATH)}\n${eventInstruction(hookInput.hook_event_name)}`;
}

function warningCommand(messages) {
  const ruleProblem = messages.some((message) => /RULE|rules|reference|场景/i.test(message));
  return `node ${process.platform === "win32" ? quoteWindows(SCRIPT_PATH) : quotePosix(SCRIPT_PATH)} ${ruleProblem ? "validate-rules" : "validate-context"}`;
}

function runHook() {
  const rawInput = fs.readFileSync(0, "utf8");
  let hookInput;
  try {
    hookInput = JSON.parse(rawInput);
  } catch {
    throw new KnowledgeError(["hook：stdin 不是合法 JSON"]);
  }
  if (!hookInput || typeof hookInput.hook_event_name !== "string") {
    throw new KnowledgeError(["hook：缺少 hook_event_name"]);
  }

  try {
    const knowledge = buildKnowledge();
    if (!knowledge.adopted) return;
    assertValid(knowledge);
    const additionalContext = renderHookContext(hookInput);
    process.stdout.write(`${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: hookInput.hook_event_name,
        additionalContext,
      },
    })}\n`);
  } catch (error) {
    const messages = error instanceof KnowledgeError ? error.messages : [error.message];
    const warning = `项目知识未加载：${messages[0]}。请运行 ${warningCommand(messages)}。`;
    const codex = typeof hookInput.model === "string";
    const output = { continue: true, systemMessage: warning };
    if (!codex) {
      output.hookSpecificOutput = {
        hookEventName: hookInput.hook_event_name,
        additionalContext: warning,
      };
    }
    process.stdout.write(`${JSON.stringify(output)}\n`);
  }
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new KnowledgeError(["缺少子命令：validate-context、validate-rules、scope、load 或 hook"]);
  if (command === "hook") {
    if (args.length) throw new KnowledgeError(["hook 不接受参数"]);
    runHook();
    return;
  }
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
    if (args.length > 1 || (args.length === 1 && args[0] !== "--compact")) {
      throw new KnowledgeError(["scope 只接受可选参数 --compact"]);
    }
    process.stdout.write(`${JSON.stringify(createScope(knowledge, args[0] === "--compact"))}\n`);
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
