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

function largeFixture() {
  const target = fixture();
  const contextEntries = [];
  for (let index = 0; index < 8; index += 1) {
    contextEntries.push(`- [服务${index}](../ctx-${index}/CONTEXT.md)`);
    write(target.root, `ctx-${index}/CONTEXT.md`, context(`服务${index}`));
  }
  write(target.root, "docs/CONTEXT-MAP.md", `# Context Map\n\n## Contexts\n\n${contextEntries.join("\n")}\n`);

  const sceneCounts = [7, 7, 7, 7, 7, 7, 6, 6, 6, 6];
  for (let sceneIndex = 0; sceneIndex < sceneCounts.length; sceneIndex += 1) {
    const code = String.fromCharCode("A".charCodeAt(0) + sceneIndex);
    for (let index = 0; index < sceneCounts[sceneIndex]; index += 1) {
      const number = String(index + 1).padStart(2, "0");
      write(target.root, `docs/rules/${code}${number}-场景${code}-规则${number}.md`, rule(`# 规则 ${number}\n\n必须遵守场景 ${code} 的规则 ${number}。\n`));
    }
  }
  return target;
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

  const compactResult = run(target, ["scope", "--compact"]);
  assert.equal(compactResult.status, 0, compactResult.stderr);
  const compact = JSON.parse(compactResult.stdout);
  assert.deepEqual(compact.rule_scene_options, [
    { code: "A", name: "必读", count: 1 },
    { code: "C", name: "保存接口", count: 1 },
    { code: "F", name: "平台能力", count: 1 },
  ]);
  assert.equal(compactResult.stdout.includes("paths"), false);

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
  write(target.root, "docs/rules/A02-必读-三句规则.md", rule("# 三句规则\n\n先确认范围。\n再实施修改。\n最后完成验证。\n"));

  const valid = run(target, ["validate-rules"]);
  assert.equal(valid.status, 0, valid.stderr);

  write(target.root, "docs/rules/A03-必读-四句规则.md", rule("# 四句规则\n\n第一句。\n第二句。\n第三句。\n第四句。\n"));
  const tooMany = run(target, ["validate-rules"]);
  assert.notEqual(tooMany.status, 0);
  assert.match(tooMany.stderr, /必须包含 1–3 句话，当前为 4 句/);

  fs.rmSync(path.join(target.root, "docs/rules/A03-必读-四句规则.md"));
  write(target.root, "docs/rules/A03-必读-缺少Frontmatter.md", "# 缺少 Frontmatter\n\n这条规则缺少元数据。\n");
  const missing = run(target, ["validate-rules"]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /RULE 必须提供 references Frontmatter/);
});

test("RULE 正文拒绝同一行多句和单句跨行", (t) => {
  const cases = [
    ["同一行多句", "# 同一行多句\n\n第一句。第二句。\n"],
    ["单句跨行", "# 单句跨行\n\n这句话被错误地\n拆成两行。\n"],
  ];
  for (const [name, body] of cases) {
    const target = fixture();
    t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
    write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
    write(target.root, `docs/rules/A01-必读-${name}.md`, rule(body));
    const result = run(target, ["validate-rules"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /每句话必须独占一个非空行/);
  }
});

test("RULE 每个场景必须从 01 连续编号", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-必读-第一条.md", rule("# 第一条\n\n必须执行第一条。\n"));
  write(target.root, "docs/rules/A03-必读-第三条.md", rule("# 第三条\n\n必须执行第三条。\n"));
  write(target.root, "docs/rules/B01-查询接口-第一条.md", rule("# 第一条\n\n必须执行查询规则。\n"));

  const gap = run(target, ["validate-rules"]);
  assert.notEqual(gap.status, 0);
  assert.match(gap.stderr, /场景 A 编号必须从 01 连续，当前为 01、03/);
  assert.doesNotMatch(gap.stderr, /场景 B 编号必须/);

  fs.renameSync(
    path.join(target.root, "docs/rules/A03-必读-第三条.md"),
    path.join(target.root, "docs/rules/A02-必读-第三条.md"),
  );
  fs.renameSync(
    path.join(target.root, "docs/rules/A01-必读-第一条.md"),
    path.join(target.root, "docs/rules/A00-必读-第一条.md"),
  );
  const zero = run(target, ["validate-rules"]);
  assert.notEqual(zero.status, 0);
  assert.match(zero.stderr, /场景 A 编号必须从 01 连续，当前为 00、02/);
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

  const result = run(target, ["load", "--rule", "A01"]);
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
    const number = String(index + 1).padStart(2, "0");
    write(target.root, `docs/rules/A${number}-必读-规则${number}.md`, rule(`# 规则 ${number}\n\n${"正文".repeat(20)}。\n${"补充".repeat(20)}。\n${"验收".repeat(20)}。\n`));
  }
  const result = run(target, ["load", "--rule", "A"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /===== docs\/rules\/A40-必读-规则40\.md =====/);
  assert.ok(result.stdout.endsWith(`${"正文".repeat(20)}。\n${"补充".repeat(20)}。\n${"验收".repeat(20)}。\n`));
});

