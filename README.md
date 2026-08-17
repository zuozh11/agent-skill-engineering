# Agent Skills — Engineering

面向开发工程师的 Agent Skill 集合，从 [mattpocock/skills](https://github.com/mattpocock/skills) 改造而来，专注于**需求收敛 → 拆解 → 实现 → 评审**的完整工程管线。

与原版的区别：去掉了 GitHub Issues / Linear 集成和 TDD 流程，改为本地 Markdown 任务追踪，并按需求类型使用 vertical slice 或 expand-contract，更适合实际企业项目。

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
主工作流:  to-prd → to-task → impl
          (PRD)   (拆任务)   (实现)

按需评审:  code-review

辅助:  grill-with-docs        research
     （分轮批量追问）       （一手来源调研）

共享参考: codebase-design（模块职责、接口、接缝与测试面的设计语言）
```

其他辅助 skill（按需调用）：`diagnosing-bugs`、`zoom-out`、`resolving-merge-conflicts`、`commit`。

## 为什么要这套流程

### 问题 1：很难一次性把所有逻辑讲清楚

> _不知道怎么和 agent 讲需求，很难一次性把所有逻辑讲清楚。目标、限制、边界和取舍没说完，agent 就会用自己的假设补空白。_

**解法**：`/grill-with-docs` 把决策组织成设计树，按依赖分轮批量逼问，把模糊想法、边界条件和关键取舍都定义清楚。

---

### 问题 2：口头需求没法复盘

> _口头描述散在对话里，缺少整体视图，人工很难回看、评审和发现遗漏。_

**解法**：`/to-prd` 生成 `PRD.md`，把需求固化成可回看、可评审的文档。

---

### 问题 3：需求太大，不能一次实现

> _把一整个模块完整的需求直接交给 agent，它都会试图一次性搞定所有事情，任务边界、提交边界和验证路径都会变模糊。_

**解法**：`/to-task` 把普通需求拆成 vertical slice，把宽范围重构拆成 expand-contract。每张卡前置完成必要调研、主要入口定位和方案选择，明确边界、依赖与验收，使执行者拿到即可直接动手，同时不在任务卡里提前编写实现代码。

---

### 问题 4：多任务实现容易互相污染

> _一次实现多个任务时，依赖顺序、写集冲突、上下文长度和提交边界都会叠在一起，最后很难追踪每个 task 到底改了什么。_

**解法**：`/impl` 按依赖和写集拆分多张任务卡，每张已解锁任务卡必须在彼此隔离的执行上下文中实施；可以使用独立 Agent、fork Agent、独立任务或宿主提供的等效机制，不要求从空白上下文启动。上下文隔离不决定 worktree、执行者或串并行策略。执行时根据实现范围、工作区状态和隔离收益自动选择当前工作区或独立 worktree；需要强制使用 worktree 时调用 `/impl -w`，需要强制使用子 Agent 编排时调用 `/impl -a`，两者可以组合为 `/impl -a -w`。完成验证并检查 staged diff 后原子提交；需要代码评审时单独调用 `/code-review`。

---

### 问题 5：Agent 听不懂项目术语

> _你说一个业务词，agent 不知道它对应哪个实体、模块，就只能每次重新查代码库，或者用猜的。_

**解法**：`CONTEXT.md` 沉淀项目术语、实体关系和规范命名。项目 Hook 只注入延迟选择协议，Agent 通过默认紧凑的 `scope` 取得可选 Context，最后用一次紧凑加载取得当前任务需要的完整知识。

---

### 问题 6：做过的决策被反复询问

> _数据权限怎么做、用户信息怎么取，这类长期决策不能只留在对话里，否则后续实现很容易绕开它。_

**解法**：`RULES` 按场景记录长期规则和关键决策。`scope` 展示场景，`scope --rules` 按需下钻原子 RULE；Agent 汇总相关原子 ID 或整个场景后单次紧凑加载，避免机械塞入全部规则。

---

## 核心概念

### 项目知识

工作流通过 `Hook 延迟协议 → scope → 按需 scope --rules → 单次 load --compact` 使用两类项目知识：

- **`CONTEXT.md`** — 项目术语表。定义业务概念、实体关系、规范命名。所有 skill 输出都使用这里的词汇。
- **`RULES`** — 按场景组织的项目规则。文件名帮助 Agent 判断相关性，`references` 声明需要一并加载的直接依赖。

`UserPromptSubmit`、上下文压缩和子 Agent 启动时，项目 Hook 只注入脚本位置和延迟选择协议。Agent 先用默认紧凑的 `scope` 选择 Context 和可能相关场景，再按需下钻原子 RULE，最终只调用一次 `project-knowledge load --compact`；同一任务且既有范围足够时不重复选择和加载。`scope --full` 与完整 `load` 仅用于诊断。

> Hook 是知识提示入口，不是安全边界。配置损坏时提醒并继续任务；只有真实使用暴露问题时再增加约束。

### 项目文档布局

领域知识和任务都以 Markdown 文件形式存放在仓库内，不依赖外部服务：

```
docs/
├── CONTEXT.md                ← 项目术语和命名约定
├── agents/
│   ├── domain.md             ← 项目知识维护判断与落点
│   ├── context-format.md     ← CONTEXT 与 CONTEXT-MAP 格式
│   ├── rules-format.md       ← RULE 场景、命名与 references
│   └── project-knowledge.mjs ← scope、load、hook 与 validator
├── rules/                    ← 项目规则（RULES）
│   ├── A01-必读-需求范围只做明确要求的最小改动.md
│   └── C01-保存接口-结构性入参优先使用BeanValidation.md
└── scratch/
    └── <NN>-<中文需求名称>/     ← NN 按需求进入仓库的顺序递增
        ├── PRD.md            ← /to-prd 产出
        └── tasks/
            ├── 01-创建数据表.md       ← /to-task 产出
            ├── 02-新增查询接口.md
            └── 03-新增查询页面.md     ← /impl 按依赖实现
```

`<NN>-<中文需求名称>` 的编号表示需求工作目录在 `docs/scratch/` 下的创建顺序；中文需求名称和任务卡名称使用 `CONTEXT.md` 中的统一术语，目录内的任务卡使用独立编号。

> 上面是单 Context 布局（大多数仓库）。monorepo（多 Context）改用 `docs/CONTEXT-MAP.md` 注册各 Context 根目录的 `CONTEXT.md`；RULE 始终统一放在领域文档根目录的 `docs/rules/`。`/setup-agent-skills` 会部署单文件脚本、只安装当前宿主的项目级 Hook，并保护已有 Agent 指令和其他 Hook。

---

## Skill 参考

### 主管线

| Skill | 用途 |
|-------|------|
| **[to-prd](./skills/to-prd/SKILL.md)** | **将对话上下文合成为 `PRD` 文档，并自动判断以前端或后端视角组织需求** |
| **[to-task](./skills/to-task/SKILL.md)** | **将普通需求拆成 vertical slice 任务卡，将宽范围重构拆成 expand-contract 任务卡** |
| **[impl](./skills/impl/SKILL.md)** | **自动选择当前工作区或 worktree，可强制使用子 Agent 编排，完成验证并检查 staged diff 后原子提交** |
| **[code-review](./skills/code-review/SKILL.md)** | **从项目规范与需求符合度两个维度评审 diff 或文件目录快照；手动评审默认关注架构摩擦与重构机会** |

### 关键辅助

[grill-with-docs](./skills/grill-with-docs/SKILL.md) 是主管线之外最重要的辅助 skill：通过“设计树 → 当前前沿 → 批量提问”的对话压力测试方案，挑战术语一致性，主动挖掘和确认领域文档候选知识。

> `to-task`、`impl` 在上下文不足时会自动触发它的追问流程；`to-prd` 首次合成 PRD 前默认必跑一轮（本轮已执行过则跳过）。

[codebase-design](./skills/codebase-design/SKILL.md) 是模块形状的共享参考层：统一模块、接口、深度、接缝、adapter、杠杆与局部性的设计语言。它不自行扫描代码库或推进流程；`to-task` 每次默认加载，`grill-with-docs` 与 `impl` 按需加载，用户发起 `code-review` 时默认加载。

### 其他辅助 Skill

| Skill | 用途 |
|-------|------|
| **[research](./skills/research/SKILL.md)** | 调度后台 Agent 查阅一手来源，并把带引用的结论写入单一 Markdown 文件 |
| **[diagnosing-bugs](./skills/diagnosing-bugs/SKILL.md)** | 结构化调试循环：复现 → 最小化 → 假设 → 插桩 → 修复 → 回归测试 |
| **[zoom-out](./skills/zoom-out/SKILL.md)** | 让 agent 跳出当前代码，给出更高层次的全局视角 |
| **[resolving-merge-conflicts](./skills/resolving-merge-conflicts/SKILL.md)** | 查明双方改动意图，解决并完成正在进行的 merge/rebase 冲突 |
| **[commit](./skills/commit/SKILL.md)** | 生成高质量的约定式提交消息，并按需完成本地提交 |

### 配置

| Skill | 用途 |
|-------|------|
| **[setup-agent-skills](./skills/setup-agent-skills/SKILL.md)** | 部署项目知识脚本与格式，并安装当前宿主的项目级 Hook |

---

## 与原版的差异

| 原版 (mattpocock/skills) | 本仓库                                              |
|--------------------------|--------------------------------------------------|
| 依赖 Issue Tracker 和 triage labels | 不接外部任务系统，只配置 `CONTEXT.md` + `RULES`                |
| `/to-spec` 发布规格到 Issue Tracker | `/to-prd` 写入本地 PRD 文件，并按前端/后端视角组织需求 |
| `/to-tickets` 发布轻量 tracer-bullet tickets | `/to-task` 生成详细方案任务卡，并为宽范围重构提供 expand-contract 拆法 |
| `/implement` 驱动 TDD 并衔接代码评审 | `/impl` 自动选择当前工作区或 worktree，完成验证后原子提交；代码评审按需独立调用 |
| `/triage` 管理 Issue 分诊状态机 | 移除（本地 Markdown 工作流无需 Issue 分诊）                   |
| 英文 skill 描述和交互 | 中文 skill 描述和交互                                   |

## 通用工作流工具

除工程 skill 外，推荐搭配安装 [mattpocock/skills](https://github.com/mattpocock/skills) 中的通用生产力工具：

| Skill | 用途 |
|-------|------|
| **grill-me** | 针对计划或设计进行严苛的面试，直到决策树的每一个分支都得到解决 |
| **handoff** | 将当前对话压缩为一份交接文档，以便其他 agent 可以继续后续工作 |
| **writing-great-skills** | 创建和改进可预测、边界清晰的 Skill |

安装命令：

```bash
npx skills@latest add mattpocock/skills \
  -s grill-me \
  -s handoff \
  -s writing-great-skills
```

## 致谢

基于 [Matt Pocock](https://github.com/mattpocock) 的 [skills](https://github.com/mattpocock/skills) 仓库改造。核心理念——共享语言、vertical slice、深模块——来自 Eric Evans 的 DDD、John Ousterhout 的 A Philosophy of Software Design、以及 The Pragmatic Programmer。

## 许可证

本项目基于 [MIT License](./LICENSE) 发布。
