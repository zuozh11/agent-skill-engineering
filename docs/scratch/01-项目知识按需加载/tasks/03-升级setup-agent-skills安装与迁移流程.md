---
Status: ready-for-agent
Blocked by:
  - task: 02-接入Codex与Claude-Code项目Hook.md
    reason: 安装流程必须部署已经可验证的脚本和宿主模板
---

## Parent

[项目知识按需加载 PRD](../PRD.md)

## What to build

升级 `setup-agent-skills`，使 Agent 能在目标项目中部署 V2 文档和脚本、只安装当前宿主的项目级 Hook，并把旧全量读取入口迁移为紧凑的项目知识入口；重复执行不会重复配置或覆盖用户内容。

这是给 Agent 执行的安装流程，不实现独立安装器、通用 TOML/JSON round-trip 框架或信任状态机。

## 现状

- 当前 `skills/setup-agent-skills/SKILL.md` 安装 `read-rules.py`，并要求所有任务全量读取 RULE。
- 当前流程会保留已有种子文件，尚不能部署 `project-knowledge.mjs`、安装宿主 Hook 或迁移旧 Agent 指令。
- 用户项目可能已定制 `AGENTS.md`、`CLAUDE.md` 和 Hook 配置；安装流程必须只维护自己明确拥有的内容。

## 方案设计

### `skills/setup-agent-skills/SKILL.md` — 以 Agent 可执行步骤完成 V2 安装

重写 Skill 主流程，但保留显式调用和现有的单/多 Context 判断：

1. 盘点布局、旧种子、旧指令入口、当前宿主和该宿主的项目级 Hook 配置；不扫描或修改用户级、插件级、托管级 Hook。
2. 在临时目录生成候选知识树，运行两个 validator、`scope` 和代表性 `load`；成功后再应用到真实项目。
3. 部署三份 V2 文档和 `docs/agents/project-knowledge.mjs`。明确匹配旧官方种子的文件可以升级；看得出有用户定制的文件保留并展示差异，由用户决定如何合并。
4. 只配置当前运行 Skill 的宿主。Codex 从项目根使用相对路径；Claude Code 使用 `${CLAUDE_PROJECT_DIR}`。不以安装时绝对路径识别自有 Hook。
5. Codex 没有自有配置时，在现有项目配置末尾追加清楚标记的自有段；重复运行只更新该段。Claude Code 解析项目 `settings.json` 后只合并自己的三个 Hook。其他内容保持不变；无法可靠判断时停止该项写入并提醒用户。
6. Hook 安装后更新 `AGENTS.md`、`CLAUDE.md` 中的 `project-knowledge` 标记块，只替换块内文字；旧段落明显是官方模板时迁移，存在项目定制时先展示再确认。
7. 新入口、Hook 和 CLI 验证通过后删除未定制的旧 `read-rules.py`；已定制旧脚本不自动删除，也不假装迁移完成。
8. 失败时恢复本轮实际改动；信任状态只做提醒，能真实触发就验收，当前环境不能确认时如实报告即可。

### 安装结果 — 单一运行入口

迁移完成后，项目指令只告诉 Agent 遵循 Hook 注入的选择与加载提示，并把知识维护指向 `docs/agents/domain.md`。格式写法留在两个 formatter，运行逻辑留在 MJS，宿主差异留在 Hook 模板，避免同一规则多处维护。

## 验收

- 在空白单 Context 与多 Context fixture 各执行一次 Skill → V2 文档、MJS、当前宿主 Hook 和唯一 Agent 指令标记块落点正确。
- 在同一 fixture 连续执行两次 → 自有段与三个 Hook 不重复，第二次没有无意义文件变化。
- fixture 中加入用户 Agent 指令、其他 Hook 和非目标宿主配置 → 安装后这些内容字节不变，非目标宿主配置不被创建或修改。
- fixture 中放入已定制旧种子或无法判断的 Codex 配置 → Skill 明确展示冲突并停止对应写入，不覆盖用户内容；正常任务不因此被 Hook 阻断。
- 模拟部署中途失败 → 本轮已修改文件恢复；成功路径中旧官方 `read-rules.py` 和旧全量读取入口消失。
