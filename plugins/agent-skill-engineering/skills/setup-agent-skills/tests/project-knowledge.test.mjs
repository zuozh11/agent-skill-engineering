import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SOURCE_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "project-knowledge.mjs");

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "project-knowledge-"));
  const script = path.join(root, "docs", "agents", "project-knowledge.mjs");
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.copyFileSync(SOURCE_SCRIPT, script);
  return { root, script };
}

function run(target, args, cwd = target.root, input) {
  return spawnSync(process.execPath, [target.script, ...args], { cwd, encoding: "utf8", input });
}

function context(description, body = "# Context\n") {
  return `---\ndescription: ${description}\n---\n${body}`;
}

test("单 Context scope 和 load 按场景展开引用且不自动加入必读", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-必读-基础约束.md", "# 基础约束\n");
  write(target.root, "docs/rules/C01-保存接口-保存前读取约束.md", "---\nreferences:\n  - F01-平台能力-复用平台入口.md\n---\n# 保存约束\n");
  write(target.root, "docs/rules/F01-平台能力-复用平台入口.md", "# 平台约束\n");

  const scopeResult = run(target, ["scope"]);
  assert.equal(scopeResult.status, 0, scopeResult.stderr);
  const scope = JSON.parse(scopeResult.stdout);
  assert.equal(scope.context_mode, "single");
  assert.deepEqual(scope.rule_scene_options.map((scene) => scene.code), ["A", "C", "F"]);

  const loadResult = run(target, ["load", "--rule", "C"]);
  assert.equal(loadResult.status, 0, loadResult.stderr);
  assert.match(loadResult.stdout, /===== docs\/CONTEXT\.md =====/);
  assert.match(loadResult.stdout, /===== docs\/rules\/C01-/);
  assert.match(loadResult.stdout, /===== docs\/rules\/F01-/);
  assert.doesNotMatch(loadResult.stdout, /===== docs\/rules\/A01-/);
});

test("多 Context 按 Map 顺序加载并去重重复参数", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT-MAP.md", "# Context Map\n\n## Contexts\n\n- [订单](../ordering/CONTEXT.md)\n- [结算](../billing/CONTEXT.md)\n\n## Relationships\n\n- 订单 -> 结算\n");
  write(target.root, "ordering/CONTEXT.md", context("管理订单"));
  write(target.root, "billing/CONTEXT.md", context("管理结算"));
  write(target.root, "docs/rules/C01-保存接口-保持事务.md", "# 保持事务\n");

  const scopeResult = run(target, ["scope"], path.join(target.root, "ordering"));
  assert.equal(scopeResult.status, 0, scopeResult.stderr);
  const scope = JSON.parse(scopeResult.stdout);
  assert.deepEqual(scope.context_options.map((item) => item.path), ["ordering/CONTEXT.md", "billing/CONTEXT.md"]);

  const loadResult = run(target, ["load", "--context", "billing/CONTEXT.md", "--context", "ordering/CONTEXT.md", "--context", "billing/CONTEXT.md", "--rule", "C"]);
  assert.equal(loadResult.status, 0, loadResult.stderr);
  const orderingIndex = loadResult.stdout.indexOf("===== ordering/CONTEXT.md =====");
  const billingIndex = loadResult.stdout.indexOf("===== billing/CONTEXT.md =====");
  assert.ok(orderingIndex > 0 && billingIndex > orderingIndex);
  assert.equal(loadResult.stdout.match(/===== billing\/CONTEXT\.md =====/g)?.length, 1);
});

test("循环引用只提醒并保证每个 RULE 输出一次", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-必读-第一条.md", "---\nreferences:\n  - A02-必读-第二条.md\n---\n# 第一条\n");
  write(target.root, "docs/rules/A02-必读-第二条.md", "---\nreferences:\n  - A01-必读-第一条.md\n---\n# 第二条\n");

  const result = run(target, ["load", "--rule", "A"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /RULE 引用环/);
  assert.equal(result.stdout.match(/===== docs\/rules\/A01-/g)?.length, 1);
  assert.equal(result.stdout.match(/===== docs\/rules\/A02-/g)?.length, 1);
});

test("损坏引用和未知选择失败且不输出部分正文", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/C01-保存接口-保存约束.md", "---\nreferences:\n  - C02-保存接口-不存在.md\n---\n# 保存约束\n");

  const broken = run(target, ["load", "--rule", "C"]);
  assert.notEqual(broken.status, 0);
  assert.equal(broken.stdout, "");
  assert.match(broken.stderr, /references 目标不存在/);

  fs.rmSync(path.join(target.root, "docs", "rules"), { recursive: true });
  const unknown = run(target, ["load", "--rule", "C"]);
  assert.notEqual(unknown.status, 0);
  assert.equal(unknown.stdout, "");
  assert.match(unknown.stderr, /未知 RULE 场景/);
});

