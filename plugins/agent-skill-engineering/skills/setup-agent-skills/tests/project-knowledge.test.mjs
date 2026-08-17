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

function references(items = []) {
  if (!items.length) return "---\nreferences: []\n---\n";
  return `---\nreferences:\n${items.map((item) => `  - ${item}`).join("\n")}\n---\n`;
}

function rule(body, items = []) {
  return `${references(items)}${body}`;
}

test("单 Context scope 和 load 按场景展开引用且不自动加入必读", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-必读-基础约束.md", rule("# 基础约束\n\n只做明确要求。\n"));
  write(target.root, "docs/rules/C01-保存接口-保存前读取约束.md", rule("# 保存约束\n\n保存前必须读取平台约束。\n", ["F01-平台能力-复用平台入口.md"]));
  write(target.root, "docs/rules/F01-平台能力-复用平台入口.md", rule("# 平台约束\n\n优先复用平台入口。\n"));

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

test("RULE 必须有 Frontmatter，正文接受一到三句并拒绝四句", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-必读-一句规则.md", rule("# 一句规则\n\n只做明确要求。\n"));
  write(target.root, "docs/rules/A02-必读-三句规则.md", rule("# 三句规则\n\n先确认范围。再实施修改。最后完成验证。\n"));

  const valid = run(target, ["validate-rules"]);
  assert.equal(valid.status, 0, valid.stderr);

  write(target.root, "docs/rules/A03-必读-四句规则.md", rule("# 四句规则\n\n第一句。第二句。第三句。第四句。\n"));
  const tooMany = run(target, ["validate-rules"]);
  assert.notEqual(tooMany.status, 0);
  assert.match(tooMany.stderr, /必须包含 1–3 句话，当前为 4 句/);

  fs.rmSync(path.join(target.root, "docs/rules/A03-必读-四句规则.md"));
  write(target.root, "docs/rules/A03-必读-缺少Frontmatter.md", "# 缺少 Frontmatter\n\n这条规则缺少元数据。\n");
  const missing = run(target, ["validate-rules"]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /RULE 必须提供 references Frontmatter/);
});

test("RULE 正文拒绝分号串联、长清单和多章节", (t) => {
  const cases = [
    ["分号串联", "# 分号串联\n\n先做甲；再做乙。\n", /不得使用分号/],
    ["长清单", "# 长清单\n\n- 第一项。\n- 第二项。\n- 第三项。\n", /不得使用长清单/],
    ["多章节", "# 多章节\n\n## 规则\n\n必须执行。\n", /不得包含多章节/],
  ];
  for (const [name, body, expected] of cases) {
    const target = fixture();
    t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
    write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
    write(target.root, `docs/rules/A01-必读-${name}.md`, rule(body));
    const result = run(target, ["validate-rules"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, expected);
  }
});

test("跨目录普通文件按相对路径递归并以稳定顺序加载", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/C01-保存接口-拆分入口.md", rule("# 拆分入口\n\n保存前必须加载共享约束。\n", ["../../knowledge/save-contract.md"]));
  write(target.root, "knowledge/save-contract.md", `${references(["../shared/base.md"])}# 保存契约\n\n保存契约引用基础约束。\n`);
  write(target.root, "shared/base.md", "# 基础知识\n\n这是递归终点。\n");

  const result = run(target, ["load", "--rule", "C"]);
  assert.equal(result.status, 0, result.stderr);
  const ruleIndex = result.stdout.indexOf("===== docs/rules/C01-保存接口-拆分入口.md =====");
  const contractIndex = result.stdout.indexOf("===== knowledge/save-contract.md =====");
  const baseIndex = result.stdout.indexOf("===== shared/base.md =====");
  assert.ok(ruleIndex > 0 && contractIndex > ruleIndex && baseIndex > contractIndex);
  assert.equal(result.stdout.match(/===== shared\/base\.md =====/g)?.length, 1);
});

