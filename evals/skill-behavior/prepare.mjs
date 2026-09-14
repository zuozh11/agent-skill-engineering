import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const directory = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(fs.readFileSync(path.join(directory, "cases.json"), "utf8"));
const [caseId, skillsArgument = path.join(directory, "..", "..", "skills")] = process.argv.slice(2);
const scenario = cases.find((item) => item.id === caseId);
if (!scenario) {
  process.stderr.write(`用法：node evals/skill-behavior/prepare.mjs <${cases.map((item) => item.id).join("|")}> [skills目录]\n`);
  process.exit(1);
}

const runDirectory = fs.mkdtempSync(path.join(os.tmpdir(), `skill-${caseId}-`));
const skills = path.join(runDirectory, "skills");
const workspace = path.join(runDirectory, "workspace");
fs.cpSync(path.resolve(skillsArgument), skills, { recursive: true });
fs.mkdirSync(workspace);

function write(relativePath, contents) {
  const target = path.join(workspace, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

const knowledge = path.join(skills, "setup-agent-skills", "scripts", "project-knowledge.mjs");
write("docs/agents/project-knowledge.mjs", fs.readFileSync(knowledge));
execFileSync(process.execPath, [path.join(skills, "setup-agent-skills", "scripts", "render-layout-docs.mjs"), "single", path.join(workspace, "docs/agents")]);
write("docs/CONTEXT.md", "---\ndescription: 账户与结算服务\n---\n# 账户与结算服务\n\n账户保存通知设置；结算金额以分计。\n");
const rules = [
  ["A01-日志约束-使用项目日志器", "业务代码通过项目日志器记录日志，不使用 console.log。"],
  ["B01-模块约束-采用命名导出", "JavaScript 模块的公共函数采用命名导出。"],
  ["C01-界面约束-样式使用主题变量", "界面 CSS 中的颜色使用项目主题变量。"],
];
for (const [name, body] of rules) {
  write(`docs/rules/${name}.md`, `---\nreferences: []\n---\n# ${name.split("-").at(-1)}\n\n${body}\n`);
}
write("src/checkout.mjs", "export function payable(totalCents, vip) {\n  return totalCents;\n}\n");
write("src/main.mjs", "import { payable } from './checkout.mjs';\nconsole.log(payable(1000, true));\n");
write("docs/PRD.md", "# 结算需求\n\n金额输入为非负整数分。普通客户按原价结算；会员享九折，折后金额向下取整到分。只调整结算金额，不变更日志方式。\n");
write("tests/checkout.test.mjs", "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { payable } from '../src/checkout.mjs';\ntest('普通客户保持原价', () => assert.equal(payable(1000, false), 1000));\ntest('会员九折并向下取整到分', () => { assert.equal(payable(1000, true), 900); assert.equal(payable(101, true), 90); });\n");
const protocol = execFileSync(process.execPath, [path.join(workspace, "docs/agents/project-knowledge.mjs"), "protocol"], { encoding: "utf8" });
write("AGENTS.md", `使用简体中文。样例仓库仅使用本地文件，无生产访问。\n\n${protocol}`);
execFileSync("git", ["init", "-q"], { cwd: workspace });
execFileSync("git", ["add", "."], { cwd: workspace });
execFileSync("git", ["-c", "user.name=Skill Eval", "-c", "user.email=eval@example.invalid", "commit", "-qm", "fixture"], { cwd: workspace });

const entry = scenario.skill === "project-knowledge"
  ? "按工作区 AGENTS.md 中的项目知识协议执行。"
  : `技能入口：${path.join(skills, scenario.skill, "SKILL.md")}。按需从这个 skills 目录读取其他技能。`;
const task = `工作区：${workspace}\n${entry}\n\n${scenario.prompt}\n`;
const taskFile = path.join(runDirectory, "task.txt");
fs.writeFileSync(taskFile, task);
process.stdout.write(JSON.stringify({ caseId, workspace, skills, taskFile }, null, 2) + "\n");