test("scope 默认单行紧凑、--compact 兼容且 --pretty 仅美化显示", (t) => {
  const target = largeFixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));

  const defaultResult = run(target, ["scope"]);
  const compactResult = run(target, ["scope", "--compact"]);
  assert.equal(defaultResult.status, 0, defaultResult.stderr);
  assert.equal(compactResult.status, 0, compactResult.stderr);
  assert.equal(defaultResult.stdout, compactResult.stdout);
  assert.equal(defaultResult.stdout.trim().split("\n").length, 1);
  const compact = JSON.parse(compactResult.stdout);
  assert.equal(compact.context_options.length, 8);
  assert.equal(compact.rule_scene_options.length, 10);
  assert.equal(compact.rule_scene_options.reduce((sum, scene) => sum + scene.count, 0), 66);
  assert.equal(compact.rule_scene_options.some((scene) => "paths" in scene), false);
  assert.doesNotMatch(compactResult.stdout, /docs\/rules\//);
  assert.ok(defaultResult.stdout.length <= 1600, `compact scope ${defaultResult.stdout.length} 字符`);

  const prettyResult = run(target, ["scope", "--pretty"]);
  assert.equal(prettyResult.status, 0, prettyResult.stderr);
  assert.deepEqual(JSON.parse(prettyResult.stdout), compact);
  assert.ok(prettyResult.stdout.trim().split("\n").length > 1);

  const loadResult = run(target, [
    "load",
    "--context", compact.context_options[0].path,
    "--rule", compact.rule_scene_options[0].code,
  ]);
  assert.equal(loadResult.status, 0, loadResult.stderr);
  assert.match(loadResult.stdout, /===== ctx-0\/CONTEXT\.md =====/);
  assert.equal(loadResult.stdout.match(/===== docs\/rules\/A/g)?.length, 7);
});

test("scope --rules 支持多场景重复下钻并按原子 ID 稳定排序", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-必读-第一条.md", rule("# 第一条标题\n\n必须执行第一条。\n"));
  write(target.root, "docs/rules/A02-必读-第二条.md", rule("# 第二条标题\n\n必须执行第二条。\n"));
  write(target.root, "docs/rules/B01-查询接口-查询约束.md", rule("# 查询约束标题\n\n查询必须遵守约束。\n"));

  const result = run(target, ["scope", "--rules", "B", "--rules", "A", "--rules", "A"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    rule_options: [
      { id: "A01", title: "第一条标题" },
      { id: "A02", title: "第二条标题" },
      { id: "B01", title: "查询约束标题" },
    ],
  });
  assert.doesNotMatch(result.stdout, /docs\/rules|正文|必须执行/);
  assert.equal(result.stdout.trim().split("\n").length, 1);

  const pretty = run(target, ["scope", "--pretty", "--rules", "B", "--rules", "A", "--rules", "A"]);
  assert.equal(pretty.status, 0, pretty.stderr);
  assert.deepEqual(JSON.parse(pretty.stdout), JSON.parse(result.stdout));
  assert.ok(pretty.stdout.trim().split("\n").length > 1);

  const unknown = run(target, ["scope", "--rules", "Z"]);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /未知 RULE 场景 Z/);
});