test("多 Context 按 Map 顺序加载并去重重复参数", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT-MAP.md", "# Context Map\n\n## Contexts\n\n- [订单](../ordering/CONTEXT.md)\n- [结算](../billing/CONTEXT.md)\n\n## Relationships\n\n- 订单 -> 结算\n");
  write(target.root, "ordering/CONTEXT.md", context("订单服务"));
  write(target.root, "billing/CONTEXT.md", context("结算服务"));
  write(target.root, "docs/rules/C01-保存接口-保持事务.md", rule("# 保持事务\n\n保存操作必须保持事务一致。\n"));

  const scopeResult = run(target, ["scope"], path.join(target.root, "ordering"));
  assert.equal(scopeResult.status, 0, scopeResult.stderr);
  const scope = JSON.parse(scopeResult.stdout);
  assert.deepEqual(scope.context_options.map((item) => item.path), ["ordering/CONTEXT.md", "billing/CONTEXT.md"]);
  assert.deepEqual(scope.context_options.map((item) => item.description), ["订单服务", "结算服务"]);

  const loadResult = run(target, ["load", "--context", "billing/CONTEXT.md", "--context", "ordering/CONTEXT.md", "--context", "billing/CONTEXT.md", "--rule", "C"]);
  assert.equal(loadResult.status, 0, loadResult.stderr);
  const orderingIndex = loadResult.stdout.indexOf("===== ordering/CONTEXT.md =====");
  const billingIndex = loadResult.stdout.indexOf("===== billing/CONTEXT.md =====");
  assert.ok(orderingIndex > 0 && billingIndex > orderingIndex);
  assert.equal(loadResult.stdout.match(/===== billing\/CONTEXT\.md =====/g)?.length, 1);
});

test("普通引用文件形成循环时只提醒并保证每个文件输出一次", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-必读-循环入口.md", rule("# 循环入口\n\n循环引用必须去重终止。\n", ["../../knowledge/first.md"]));
  write(target.root, "knowledge/first.md", `${references(["second.md"])}# 第一份知识\n`);
  write(target.root, "knowledge/second.md", `${references(["first.md"])}# 第二份知识\n`);

  const result = run(target, ["load", "--rule", "A"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /references 引用环/);
  assert.equal(result.stdout.match(/===== knowledge\/first\.md =====/g)?.length, 1);
  assert.equal(result.stdout.match(/===== knowledge\/second\.md =====/g)?.length, 1);
});

test("损坏引用和未知选择失败且不输出部分正文", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/C01-保存接口-保存约束.md", rule("# 保存约束\n\n保存必须遵守引用约束。\n", ["C02-保存接口-不存在.md"]));

  const broken = run(target, ["load", "--rule", "C"]);
  assert.notEqual(broken.status, 0);
  assert.equal(broken.stdout, "");
  assert.match(broken.stderr, /references 目标 .*文件不存在/);

  fs.rmSync(path.join(target.root, "docs", "rules"), { recursive: true });
  const unknown = run(target, ["load", "--rule", "C"]);
  assert.notEqual(unknown.status, 0);
  assert.equal(unknown.stdout, "");
  assert.match(unknown.stderr, /未知 RULE 场景/);
});

test("引用越界在读取前被拒绝", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-必读-越界引用.md", rule("# 越界引用\n\n引用必须留在项目根内。\n", ["../../../outside.md"]));

  const result = run(target, ["validate-rules"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /路径逃出项目根目录/);
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

test("没有 Context 入口时 validate-rules 仍校验现有 RULE", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/rules/A01-必读-缺少Frontmatter.md", "# 缺少 Frontmatter\n\n这条规则缺少元数据。\n");

  const result = run(target, ["validate-rules"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RULE 必须提供 references Frontmatter/);
});

test("40 条原子 RULE fixture 的最后一条正文完整返回", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  for (let index = 0; index < 40; index += 1) {
    const number = String(index).padStart(2, "0");
    write(target.root, `docs/rules/A${number}-必读-规则${number}.md`, rule(`# 规则 ${number}\n\n${"正文".repeat(20)}。${"补充".repeat(20)}。${"验收".repeat(20)}。\n`));
  }
  const result = run(target, ["load", "--rule", "A"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /===== docs\/rules\/A39-必读-规则39\.md =====/);
  assert.ok(result.stdout.endsWith(`${"正文".repeat(20)}。${"补充".repeat(20)}。${"验收".repeat(20)}。\n`));
});

test("Codex 与 Claude Code Hook 为三个事件返回宿主适配提示", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-必读-基础约束.md", rule("# 基础约束\n\n只做明确要求。\n"));

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
