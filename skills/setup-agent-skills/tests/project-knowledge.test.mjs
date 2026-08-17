import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SOURCE_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "project-knowledge.mjs");
const LAYOUT_SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "render-layout-docs.mjs");

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
    const sceneId = String.fromCharCode("A".charCodeAt(0) + sceneIndex);
    const sceneName = sceneId === "A" ? "通用约束" : `场景${sceneId}`;
    for (let index = 0; index < sceneCounts[sceneIndex]; index += 1) {
      const number = String(index + 1).padStart(2, "0");
      write(target.root, `docs/rules/${sceneId}${number}-${sceneName}-规则${number}.md`, rule(`# 规则 ${number}\n\n必须遵守场景 ${sceneId} 的规则 ${number}。\n`));
    }
  }
  return target;
}

test("单 Context scope 和 load 按场景展开引用且不自动加入通用约束", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-通用约束-基础约束.md", rule("# 基础约束\n\n只做明确要求。\n"));
  write(target.root, "docs/rules/C01-保存接口-保存前读取约束.md", rule("# 保存约束\n\n保存前必须读取平台约束。\n", ["F01-平台能力-复用平台入口.md"]));
  write(target.root, "docs/rules/F01-平台能力-复用平台入口.md", rule("# 平台约束\n\n优先复用平台入口。\n"));

  const scopeResult = run(target, ["scope"]);
  assert.equal(scopeResult.status, 0, scopeResult.stderr);
  const scope = JSON.parse(scopeResult.stdout);
  assert.equal(scope.context_mode, "single");
  assert.deepEqual(scope.rule_scene_options.map((scene) => scene.sceneId), ["A", "C", "F"]);

  const compactResult = run(target, ["scope", "--compact"]);
  assert.equal(compactResult.status, 0, compactResult.stderr);
  const compact = JSON.parse(compactResult.stdout);
  assert.deepEqual(compact.rule_scene_options, [
    { sceneId: "A", sceneName: "通用约束", rules: [{ ruleId: "A01", ruleName: "基础约束" }] },
    { sceneId: "C", sceneName: "保存接口", rules: [{ ruleId: "C01", ruleName: "保存前读取约束" }] },
    { sceneId: "F", sceneName: "平台能力", rules: [{ ruleId: "F01", ruleName: "复用平台入口" }] },
  ]);
  assert.doesNotMatch(compactResult.stdout, /"(?:code|files|id|name)"|count|paths|\.md/);

  const loadResult = run(target, ["load", "--rule", "C"]);
  assert.equal(loadResult.status, 0, loadResult.stderr);
  assert.match(loadResult.stdout, /## CONTEXT 单一业务领域/);
  assert.match(loadResult.stdout, /## RULE C01 · 保存约束/);
  assert.match(loadResult.stdout, /## RULE F01 · 平台约束/);
  assert.doesNotMatch(loadResult.stdout, /## RULE A01/);
});

test("RULE 必须有 Frontmatter，正文接受一到三句并拒绝四句", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-通用约束-一句规则.md", rule("# 一句规则\n\n只做明确要求。\n"));
  write(target.root, "docs/rules/A02-通用约束-三句规则.md", rule("# 三句规则\n\n先确认范围。\n再实施修改。\n最后完成验证。\n"));

  const valid = run(target, ["validate-rules"]);
  assert.equal(valid.status, 0, valid.stderr);

  write(target.root, "docs/rules/A03-通用约束-四句规则.md", rule("# 四句规则\n\n第一句。\n第二句。\n第三句。\n第四句。\n"));
  const tooMany = run(target, ["validate-rules"]);
  assert.notEqual(tooMany.status, 0);
  assert.match(tooMany.stderr, /必须包含 1–3 句话，当前为 4 句/);

  fs.rmSync(path.join(target.root, "docs/rules/A03-通用约束-四句规则.md"));
  write(target.root, "docs/rules/A03-通用约束-缺少Frontmatter.md", "# 缺少 Frontmatter\n\n这条规则缺少元数据。\n");
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
    write(target.root, `docs/rules/A01-通用约束-${name}.md`, rule(body));
    const result = run(target, ["validate-rules"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /每句话必须独占一个非空行/);
  }
});

test("RULE 每个场景必须从 01 连续编号", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-通用约束-第一条.md", rule("# 第一条\n\n必须执行第一条。\n"));
  write(target.root, "docs/rules/A03-通用约束-第三条.md", rule("# 第三条\n\n必须执行第三条。\n"));
  write(target.root, "docs/rules/B01-查询接口-第一条.md", rule("# 第一条\n\n必须执行查询规则。\n"));

  const gap = run(target, ["validate-rules"]);
  assert.notEqual(gap.status, 0);
  assert.match(gap.stderr, /sceneId A 的 ruleId 编号必须从 01 连续，当前为 01、03/);
  assert.doesNotMatch(gap.stderr, /sceneId B 的 ruleId 编号必须/);

  fs.renameSync(
    path.join(target.root, "docs/rules/A03-通用约束-第三条.md"),
    path.join(target.root, "docs/rules/A02-通用约束-第三条.md"),
  );
  fs.renameSync(
    path.join(target.root, "docs/rules/A01-通用约束-第一条.md"),
    path.join(target.root, "docs/rules/A00-通用约束-第一条.md"),
  );
  const zero = run(target, ["validate-rules"]);
  assert.notEqual(zero.status, 0);
  assert.match(zero.stderr, /sceneId A 的 ruleId 编号必须从 01 连续，当前为 00、02/);
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
    write(target.root, `docs/rules/A01-通用约束-${name}.md`, rule(body));
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
  const ruleIndex = result.stdout.indexOf("## RULE C01 · 拆分入口");
  const contractIndex = result.stdout.indexOf("## REFERENCE knowledge/save-contract.md");
  const baseIndex = result.stdout.indexOf("## REFERENCE shared/base.md");
  assert.ok(ruleIndex > 0 && contractIndex > ruleIndex && baseIndex > contractIndex);
  assert.equal(result.stdout.match(/## REFERENCE shared\/base\.md/g)?.length, 1);
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
  const orderingIndex = loadResult.stdout.indexOf("## CONTEXT 订单服务");
  const billingIndex = loadResult.stdout.indexOf("## CONTEXT 结算服务");
  assert.ok(orderingIndex > 0 && billingIndex > orderingIndex);
  assert.equal(loadResult.stdout.match(/## CONTEXT 结算服务/g)?.length, 1);
});

test("多 Context 可只按 sceneId 或 ruleId 加载并保留固定 Map 入口", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT-MAP.md", "# Context Map\n\n## Shared Concepts\n\n共享入口知识。\n\n## Contexts\n\n- [订单](../ordering/CONTEXT.md)\n- [结算](../billing/CONTEXT.md)\n\n## Relationships\n\n- 订单 -> 结算\n");
  write(target.root, "ordering/CONTEXT.md", context("订单服务", "# 订单 Context\n\n订单正文。\n"));
  write(target.root, "billing/CONTEXT.md", context("结算服务", "# 结算 Context\n\n结算正文。\n"));
  write(target.root, "docs/rules/J01-查询接口-查询入口.md", rule("# 查询入口\n\n查询必须加载共享契约。\n", ["K01-平台能力-共享契约.md"]));
  write(target.root, "docs/rules/J02-查询接口-查询补充.md", rule("# 查询补充\n\n查询必须遵守补充规则。\n"));
  write(target.root, "docs/rules/K01-平台能力-共享契约.md", rule("# 共享契约\n\n共享契约必须递归加载。\n", ["../../knowledge/query-contract.md"]));
  write(target.root, "knowledge/query-contract.md", "# 查询契约\n\n这是普通递归引用。\n");

  const scene = run(target, ["load", "--rule", "J"]);
  assert.equal(scene.status, 0, scene.stderr);
  assert.match(scene.stdout, /## CONTEXT-MAP docs\/CONTEXT-MAP\.md/);
  assert.match(scene.stdout, /共享入口知识。/);
  assert.match(scene.stdout, /## RULE J01/);
  assert.match(scene.stdout, /## RULE J02/);
  assert.match(scene.stdout, /## RULE K01/);
  assert.match(scene.stdout, /## REFERENCE knowledge\/query-contract\.md/);
  assert.doesNotMatch(scene.stdout, /## CONTEXT 订单服务|## CONTEXT 结算服务/);

  const atomic = run(target, ["load", "--rule", "J01"]);
  assert.equal(atomic.status, 0, atomic.stderr);
  assert.match(atomic.stdout, /## CONTEXT-MAP docs\/CONTEXT-MAP\.md/);
  assert.match(atomic.stdout, /## RULE J01/);
  assert.match(atomic.stdout, /## RULE K01/);
  assert.doesNotMatch(atomic.stdout, /## RULE J02|## CONTEXT 订单服务|## CONTEXT 结算服务/);

  const mixed = run(target, ["load", "--rule", "J01", "--rule", "K"]);
  assert.equal(mixed.status, 0, mixed.stderr);
  assert.equal(mixed.stdout.match(/## RULE K01/g)?.length, 1);

  const empty = run(target, ["load"]);
  assert.notEqual(empty.status, 0);
  assert.equal(empty.stdout, "");
  assert.match(empty.stderr, /至少选择一个 --context 或 --rule/);
});

test("普通引用文件形成循环时只提醒并保证每个文件输出一次", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-通用约束-循环入口.md", rule("# 循环入口\n\n循环引用必须去重终止。\n", ["../../knowledge/first.md"]));
  write(target.root, "knowledge/first.md", `${references(["second.md"])}# 第一份知识\n`);
  write(target.root, "knowledge/second.md", `${references(["first.md"])}# 第二份知识\n`);

  const result = run(target, ["load", "--rule", "A01"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /references 引用环/);
  assert.equal(result.stdout.match(/## REFERENCE knowledge\/first\.md/g)?.length, 1);
  assert.equal(result.stdout.match(/## REFERENCE knowledge\/second\.md/g)?.length, 1);
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
  assert.match(unknown.stderr, /未知 sceneId 或 ruleId C/);
});

test("引用越界在读取前被拒绝", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-通用约束-越界引用.md", rule("# 越界引用\n\n引用必须留在项目根内。\n", ["../../../outside.md"]));

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
  write(target.root, "docs/rules/A01-通用约束-缺少Frontmatter.md", "# 缺少 Frontmatter\n\n这条规则缺少元数据。\n");

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
    write(target.root, `docs/rules/A${number}-通用约束-规则${number}.md`, rule(`# 规则 ${number}\n\n${"正文".repeat(20)}。\n${"补充".repeat(20)}。\n${"验收".repeat(20)}。\n`));
  }
  const result = run(target, ["load", "--rule", "A"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /## RULE A40 · 规则 40/);
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
  assert.equal(run(target, ["scope"]).stdout, defaultResult.stdout);
  assert.equal(defaultResult.stdout.trim().split("\n").length, 1);
  const compact = JSON.parse(compactResult.stdout);
  assert.equal(compact.context_options.length, 8);
  assert.equal(compact.rule_scene_options.length, 10);
  assert.equal(compact.rule_scene_options.reduce((sum, scene) => sum + scene.rules.length, 0), 66);
  assert.equal(compact.rule_scene_options.some((scene) => "count" in scene || "paths" in scene || "code" in scene || "files" in scene || "id" in scene || "name" in scene), false);
  assert.equal(compact.rule_scene_options.every((scene) => Array.isArray(scene.rules)), true);
  assert.equal(compact.rule_scene_options.every((scene) => scene.rules.every((rule) => Object.keys(rule).join(",") === "ruleId,ruleName")), true);
  assert.deepEqual(compact.rule_scene_options[0].rules.slice(0, 3), [
    { ruleId: "A01", ruleName: "规则01" },
    { ruleId: "A02", ruleName: "规则02" },
    { ruleId: "A03", ruleName: "规则03" },
  ]);
  assert.doesNotMatch(compactResult.stdout, /docs\/rules\//);
  assert.ok(defaultResult.stdout.length <= 5000, `compact scope ${defaultResult.stdout.length} 字符`);

  const prettyResult = run(target, ["scope", "--pretty"]);
  assert.equal(prettyResult.status, 0, prettyResult.stderr);
  assert.deepEqual(JSON.parse(prettyResult.stdout), compact);
  assert.ok(prettyResult.stdout.trim().split("\n").length > 1);

  const loadResult = run(target, [
    "load",
    "--context", compact.context_options[0].path,
    "--rule", compact.rule_scene_options[0].sceneId,
  ]);
  assert.equal(loadResult.status, 0, loadResult.stderr);
  assert.match(loadResult.stdout, /## CONTEXT 服务0/);
  assert.equal(loadResult.stdout.match(/## RULE A/g)?.length, 7);
});

test("scope 只返回分层字段并按 sceneId、ruleId 排序", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));
  write(target.root, "docs/rules/A01-通用约束-第一条.md", rule("# 第一条标题\n\n必须执行第一条。\n"));
  write(target.root, "docs/rules/A02-通用约束-第二条.md", rule("# 第二条标题\n\n必须执行第二条。\n"));
  write(target.root, "docs/rules/B01-查询接口-查询约束.md", rule("# 查询约束标题\n\n查询必须遵守约束。\n"));

  const result = run(target, ["scope"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    context_mode: "single",
    rule_scene_options: [
      {
        sceneId: "A",
        sceneName: "通用约束",
        rules: [
          { ruleId: "A01", ruleName: "第一条" },
          { ruleId: "A02", ruleName: "第二条" },
        ],
      },
      {
        sceneId: "B",
        sceneName: "查询接口",
        rules: [{ ruleId: "B01", ruleName: "查询约束" }],
      },
    ],
  });
  assert.doesNotMatch(result.stdout, /docs\/rules|正文|必须执行|count|\.md|"(?:code|files|id|name)"/);
  assert.equal(result.stdout.trim().split("\n").length, 1);

  for (const args of [["scope", "--rules", "A"], ["scope", "--pretty", "--rules", "A"]]) {
    const rejected = run(target, args);
    assert.notEqual(rejected.status, 0);
    assert.equal(rejected.stdout, "");
    assert.match(rejected.stderr, /scope：未知参数 --rules/);
    assert.match(rejected.stderr, /-h 查看用法/);
  }
});

test("load 只接受精确 sceneId 或 ruleId，并递归去重", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域", "# 单一业务领域\n\n共享概念正文。\n"));
  write(target.root, "docs/rules/A01-通用约束-基础规则.md", rule("# 基础规则\n\n必须遵守基础规则。\n"));
  write(target.root, "docs/rules/A02-通用约束-跨场景入口.md", rule("# 跨场景入口\n\n必须加载查询规则。\n", ["B01-查询接口-查询规则.md"]));
  write(target.root, "docs/rules/B01-查询接口-查询规则.md", rule("# 查询规则\n\n查询必须加载普通契约。\n", ["../../knowledge/query-contract.md"]));
  write(target.root, "knowledge/query-contract.md", `${references()}# 普通契约\n\n普通文件 Frontmatter 和标题必须保留。\n`);

  const atomic = run(target, ["load", "--rule", "A02"]);
  assert.equal(atomic.status, 0, atomic.stderr);
  assert.doesNotMatch(atomic.stdout, /RULE A01/);
  assert.match(atomic.stdout, /## RULE A02 · 跨场景入口/);
  assert.match(atomic.stdout, /## RULE B01 · 查询规则/);
  assert.match(atomic.stdout, /## REFERENCE knowledge\/query-contract\.md\n\n---\nreferences: \[\]\n---\n# 普通契约/);

  const wholeScene = run(target, ["load", "--compact", "--rule", "A"]);
  assert.equal(wholeScene.status, 0, wholeScene.stderr);
  assert.ok(atomic.stdout.length < wholeScene.stdout.length);

  const mixed = run(target, [
    "load", "--compact",
    "--rule", "A",
    "--rule", "A02",
    "--rule", "B01",
    "--rule", "A01",
  ]);
  assert.equal(mixed.status, 0, mixed.stderr);
  assert.equal(mixed.stdout.match(/## RULE A01/g)?.length, 1);
  assert.equal(mixed.stdout.match(/## RULE A02/g)?.length, 1);
  assert.equal(mixed.stdout.match(/## RULE B01/g)?.length, 1);

  for (const selector of ["Z", "A99", "A02-通用约束-跨场景入口.md", "跨场景入口", "跨场景"]) {
    const unknown = run(target, ["load", "--rule", selector]);
    assert.notEqual(unknown.status, 0);
    assert.equal(unknown.stdout, "");
    assert.match(unknown.stderr, new RegExp(`未知 sceneId 或 ruleId ${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("默认 load 精简 Map、Context 与 RULE，--debug 保持完整原文", (t) => {
  const target = fixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT-MAP.md", "# 项目 Context Map\n\n## Shared Concepts\n\n共享概念保留。\n\n## Contexts\n\n- [订单](../ordering/CONTEXT.md)\n- [结算](../billing/CONTEXT.md)\n\n## Relationships\n\n- 订单 -> 结算\n");
  write(target.root, "ordering/CONTEXT.md", context("订单服务", "# 订单 Context\n\n订单正文第一句。\n订单正文第二句。\n"));
  write(target.root, "billing/CONTEXT.md", context("结算服务", "# 结算 Context\n\n结算正文。\n"));
  write(target.root, "docs/rules/A01-通用约束-项目约束.md", rule("# 项目约束标题\n\n第一句保持原行。\n第二句保持原行。\n", ["../CONTEXT-MAP.md"]));

  const compact = run(target, ["load", "--context", "ordering/CONTEXT.md", "--rule", "A01"]);
  assert.equal(compact.status, 0, compact.stderr);
  const compactAlias = run(target, ["load", "--compact", "--context", "ordering/CONTEXT.md", "--rule", "A01"]);
  assert.equal(compactAlias.status, 0, compactAlias.stderr);
  assert.equal(compactAlias.stdout, compact.stdout);
  assert.match(compact.stdout, /## CONTEXT-MAP docs\/CONTEXT-MAP\.md/);
  assert.match(compact.stdout, /## Shared Concepts[\s\S]*共享概念保留。/);
  assert.match(compact.stdout, /## Relationships[\s\S]*订单 -> 结算/);
  assert.doesNotMatch(compact.stdout, /## Contexts|- \[订单\]/);
  assert.match(compact.stdout, /## CONTEXT 订单服务\n\n订单正文第一句。\n订单正文第二句。/);
  assert.match(compact.stdout, /## RULE A01 · 项目约束标题\n\n第一句保持原行。\n第二句保持原行。/);
  assert.doesNotMatch(compact.stdout, /description:|references:|# 订单 Context|# 项目约束标题/);

  const full = run(target, ["load", "--debug", "--context", "ordering/CONTEXT.md", "--rule", "A01"]);
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
  assert.match(short.stdout, /仅供人类在终端手动查看，Agent 项目知识加载禁止使用/);
  assert.doesNotMatch(short.stdout, /scope --rules|code\/name\/count|code\/name\/files/);
  assert.match(short.stdout, /sceneId\/sceneName\/rules/);
  assert.match(short.stdout, /ruleId\/ruleName/);
  assert.match(short.stdout, /load \[--debug\]/);
  assert.match(short.stdout, /load\s+输出紧凑语义标题/);
  assert.match(short.stdout, /load --debug\s+输出带文件边界的完整原文/);
  assert.match(short.stdout, /--context\s+多 Context 项目可选且可重复/);
  assert.doesNotMatch(short.stdout, /多 Context 项目必选|至少选择一个 --context(?:。|\n)/);
  assert.match(short.stdout, /sceneId 加载整个场景，ruleId 加载单条原子 RULE/);
  assert.doesNotMatch(short.stdout, /basename|完整文件名|文件名片段|ruleName 或|模糊/);

  for (const args of [["scope", "--unknown"], ["load", "--unknown"]]) {
    const result = run(target, args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /-h 查看用法/);
  }
});

test("三个 Hook 只返回小型延迟选择协议", (t) => {
  const target = largeFixture();
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  const nested = path.join(target.root, "nested", "workdir");
  fs.mkdirSync(nested, { recursive: true });

  const expectations = new Map([
    ["UserPromptSubmit", "同任务知识已完整覆盖则继续，否则按以下流程加载。"],
    ["SessionStart", "压缩后按保留任务重新选择并加载知识。"],
    ["SubagentStart", "按当前子任务独立选择并加载知识。"],
  ]);
  const commonProtocol = `1. 以项目根为工作目录，执行：node docs/agents/project-knowledge.mjs scope
2. 根据当前任务与 scope 返回结果，自主选择 Context、sceneId 或 ruleId，执行：node docs/agents/project-knowledge.mjs load [--context <path>]... [--rule <sceneId|ruleId>]...
3. sceneId 加载整个场景，ruleId 加载单条原子 RULE；需要补充知识时可以继续执行 load。
完整返回正文必须遵守；疑问或报错执行 node docs/agents/project-knowledge.mjs -h。`;
  const tails = [];

  for (const event of ["UserPromptSubmit", "SessionStart", "SubagentStart"]) {
    const codex = run(target, ["hook"], nested, JSON.stringify({ hook_event_name: event, model: "gpt-test", source: "compact" }));
    assert.equal(codex.status, 0, codex.stderr);
    const codexContext = JSON.parse(codex.stdout).hookSpecificOutput.additionalContext;

    const claude = run(target, ["hook"], nested, JSON.stringify({ hook_event_name: event, source: "compact" }));
    assert.equal(claude.status, 0, claude.stderr);
    const claudeContext = JSON.parse(claude.stdout).hookSpecificOutput.additionalContext;

    assert.equal(claudeContext, codexContext);
    assert.equal(codexContext, `${expectations.get(event)}\n${commonProtocol}`);
    tails.push(codexContext.slice(codexContext.indexOf("\n") + 1));
    assert.doesNotMatch(codexContext, new RegExp(target.root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(codexContext, /只执行一次|最终只|原子.*优先|场景.*兜底|references/);
    assert.doesNotMatch(codexContext, /直接执行以下命令|查找 Hook|读取脚本源码|搜索命令/);
    assert.doesNotMatch(codexContext, /--compact|--pretty|--debug|context_options|rule_scene_options|docs\/rules\/|\bcode\b|\bfiles\b|filename|basename|ruleName/);
    assert.ok(codexContext.length <= 700, `${event} Hook 文案 ${codexContext.length} 字符`);
  }
  assert.equal(new Set(tails).size, 1);

  const relativeScope = spawnSync(process.execPath, ["docs/agents/project-knowledge.mjs", "scope"], {
    cwd: target.root,
    encoding: "utf8",
  });
  assert.equal(relativeScope.status, 0, relativeScope.stderr);
  assert.equal(JSON.parse(relativeScope.stdout).context_options.length, 8);
  const relativeLoad = spawnSync(process.execPath, [
    "docs/agents/project-knowledge.mjs",
    "load",
    "--context", "ctx-0/CONTEXT.md",
    "--rule", "A01",
  ], { cwd: target.root, encoding: "utf8" });
  assert.equal(relativeLoad.status, 0, relativeLoad.stderr);
  assert.match(relativeLoad.stdout, /## CONTEXT 服务0/);
  assert.match(relativeLoad.stdout, /## RULE A01/);
  const supplementalLoad = spawnSync(process.execPath, [
    "docs/agents/project-knowledge.mjs",
    "load",
    "--context", "ctx-0/CONTEXT.md",
    "--rule", "B01",
  ], { cwd: target.root, encoding: "utf8" });
  assert.equal(supplementalLoad.status, 0, supplementalLoad.stderr);
  assert.match(supplementalLoad.stdout, /## RULE B01/);
  assert.doesNotMatch(supplementalLoad.stdout, /## RULE A01/);
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
  assert.match(warningOutput.hookSpecificOutput.additionalContext, /以项目根为工作目录运行 node docs\/agents\/project-knowledge\.mjs validate-context/);
  assert.doesNotMatch(warningOutput.hookSpecificOutput.additionalContext, new RegExp(target.root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  fs.rmSync(path.join(target.root, "docs", "CONTEXT.md"));
  const silent = run(target, ["hook"], target.root, JSON.stringify({ hook_event_name: "UserPromptSubmit", model: "gpt-test" }));
  assert.equal(silent.status, 0, silent.stderr);
  assert.equal(silent.stdout, "");
});

test("Hook 命令不泄露带空格和特殊字符的绝对脚本路径", (t) => {
  const original = fixture();
  const specialRoot = `${original.root} space-$-'quote`;
  fs.renameSync(original.root, specialRoot);
  const target = { root: specialRoot, script: path.join(specialRoot, "docs", "agents", "project-knowledge.mjs") };
  t.after(() => fs.rmSync(target.root, { recursive: true, force: true }));
  write(target.root, "docs/CONTEXT.md", context("单一业务领域"));

  const result = run(target, ["hook"], target.root, JSON.stringify({ hook_event_name: "UserPromptSubmit", model: "gpt-test" }));
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(output, /node docs\/agents\/project-knowledge\.mjs scope/);
  assert.match(output, /node docs\/agents\/project-knowledge\.mjs -h/);
  assert.doesNotMatch(output, /space-\$|quote\/docs\/agents/);
  assert.doesNotMatch(output, /--compact|--pretty|--debug/);
});

test("布局文档部署结果只保留已选择样式", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "project-knowledge-layout-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  for (const layout of ["single", "multiple"]) {
    const output = path.join(root, layout);
    const result = spawnSync(process.execPath, [LAYOUT_SCRIPT, layout, output], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const domain = fs.readFileSync(path.join(output, "domain.md"), "utf8");
    const contextFormat = fs.readFileSync(path.join(output, "context-format.md"), "utf8");
    const rulesFormat = fs.readFileSync(path.join(output, "rules-format.md"), "utf8");
    for (const content of [domain, contextFormat, rulesFormat]) {
      assert.doesNotMatch(content, /<!-- layout:/);
      assert.doesNotMatch(content, /--compact|--pretty|--debug/);
    }
    if (layout === "single") {
      assert.match(domain, /术语写入 `docs\/CONTEXT\.md`/);
      assert.doesNotMatch(domain, /CONTEXT-MAP/);
      assert.match(contextFormat, /入口为 `docs\/CONTEXT\.md`/);
      assert.doesNotMatch(contextFormat, /CONTEXT-MAP/);
    } else {
      assert.match(domain, /docs\/CONTEXT-MAP\.md/);
      assert.doesNotMatch(domain, /术语写入 `docs\/CONTEXT\.md`/);
      assert.match(contextFormat, /入口为 `docs\/CONTEXT-MAP\.md`/);
      assert.doesNotMatch(contextFormat, /入口为 `docs\/CONTEXT\.md`/);
    }
  }
});

test("setup 仅在新入口验证成功后迁移未定制 read-rules.py", () => {
  const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const instructions = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");
  assert.match(instructions, /新脚本、当前 Hook、两个 validator、`scope` 和代表性 `load` 都验证成功后，删除未定制的旧 `read-rules\.py`/);
  assert.match(instructions, /定制旧脚本未经用户确认不删除/);
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