test("原子 load 递归跨场景引用，场景与原子混合选择按真实路径去重", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域", "# 单一业务领域\n\n共享概念正文。\n"));
  write(target.root, "docs/rules/A01-必读-基础规则.md", rule("# 基础规则\n\n必须遵守基础规则。\n"));
  write(target.root, "docs/rules/A02-必读-跨场景入口.md", rule("# 跨场景入口\n\n必须加载查询规则。\n", ["B01-查询接口-查询规则.md"]));
  write(target.root, "docs/rules/B01-查询接口-查询规则.md", rule("# 查询规则\n\n查询必须加载普通契约。\n", ["../../knowledge/query-contract.md"]));
  write(target.root, "knowledge/query-contract.md", `${references()}# 普通契约\n\n普通文件 Frontmatter 和标题必须保留。\n`);

  const atomic = run(target, ["load", "--compact", "--rule", "A02"]);
  assert.equal(atomic.status, 0, atomic.stderr);
  assert.doesNotMatch(atomic.stdout, /RULE A01/);
  assert.match(atomic.stdout, /## RULE A02 · 跨场景入口/);
  assert.match(atomic.stdout, /## RULE B01 · 查询规则/);
  assert.match(atomic.stdout, /## REFERENCE knowledge\/query-contract\.md\n\n---\nreferences: \[\]\n---\n# 普通契约/);

  const wholeScene = run(target, ["load", "--compact", "--rule", "A"]);
  assert.equal(wholeScene.status, 0, wholeScene.stderr);
  assert.ok(atomic.stdout.length < wholeScene.stdout.length);

  const mixed = run(target, ["load", "--compact", "--rule", "A", "--rule", "A02", "--rule", "B01", "--rule", "A01"]);
  assert.equal(mixed.status, 0, mixed.stderr);
  assert.equal(mixed.stdout.match(/## RULE A01/g)?.length, 1);
  assert.equal(mixed.stdout.match(/## RULE A02/g)?.length, 1);
  assert.equal(mixed.stdout.match(/## RULE B01/g)?.length, 1);

  const unknownId = run(target, ["load", "--compact", "--rule", "A99"]);
  assert.notEqual(unknownId.status, 0);
  assert.equal(unknownId.stdout, "");
  assert.match(unknownId.stderr, /未知 RULE ID A99/);

  const ambiguous = run(target, ["load", "--compact", "--rule", "A1"]);
  assert.notEqual(ambiguous.status, 0);
  assert.equal(ambiguous.stdout, "");
  assert.match(ambiguous.stderr, /无效 RULE 选择 A1/);
});

test("compact load 精简 Map、Context 与 RULE，完整 load 保持原文", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT-MAP.md", "# 项目 Context Map\n\n## Shared Concepts\n\n共享概念保留。\n\n## Contexts\n\n- [订单](../ordering/CONTEXT.md)\n- [结算](../billing/CONTEXT.md)\n\n## Relationships\n\n- 订单 -> 结算\n");
  write(target.root, "ordering/CONTEXT.md", context("订单服务", "# 订单 Context\n\n订单正文第一句。\n订单正文第二句。\n"));
  write(target.root, "billing/CONTEXT.md", context("结算服务", "# 结算 Context\n\n结算正文。\n"));
  write(target.root, "docs/rules/A01-必读-项目约束.md", rule("# 项目约束标题\n\n第一句保持原行。\n第二句保持原行。\n", ["../CONTEXT-MAP.md"]));

  const compact = run(target, ["load", "--compact", "--context", "ordering/CONTEXT.md", "--rule", "A01"]);
  assert.equal(compact.status, 0, compact.stderr);
  assert.match(compact.stdout, /## CONTEXT-MAP docs\/CONTEXT-MAP\.md/);
  assert.match(compact.stdout, /## Shared Concepts[\s\S]*共享概念保留。/);
  assert.match(compact.stdout, /## Relationships[\s\S]*订单 -> 结算/);
  assert.doesNotMatch(compact.stdout, /## Contexts|- \[订单\]/);
  assert.match(compact.stdout, /## CONTEXT 订单服务\n\n订单正文第一句。\n订单正文第二句。/);
  assert.match(compact.stdout, /## RULE A01 · 项目约束标题\n\n第一句保持原行。\n第二句保持原行。/);
  assert.doesNotMatch(compact.stdout, /description:|references:|# 订单 Context|# 项目约束标题/);

  const full = run(target, ["load", "--context", "ordering/CONTEXT.md", "--rule", "A01"]);
  assert.equal(full.status, 0, full.stderr);
  assert.match(full.stdout, /===== docs\/CONTEXT-MAP\.md =====[\s\S]*## Contexts/);
  assert.match(full.stdout, /===== ordering\/CONTEXT\.md =====\n---\ndescription: 订单服务\n---\n# 订单 Context/);
  assert.match(full.stdout, /===== docs\/rules\/A01-[\s\S]*references:[\s\S]*\.\.\/CONTEXT-MAP\.md[\s\S]*# 项目约束标题/);
  assert.ok(compact.stdout.length < full.stdout.length);
});

test("-h 与 --help 不依赖项目校验且未知参数指向帮助", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", "# 损坏的 Context\n");

  const short = run(target, ["-h"]);
  const long = run(target, ["--help"]);
  assert.equal(short.status, 0, short.stderr);
  assert.equal(long.status, 0, long.stderr);
  assert.equal(short.stdout, long.stdout);
  assert.match(short.stdout, /scope --compact/);
  assert.match(short.stdout, /scope --pretty/);
  assert.match(short.stdout, /scope --rules <场景码> \[--rules <场景码> \.\.\.\]/);
  assert.match(short.stdout, /load \[--compact\]/);
  assert.match(short.stdout, /场景码加载整个场景，RULE ID 只加载该 RULE/);

  for (const args of [["scope", "--unknown"], ["load", "--unknown"]]) {
    const result = run(target, args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--help 查看用法/);
  }
});

test("三个 Hook 只返回小型延迟选择协议", (t) => {
  const target = largeFixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));

  const expectations = new Map([
    ["UserPromptSubmit", /同任务知识已覆盖则继续；否则/],
    ["SessionStart", /压缩后/],
    ["SubagentStart", /本子任务/],
  ]);

  for (const event of ["UserPromptSubmit", "SessionStart", "SubagentStart"]) {
    const codex = run(target, ["hook"], target.root, JSON.stringify({ hook_event_name: event, model: "gpt-test", source: "compact" }));
    assert.equal(codex.status, 0, codex.stderr);
    const codexContext = JSON.parse(codex.stdout).hookSpecificOutput.additionalContext;

    const claude = run(target, ["hook"], target.root, JSON.stringify({ hook_event_name: event, source: "compact" }));
    assert.equal(claude.status, 0, claude.stderr);
    const claudeContext = JSON.parse(claude.stdout).hookSpecificOutput.additionalContext;

    assert.equal(claudeContext, codexContext);
    assert.match(codexContext, expectations.get(event));
    assert.match(codexContext, /scope 选 Context\/场景/);
    assert.doesNotMatch(codexContext, /scope --compact/);
    assert.match(codexContext, /scope --rules <code>/);
    assert.match(codexContext, /一次 load --compact/);
    assert.match(codexContext, /完整正文必须遵守/);
    assert.match(codexContext, /疑问\/报错：--help/);
    assert.doesNotMatch(codexContext, /context_options|rule_scene_options|docs\/rules\//);
    assert.ok(codexContext.length <= 380, `${event} Hook 文案 ${codexContext.length} 字符`);
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
  assert.match(output, /脚本：'\/.*space-\$-'"'"'quote\/docs\/agents\/project-knowledge\.mjs'/);
  assert.match(output, /scope 选 Context\/场景/);
  assert.doesNotMatch(output, /scope --compact/);
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
    assert.equal(handler.additionalContextLimit, 1000);
  }
  for (const event of Object.keys(claude.hooks)) {
    const handler = claude.hooks[event][0].hooks[0];
    assert.equal(handler.command, "node");
    assert.deepEqual(handler.args, ["${CLAUDE_PROJECT_DIR}/docs/agents/project-knowledge.mjs", "hook"]);
  }
});
