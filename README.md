# Agent Skills — Engineering

面向开发工程师的 Agent Skill 集合，从 [mattpocock/skills](https://github.com/mattpocock/skills) 改造而来，覆盖大型事项寻路、需求收敛、接口规划、任务切分、实现提交、缺陷诊断、架构改进、代码简化和代码评审。

本仓库去掉外部 Issue Tracker 依赖，使用项目内 `CONTEXT`、`RULE`、PRD、API 清单和轻量任务卡保存上下文；实现阶段按具有业务意义的完整交付单元提交。

## 快速开始

1. 选择下方任一方式安装。Codex、Claude Code 用户优先使用对应插件；需要跨宿主或只安装 Skill 时使用独立 Skill 安装。

2. 在目标仓库中运行 `/setup-agent-skills`。

3. 配置完成后即可使用全部 Skill。

## 安装与更新

### Codex 插件

#### 全局安装

注册仓库 marketplace，并安装插件：

```bash
codex plugin marketplace add zuozh11/agent-skill-engineering
codex plugin add agent-skill-engineering@agent-skill-engineering
```

更新 marketplace 后，重新打开 Codex 或新建任务以加载最新版：

```bash
codex plugin marketplace upgrade agent-skill-engineering
```

### Claude Code 插件

#### 全局安装

```bash
claude plugin marketplace add zuozh11/agent-skill-engineering --scope user
claude plugin install agent-skill-engineering@agent-skill-engineering --scope user
```

更新：

```bash
claude plugin marketplace update agent-skill-engineering
claude plugin update agent-skill-engineering@agent-skill-engineering --scope user
```

### 独立 Skill

项目级安装（默认）：

```bash
npx skills@latest add zuozh11/agent-skill-engineering
```

全局安装：

```bash
npx skills@latest add zuozh11/agent-skill-engineering --global
```

更新项目级或全局 Skill：

```bash
npx skills@latest update --project
npx skills@latest update --global
```

参考：[Codex 插件文档](https://developers.openai.com/codex/plugins/build)、[Claude Code 插件 marketplace 文档](https://docs.anthropic.com/en/docs/claude-code/plugin-marketplaces)。

---

## 工作流管线

```
大型模糊事项: wayfinder → 决策路线清晰

需求产物:  to-prd | to-api | to-task（均可基于当前需求上下文独立调用）
实现提交:  impl → atomic-commit

质量流程:  diagnosing-bugs | code-review | improve-codebase-architecture | simplify-codebase

决策追问:  ask-me

共享设计语言: codebase-design
```

`wayfinder` 和 `improve-codebase-architecture` 为显式调用 Skill；其他 Skill 可按描述自动匹配，也可直接点名调用。

## 为什么要这套流程

### 问题 1：很难一次性把所有逻辑讲清楚

> _不知道怎么和 agent 讲需求，很难一次性把所有逻辑讲清楚。目标、限制、边界和取舍没说完，agent 就会用自己的假设补空白。_

**解法**：`/ask-me` 把决策组织成设计树，按依赖分轮批量逼问，把模糊想法、边界条件和关键取舍都定义清楚。

---

### 问题 2：口头需求没法复盘

> _口头描述散在对话里，缺少整体视图，人工很难回看、评审和发现遗漏。_

**解法**：`/to-prd` 生成 `PRD.md`，把需求固化成可回看、可评审的文档。

---

### 问题 3：需求太大，边界说不清

> _需求横跨多个业务结果时，直接进入实现会让任务边界和验收范围变得模糊。_

**解法**：`/to-task` 按完整业务结果生成轻量任务卡。每张卡只写需求来源、本次做什么、功能规则和验收标准，不预设技术方案、依赖或实施顺序。

---

### 问题 4：实现和提交缺少业务边界

> _按文件、技术层或改动类型拆分实现，容易产生没有独立业务意义、无法整笔回滚的提交。_

**解法**：`/impl` 根据需求分解具有业务意义的提交单元，逐个实现后调用 `/atomic-commit`。需要隔离 worktree 时用 `/impl -w`，需要子 Agent 或 workflow 时用 `/impl -a`。代码评审按需单独调用 `/code-review`。

---

### 问题 5：Agent 听不懂项目术语

> _你说一个业务词，agent 不知道它对应哪个实体、模块，就只能每次重新查代码库，或者用猜的。_

**解法**：`CONTEXT.md` 沉淀项目术语、实体关系和规范命名。项目 Hook 只注入延迟选择协议，Agent 通过默认紧凑的 `scope` 取得可选 Context，最后用一次紧凑加载取得当前任务需要的完整知识。

---

### 问题 6：做过的决策被反复询问

> _数据权限怎么做、用户信息怎么取，这类长期决策不能只留在对话里，否则后续实现很容易绕开它。_

**解法**：`RULE` 按场景记录长期规则和关键决策。`scope` 一次返回按 `sceneId`、`ruleId` 排序的场景和原子规则名称；Agent 按任务相关性选择 `sceneId` 或 `ruleId` 并加载，需要时可继续补充知识，避免机械塞入全部规则正文。

---

## 核心概念

### 项目知识

工作流通过 `项目知识协议 → scope → 按需 load` 使用两类项目知识；需要落盘长期知识时再运行 `maintain`：

- **`CONTEXT.md`** — 项目术语表。定义业务概念、实体关系、规范命名。走项目知识协议的 skill 使用这里的词汇。
- **`RULE`** — 按场景组织的项目规则。`scope` 返回的 `sceneId`、`sceneName`、`ruleId` 和 `ruleName` 帮助 Agent 判断相关性，`references` 声明需要一并加载的直接依赖。

`AGENTS.md` / `CLAUDE.md` 标记块内联同一套协议，无 Hook 的宿主按该块执行。Codex / Claude Code 在 `UserPromptSubmit`、上下文压缩和子 Agent 启动时由项目 Hook 再注入一次；本轮已有同等协议则不必重复执行。Agent 先执行默认输出单行 JSON 的 `scope`，再根据当前任务与返回结果自主选择 Context、`sceneId` 或 `ruleId`；多 Context 项目可只选择 RULE，不强制加载具体 Context。`sceneId` 加载整个场景，`ruleId` 加载单条原子 RULE，需要时可继续执行 `load`。出现项目特有术语或长期规则时运行 `maintain`，按其返回的确认流程和格式落盘，不必再打开这些文件。一次性结论和能从代码确认的事实不记录。同一任务且既有范围足够时直接继续；参数不清或命令报错时运行 `project-knowledge -h`。

> Hook 是知识提示入口，不是安全边界。配置损坏时提醒并继续任务；只有真实使用暴露问题时再增加约束。

### 项目文档布局

领域知识和任务都以 Markdown 文件形式存放在仓库内，不依赖外部服务：

```
docs/
├── CONTEXT.md                ← 项目术语和命名约定
├── agents/
│   ├── context-format.md     ← CONTEXT 与 CONTEXT-MAP 格式
│   ├── rules-format.md       ← RULE 场景、命名与 references
│   └── project-knowledge.mjs ← scope、load、maintain、protocol、hook 与 validator
├── rules/                    ← 项目规则（RULE）
│   ├── A01-通用约束-优先改造现有骨架.md
│   └── C01-校验规则-字段校验用BeanValidation.md
└── scratch/
    └── <NN>-<中文需求名称>/     ← NN 按需求进入仓库的顺序递增
        ├── PRD.md            ← /to-prd 按需产出
        ├── API清单.md        ← /to-api 按需产出
        └── tasks/
            ├── 01-完成业务结果A.md    ← /to-task 按需产出
            └── 02-完成业务结果B.md
```

`<NN>-<中文需求名称>` 的编号表示需求工作目录在 `docs/scratch/` 下的创建顺序；中文需求名称和任务卡名称使用 `CONTEXT.md` 中的统一术语，目录内的任务卡使用独立编号。

> 上面是单 Context 布局（大多数仓库）。monorepo（多 Context）改用 `docs/CONTEXT-MAP.md` 注册各 Context 根目录的 `CONTEXT.md`；RULE 始终统一放在领域文档根目录的 `docs/rules/`。`/setup-agent-skills` 会部署单文件脚本、只安装当前宿主的项目级 Hook，并保护已有 Agent 指令和其他 Hook。

---

## Skill 参考

### 大型事项寻路

[wayfinder](./skills/wayfinder/SKILL.md) 把超过单次 Agent 会话容量、推进路线仍不清晰的事项记录为本地 Markdown 决策地图。它逐张解决决策票，直到迷雾和前沿清空，再按实际需要进入 PRD、API、任务或实现工作流。

### 主管线

| Skill | 用途 |
|-------|------|
| **[to-prd](./skills/to-prd/SKILL.md)** | **将需求上下文整理为可独立评审的 `PRD.md`** |
| **[to-api](./skills/to-api/SKILL.md)** | **将需求上下文规划为公开路由、内部入口、停用入口、对象图与跨接口 ID 的接口清单** |
| **[to-task](./skills/to-task/SKILL.md)** | **按完整业务结果将需求上下文切分为轻量任务卡** |
| **[impl](./skills/impl/SKILL.md)** | **按业务意义分解提交单元并实现；`-w` 使用 worktree，`-a` 使用子 Agent 或 workflow** |
| **[code-review](./skills/code-review/SKILL.md)** | **从 Standards 与 Spec 两个独立维度评审 diff、工作区改动或文件目录 snapshot** |

### 关键辅助

[ask-me](./skills/ask-me/SKILL.md) 使用设计树、当前前沿和分轮追问收口决策，最终输出完整决策树。

`to-prd` 使用它收口需求；`to-api` 和 `impl` 只在存在影响显著且无法自行确认的决策时调用。`to-task` 只切分已有需求上下文，不依赖它。

[codebase-design](./skills/codebase-design/SKILL.md) 提供模块、接口、深度、接缝、adapter、杠杆与局部性的共享设计语言；`impl` 和 `code-review` 在当前范围涉及模块形状时按需加载。

### 其他辅助 Skill

| Skill | 用途 |
|-------|------|
| **[diagnosing-bugs](./skills/diagnosing-bugs/SKILL.md)** | 结构化调试循环：复现 → 最小化 → 假设 → 插桩 → 修复 → 回归测试 |
| **[improve-codebase-architecture](./skills/improve-codebase-architecture/SKILL.md)** | 扫描模块深化机会，生成可视化 HTML 报告，并围绕选中候选收口决策 |
| **[simplify-codebase](./skills/simplify-codebase/SKILL.md)** | 用契约和消费者证据审计或实施代码简化，安全删除偶然复杂度 |
| **[atomic-commit](./skills/atomic-commit/SKILL.md)** | 将具有业务意义的完整交付单元整理为可直接回滚的本地提交 |

### 配置

| Skill | 用途 |
|-------|------|
| **[setup-agent-skills](./skills/setup-agent-skills/SKILL.md)** | 部署项目知识脚本与格式，并安装当前宿主的项目级 Hook |

---

## 与原版的差异

| 原版 (mattpocock/skills) | 本仓库                                              |
|--------------------------|--------------------------------------------------|
| `/wayfinder` 使用 Issue Tracker 保存地图和决策票 | 使用 `docs/scratch/<需求>/WAYFINDER.md` 与 `wayfinder/` 本地 Markdown 文件 |
| 依赖 Issue Tracker 和 triage labels | 使用项目内 `CONTEXT`、`RULE` 和 Markdown 需求材料 |
| `/to-spec` 发布规格到 Issue Tracker | `/to-prd` 在本地生成 PRD |
| `/to-tickets` 发布 tracer-bullet tickets | `/to-task` 生成只描述需求的轻量任务卡 |
| `/implement` 驱动 TDD 并衔接代码评审 | `/impl` 按业务意义实现并调用 `/atomic-commit`；评审保持独立 |
| `/triage` 管理 Issue 分诊状态机 | 移除，本地工作流不维护分诊状态机 |
| 英文 Skill | 翻译核心方法，并接入项目知识与本地授权边界 |

## 通用工作流工具

除工程 skill 外，推荐搭配安装 [mattpocock/skills](https://github.com/mattpocock/skills) 中的通用生产力工具：

| Skill | 用途 |
|-------|------|
| **handoff** | 将当前对话压缩为一份交接文档，以便其他 agent 可以继续后续工作 |
| **writing-great-skills** | 创建和改进可预测、边界清晰的 Skill |

安装命令：

```bash
npx skills@latest add mattpocock/skills \
  -s handoff \
  -s writing-great-skills
```

## 致谢

基于 [Matt Pocock](https://github.com/mattpocock) 的 [skills](https://github.com/mattpocock/skills) 仓库改造；`simplify-codebase` 引自 [tt-a1i/simplify-codebase](https://github.com/tt-a1i/simplify-codebase)。项目知识、业务意义提交和深模块设计分别吸收了 DDD、A Philosophy of Software Design 与 The Pragmatic Programmer 的思想。

## 许可证

本项目基于 [MIT License](./LICENSE) 发布。
