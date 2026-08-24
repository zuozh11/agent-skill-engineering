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

  const contentLines = lines.filter((line) => !/^#{1,6}\s+/.test(line) && line.trim());
  if (contentLines.length === 0) {
    errors.push(`${fileLabel}：RULE 正文不能为空`);
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
      errors.push(`${label}：文件名不符合“ruleId-sceneName-ruleName.md”`);
      continue;
    }
    const [, code, number, sceneName, ruleName] = match;
    const encoding = `${code}${number}`;
    if (encodings.has(encoding)) errors.push(`${label}：ruleId ${encoding} 重复`);
    encodings.add(encoding);
    if (codeToName.has(code) && codeToName.get(code) !== sceneName) {
      errors.push(`${label}：sceneId ${code} 对应了多个 sceneName`);
    }
    if (nameToCode.has(sceneName) && nameToCode.get(sceneName) !== code) {
      errors.push(`${label}：sceneName ${sceneName} 对应了多个 sceneId`);
    }
    codeToName.set(code, sceneName);
    nameToCode.set(sceneName, code);
    const absolutePath = path.join(RULES_DIR, filename);
    const raw = fs.readFileSync(absolutePath, "utf8");
    validateRuleBody(raw, label, errors);
    const title = withoutFirstH1(raw).title ?? ruleName;
    rules.push({
      code,
      number: Number(number),
      id: encoding,
      sceneName,
      ruleName,
      title,
      filename,
      path: label,
      absolutePath,
      raw,
      declaredReferences: parseReferences(raw, label, errors, true),
    });
  }

  const numbersByScene = new Map();
  for (const rule of rules) {
    if (!numbersByScene.has(rule.code)) numbersByScene.set(rule.code, []);
    numbersByScene.get(rule.code).push(rule.number);
  }
  for (const [code, numbers] of numbersByScene) {
    const sorted = [...numbers].sort((left, right) => left - right);
    if (sorted.some((number, index) => number !== index + 1)) {
      errors.push(`RULE sceneId ${code} 的 ruleId 编号必须从 01 连续，当前为 ${sorted.map((number) => String(number).padStart(2, "0")).join("、")}`);
    }
  }

  const documents = new Map(rules.map((rule) => [fs.realpathSync(rule.absolutePath), {
    kind: "rule",
    rule,
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
          kind: "reference",
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
  let fixedDescription = null;
  if (layout.mode === "single" && fixedRealPath) {
    fixedDescription = parseContextDescription(fs.readFileSync(fixedRealPath, "utf8"), "docs/CONTEXT.md", contextErrors);
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
    fixedDescription,
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

function createScope(knowledge) {
  const scenes = new Map();
  for (const rule of knowledge.rules) {
    if (!scenes.has(rule.code)) scenes.set(rule.code, { sceneId: rule.code, sceneName: rule.sceneName, rules: [] });
    scenes.get(rule.code).rules.push(rule);
  }
  const ruleSceneOptions = [...scenes.values()]
    .sort((left, right) => compareUtf8(left.sceneId, right.sceneId))
    .map((scene) => ({
      sceneId: scene.sceneId,
      sceneName: scene.sceneName,
      rules: scene.rules
        .sort((left, right) => compareUtf8(left.id, right.id))
        .map((rule) => ({ ruleId: rule.id, ruleName: rule.ruleName })),
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

function helpHint() {
  const quote = process.platform === "win32" ? quoteWindows : quotePosix;
  return `运行 node ${quote(SCRIPT_PATH)} -h 查看用法`;
}

function argumentError(message) {
  return new KnowledgeError([`${message}；${helpHint()}`]);
}

function parseScopeArguments(args) {
  let pretty = false;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--compact") continue;
    if (args[index] === "--pretty") {
      if (pretty) throw argumentError("scope：--pretty 不能重复");
      pretty = true;
      continue;
    }
    throw argumentError(`scope：未知参数 ${args[index]}`);
  }
  return { pretty };
}

function parseLoadArguments(args) {
  const contexts = [];
  const rules = [];
  let compactAlias = false;
  let debug = false;
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--compact") {
      if (compactAlias) throw argumentError("load：--compact 不能重复");
      if (debug) throw argumentError("load：--compact 不能与 --debug 同时使用");
      compactAlias = true;
      continue;
    }
    if (option === "--debug") {
      if (debug) throw argumentError("load：--debug 不能重复");
      if (compactAlias) throw argumentError("load：--debug 不能与 --compact 同时使用");
      debug = true;
      continue;
    }
    if (option !== "--context" && option !== "--rule") {
      throw argumentError(`load：未知参数 ${option}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw argumentError(`load：${option} 缺少值`);
    }
    (option === "--context" ? contexts : rules).push(value);
    index += 1;
  }
  return { contexts: [...new Set(contexts)], rules: [...new Set(rules)], debug };
}

function bodyWithoutFrontmatter(raw) {
  const normalized = raw.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) return normalized;
  const end = normalized.indexOf("\n---\n", 4);
  return end < 0 ? normalized : normalized.slice(end + 5);
}

function withoutFirstH1(raw) {
  const lines = bodyWithoutFrontmatter(raw).split("\n");
  const index = lines.findIndex((line) => /^#\s+\S/.test(line));
  const title = index < 0 ? null : lines[index].replace(/^#\s+/, "").trim();
  if (index >= 0) lines.splice(index, 1);
  return { title, body: lines.join("\n").replace(/^\n+|\n+$/g, "") };
}

function compactContextMap(raw) {
  const lines = withoutFirstH1(raw).body.split("\n");
  const start = lines.findIndex((line) => line === "## Contexts");
  if (start >= 0) {
    let end = start + 1;
    while (end < lines.length && !lines[end].startsWith("## ")) end += 1;
    lines.splice(start, end - start);
  }
  return lines.join("\n").replace(/^\n+|\n+$/g, "");
}

function renderCompactDocument(document) {
  const raw = fs.readFileSync(document.absolutePath, "utf8");
  if (document.kind === "map") {
    return `## CONTEXT-MAP ${document.path}\n\n${compactContextMap(raw)}`.replace(/\n+$/u, "");
  }
  if (document.kind === "context") {
    const body = withoutFirstH1(raw).body;
    return `## CONTEXT ${document.description}\n\n${body}`.replace(/\n+$/u, "");
  }
  if (document.kind === "rule") {
    const stripped = withoutFirstH1(raw);
    return `## RULE ${document.rule.id} · ${document.rule.title}\n\n${stripped.body}`.replace(/\n+$/u, "");
  }
  return `## REFERENCE ${document.path}\n\n${raw.replace(/[\r\n]+$/u, "")}`;
}

function renderLoad(knowledge, args) {
  const selection = parseLoadArguments(args);
  const contextByPath = new Map(knowledge.contexts.map((context) => [context.path, context]));
  const rulesById = new Map(knowledge.rules.map((rule) => [rule.id, rule]));
  const rulesByScene = new Map();
  for (const rule of knowledge.rules) {
    if (!rulesByScene.has(rule.code)) rulesByScene.set(rule.code, []);
    rulesByScene.get(rule.code).push(rule);
  }
  const errors = [];

  if (knowledge.mode === "single" && selection.contexts.length) {
    errors.push("load：单 Context 项目不能传入 --context");
  }
  if (knowledge.mode === "multiple" && !selection.contexts.length && !selection.rules.length) {
    errors.push("load：多 Context 项目至少选择一个 --context 或 --rule");
  }
  for (const contextPath of selection.contexts) {
    if (!contextByPath.has(contextPath)) errors.push(`load：未知 Context ${contextPath}`);
  }
  const selectedRules = new Set();
  for (const value of selection.rules) {
    if (rulesByScene.has(value)) {
      for (const rule of rulesByScene.get(value)) selectedRules.add(rule);
    } else if (rulesById.has(value)) {
      selectedRules.add(rulesById.get(value));
    } else {
      errors.push(`load：未知 sceneId 或 ruleId ${value}`);
    }
  }
  if (errors.length) throw new KnowledgeError(errors);

  const selectedDocuments = new Set([...selectedRules].map((rule) => fs.realpathSync(rule.absolutePath)));
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
    const realPath = fs.realpathSync(document.absolutePath);
    if (!documents.has(realPath)) documents.set(realPath, document);
  }
  addDocument({
    kind: knowledge.mode === "single" ? "context" : "map",
    path: relativeToRoot(knowledge.fixedPath),
    absolutePath: knowledge.fixedPath,
    description: knowledge.fixedDescription,
  });
  if (knowledge.mode === "multiple") {
    for (const context of knowledge.contexts) {
      if (selection.contexts.includes(context.path)) addDocument({
        kind: "context",
        path: context.path,
        absolutePath: context.realPath,
        description: context.description,
      });
    }
  }
  for (const realPath of [...selectedDocuments].sort((left, right) => compareUtf8(relativeToRoot(left), relativeToRoot(right)))) {
    addDocument(knowledge.documents.get(realPath));
  }

  if (selection.debug) {
    return [...documents.values()].map((document) => {
      const raw = fs.readFileSync(document.absolutePath, "utf8");
      return `===== ${document.path} =====\n${raw.replace(/[\r\n]+$/u, "")}`;
    }).join("\n\n") + "\n";
  }
  return [...documents.values()].map(renderCompactDocument).join("\n\n") + "\n";
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

function renderMaintain() {
  const names = ["context-format.md", "rules-format.md"];
  const missing = names.filter((name) => !fs.existsSync(path.join(AGENTS_DIR, name)));
  if (missing.length) {
    throw new KnowledgeError([`缺少 ${missing.map((name) => `docs/agents/${name}`).join("、")}`]);
  }
  const prefix = `先检查现有 CONTEXT、CONTEXT-MAP（如有）和 RULE，确认候选没有被覆盖。向用户说明候选内容、依据和预计落点。只有用户确认且当前任务允许修改项目文档时才写入；只读任务只报告候选项。冲突交给用户决定，不静默覆盖。修改后运行：

node docs/agents/project-knowledge.mjs validate-context
node docs/agents/project-knowledge.mjs validate-rules

落点与写法见下方格式。

`;
  return prefix + names
    .map((name) => fs.readFileSync(path.join(AGENTS_DIR, name), "utf8").replace(/\s*$/u, "\n"))
    .join("\n");
}

const PROTOCOL_LEAD = "执行项目任务时，按下列协议选择、加载与维护项目知识。加载结果中的项目术语用于当前任务命名，项目规则必须遵守。本轮上下文若已有同等协议，直接使用，不必重复执行。";
const PROTOCOL_STEPS = `1. 以项目根为工作目录，执行：node docs/agents/project-knowledge.mjs scope
2. 根据当前任务与 scope 返回结果，自主选择 Context、sceneId 或 ruleId，执行：node docs/agents/project-knowledge.mjs load [--context <path>]... [--rule <sceneId|ruleId>]...
3. sceneId 加载整个场景，ruleId 加载单条原子 RULE；需要补充知识时可以继续执行 load。
4. 出现项目特有术语、实体关系、规范命名，或长期有效、不遵守就会跑偏的规则时，执行：node docs/agents/project-knowledge.mjs maintain。一次性结论、局部实现、能从代码确认的事实和已有文档不记录。
完整返回正文必须遵守；疑问或报错执行 node docs/agents/project-knowledge.mjs -h。`;

function renderProtocol() {
  return `${PROTOCOL_LEAD}\n${PROTOCOL_STEPS}\n`;
}

function renderHelp() {
  const quote = process.platform === "win32" ? quoteWindows : quotePosix;
  const script = quote(SCRIPT_PATH);
  return `项目知识命令

用法：
  node ${script} validate-context
  node ${script} validate-rules
  node ${script} scope
  node ${script} scope --compact
  node ${script} scope --pretty
  node ${script} load [--debug] [--context <path>]... [--rule <sceneId|ruleId>]...
  node ${script} maintain
  node ${script} protocol
  node ${script} hook

选择：
  scope              输出 Context path/显示名与 RULE 场景 sceneId/sceneName/rules；rules 按 ruleId 排序，只含 ruleId/ruleName。
  scope --compact    与 scope 相同，保留为兼容入口。
  scope --pretty     输出与 scope 相同的数据，仅增加缩进和换行；仅供人类在终端手动查看，Agent 项目知识加载禁止使用。

加载：
  load               输出紧凑语义标题，省略 Context/RULE 元数据与重复标题。
  load --debug       输出带文件边界的完整原文，用于诊断。
  --context          多 Context 项目可选且可重复，值来自 scope 的 context_options[].path。
  --rule             可重复；sceneId 加载整个场景，ruleId 加载单条原子 RULE；可混合，重复选择按真实路径去重。
  references         自动递归展开；缺失、越界或未知选择时退出 1 且不输出部分正文，引用环告警后去重终止。

维护：
  maintain           输出确认流程与 CONTEXT/RULE 格式，无需再读这些文件。
  protocol           输出 AGENTS.md / CLAUDE.md 标记块内协议正文。

示例：
  node ${script} load --context services/order/CONTEXT.md --rule A03 --rule H
`;
}

function eventInstruction(eventName) {
  let lead;
  if (eventName === "UserPromptSubmit") {
    lead = "同任务知识已完整覆盖则继续，否则按以下流程加载。";
  } else if (eventName === "SessionStart") {
    lead = "压缩后按保留任务重新选择并加载知识。";
  } else if (eventName === "SubagentStart") {
    lead = "按当前子任务独立选择并加载知识。";
  } else {
    throw new KnowledgeError([`hook：不支持事件 ${eventName}`]);
  }
  return `${lead}\n${PROTOCOL_STEPS}`;
}

function renderHookContext(hookInput) {
  return eventInstruction(hookInput.hook_event_name);
}

function warningCommand(messages) {
  const ruleProblem = messages.some((message) => /RULE|rules|reference|场景/i.test(message));
  return `node docs/agents/project-knowledge.mjs ${ruleProblem ? "validate-rules" : "validate-context"}`;
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
    const warning = `项目知识未加载：${messages[0]}。请以项目根为工作目录运行 ${warningCommand(messages)}。`;
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
  if (command === "-h" || command === "--help") {
    if (args.length) throw argumentError(`${command} 不接受参数`);
    process.stdout.write(renderHelp());
    return;
  }
  if (!command) throw argumentError("缺少子命令");
  if (command === "protocol") {
    if (args.length) throw argumentError("protocol 不接受参数");
    process.stdout.write(renderProtocol());
    return;
  }
  if (command === "hook") {
    if (args.length) throw argumentError("hook 不接受参数");
    runHook();
    return;
  }
  if (!["validate-context", "validate-rules", "scope", "load", "maintain"].includes(command)) {
    throw argumentError(`未知子命令：${command}`);
  }
  if ((command === "validate-context" || command === "validate-rules" || command === "maintain") && args.length) {
    throw argumentError(`${command} 不接受参数`);
  }
  const scopeSelection = command === "scope" ? parseScopeArguments(args) : null;
  if (command === "load") parseLoadArguments(args);
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
  if (!knowledge.adopted) return;
  assertValid(knowledge);
  if (command === "maintain") {
    process.stdout.write(renderMaintain());
    return;
  }
  printWarnings(knowledge.cycles);
  if (command === "scope") {
    const output = createScope(knowledge);
    process.stdout.write(`${JSON.stringify(output, null, scopeSelection.pretty ? 2 : 0)}\n`);
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