test("未采用知识结构时 scope 和 load 静默成功", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  for (const command of [["scope"], ["load"]]) {
    const result = run(target, command);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
  }
});

test("最大 fixture 的最后一条 RULE 正文完整返回", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  for (let index = 0; index < 40; index += 1) {
    const number = String(index).padStart(2, "0");
    write(target.root, `docs/rules/A${number}-必读-规则${number}.md`, `# 规则 ${number}\n\n${"正文".repeat(500)}\n`);
  }
  const result = run(target, ["load", "--rule", "A"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /===== docs\/rules\/A39-必读-规则39\.md =====/);
  assert.ok(result.stdout.endsWith(`${"正文".repeat(500)}\n`));
});

test("Codex 与 Claude Code Hook 为三个事件返回宿主适配提示", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-必读-基础约束.md", "# 基础约束\n");

  for (const event of ["UserPromptSubmit", "SessionStart", "SubagentStart"]) {
    const codex = run(target, ["hook"], target.root, JSON.stringify({ hook_event_name: event, model: "gpt-test", source: "compact" }));
    assert.equal(codex.status, 0, codex.stderr);
    const codexOutput = JSON.parse(codex.stdout);
    assert.equal(codexOutput.hookSpecificOutput.hookEventName, event);
    assert.match(codexOutput.hookSpecificOutput.additionalContext, /max_output_tokens/);
    assert.match(codexOutput.hookSpecificOutput.additionalContext, /只调用一次 load/);

    const claude = run(target, ["hook"], target.root, JSON.stringify({ hook_event_name: event, source: "compact" }));
    assert.equal(claude.status, 0, claude.stderr);
    const claudeOutput = JSON.parse(claude.stdout);
    assert.equal(claudeOutput.hookSpecificOutput.hookEventName, event);
    assert.match(claudeOutput.hookSpecificOutput.additionalContext, /宿主生成的会话文件路径/);
  }
});

test("Hook 在知识损坏时提醒并继续，未采用时静默", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", "# 缺少 Frontmatter\n");

  const warning = run(target, ["hook"], target.root, JSON.stringify({ hook_event_name: "UserPromptSubmit" }));
  assert.equal(warning.status, 0, warning.stderr);
  const warningOutput = JSON.parse(warning.stdout);
  assert.equal(warningOutput.continue, true);
  assert.match(warningOutput.systemMessage, /项目知识未加载/);
  assert.match(warningOutput.hookSpecificOutput.additionalContext, /validate-context/);

  fs.rmSync(path.join(target.root, "docs", "CONTEXT.md"));
  const silent = run(target, ["hook"], target.root, JSON.stringify({ hook_event_name: "UserPromptSubmit", model: "gpt-test" }));
  assert.equal(silent.status, 0, silent.stderr);
  assert.equal(silent.stdout, "");
});

test("Hook 命令正确引用带空格和特殊字符的脚本路径", (t) => {
  const original = fixture();
  const specialRoot = `${original.root} space-$-'quote`;
  fs.renameSync(original.root, specialRoot);
  const target = { root: specialRoot, script: path.join(specialRoot, "docs", "agents", "project-knowledge.mjs") };
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));

  const result = run(target, ["hook"], target.root, JSON.stringify({ hook_event_name: "UserPromptSubmit", model: "gpt-test" }));
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(output, /node '\/.*space-\$-'"'"'quote\/docs\/agents\/project-knowledge\.mjs' load/);
});

test("Hook 模板覆盖三个事件并保持项目根定位", () => {
  const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const codex = JSON.parse(fs.readFileSync(path.join(skillRoot, "hook-templates", "codex-hooks.json"), "utf8"));
  const claude = JSON.parse(fs.readFileSync(path.join(skillRoot, "hook-templates", "claude-settings.json"), "utf8"));
  assert.deepEqual(Object.keys(codex.hooks), ["UserPromptSubmit", "SessionStart", "SubagentStart"]);
  assert.deepEqual(Object.keys(claude.hooks), ["UserPromptSubmit", "SessionStart", "SubagentStart"]);
  for (const event of Object.keys(codex.hooks)) {
    const handler = codex.hooks[event][0].hooks[0];
    assert.match(handler.command, /git rev-parse --show-toplevel/);
    assert.match(handler.commandWindows, /git rev-parse --show-toplevel/);
    assert.equal(handler.additionalContextLimit, 10000);
  }
  for (const event of Object.keys(claude.hooks)) {
    const handler = claude.hooks[event][0].hooks[0];
    assert.equal(handler.command, "node");
    assert.deepEqual(handler.args, ["${CLAUDE_PROJECT_DIR}/docs/agents/project-knowledge.mjs", "hook"]);
  }
});
