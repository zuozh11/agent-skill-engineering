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

function run(target, args, cwd = target.root) {
  return spawnSync(process.execPath, [target.script, ...args], { cwd, encoding: "utf8" });
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
