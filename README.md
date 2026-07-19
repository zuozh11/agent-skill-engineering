# Agent Skills — Engineering

面向开发工程师的 Agent Skill 集合，从 [mattpocock/skills](https://github.com/mattpocock/skills) 改造而来，专注于**需求收敛 → 拆解 → 实现 → 评审**的完整工程管线。

与原版的区别：去掉了 GitHub Issues / Linear 集成和 TDD 流程，改为本地 Markdown 任务追踪，并按需求类型使用 vertical slice 或 expand-contract，更适合实际企业项目。

## 快速开始

1. 安装/更新 skill：

```bash
npx skills@latest add zuozh11/agent-skill-engineering
```

2. 在目标仓库中运行 `/setup-agent-skills`。

3. 配置完成后即可使用全部 skill。

---

## 工作流管线

```
完整工作流:  to-prd → to-task → impl → code-review
            (PRD)   (拆任务)   (实现)   (评审)

辅助:  grill-with-docs
     （分轮批量追问，自动触发）
```

其他辅助 skill（按需调用）：`diagnose`、`zoom-out`、`prototype`、`improve-codebase-architecture`、`commit`。

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

**解法**：`/impl` 按任务依赖分批调度独立 worktree 中的子 Agent，由子 Agent形成原子提交、主 Agent按序集成并维护任务状态。

---

### 问题 5：Agent 听不懂项目术语

> _你说一个业务词，agent 不知道它对应哪个实体、模块，就只能每次重新查代码库，或者用猜的。_

**解法**：`CONTEXT.md` 沉淀项目术语、实体关系和规范命名，让 agent 先有领域词典；同时让 PRD、任务卡和代码使用同一套语言，减少术语漂移。

---

### 问题 6：做过的决策被反复询问

> _数据权限怎么做、用户信息怎么取，这类长期决策不能只留在对话里，否则后续实现很容易绕开它。_

**解法**：`RULES` 记录通用的、难逆转的决策：为什么这样做、放弃什么、何时重审。所有主线 skill 都会按需查阅相关 `RULES`，避免重复争论已经定下来的约束。

---

## 核心概念

### 领域文档

工作流会读取两类项目知识：

- **`CONTEXT.md`** — 项目术语表。定义业务概念、实体关系、规范命名。所有 skill 输出都使用这里的词汇。
- **`RULES`** — 项目规则。把项目长期有效的关键决策与约定（架构、选型、错误码、单位、命名等）显式写下来供 agent 遵守，防止实现跑偏。

> 任务中自然出现候选知识时，Agent 按全局维护规则自行判断是否值得写入 `CONTEXT.md` 或 RULES；不强制每个任务维护文档。

### 项目文档布局

领域知识和任务都以 Markdown 文件形式存放在仓库内，不依赖外部服务：

```
docs/
├── CONTEXT.md                ← 项目术语和命名约定
├── agents/                   ← 消费规则 domain.md + 格式模板 context-format.md / rules-format.md
├── rules/                    ← 项目规则（RULES）
│   ├── 01-数据权限-按部门隔离.md
│   └── 02-接口错误码-统一包装.md
└── scratch/
    └── <NN>-<中文需求名称>/     ← NN 按需求进入仓库的顺序递增
        ├── PRD.md            ← /to-prd 产出
        └── tasks/
            ├── 01-创建数据表.md       ← /to-task 产出
            ├── 02-新增查询接口.md
            └── 03-新增查询页面.md     ← /impl 按依赖实现
```

`<NN>-<中文需求名称>` 的编号表示需求工作目录在 `docs/scratch/` 下的创建顺序；中文需求名称和任务卡名称使用 `CONTEXT.md` 中的统一术语，目录内的任务卡使用独立编号。

> 上面是单 Context 布局（大多数仓库）。monorepo（多 Context）改用 `docs/CONTEXT-MAP.md` 指向各 Context 根目录的 `CONTEXT.md`（Context 目录位置由地图声明，不限于 `src/`）；RULES 不随 Context 拆分，始终统一放在领域文档根目录的 `docs/rules/`。即使从独立子仓库启动，也要沿地图回溯到该根目录；重复运行 `/setup-agent-skills` 会检查旧版布局与当前规则是否漂移。两种布局的读取、维护判断与落盘解析统一见 `docs/agents/domain.md`。

---

## Skill 参考

### 主管线

| Skill | 用途 |
|-------|------|
| **[to-prd](./skills/to-prd/SKILL.md)** | **将对话上下文合成为 `PRD` 文档，并自动判断以前端或后端视角组织需求** |
| **[to-task](./skills/to-task/SKILL.md)** | **将普通需求拆成 vertical slice 任务卡，将宽范围重构拆成 expand-contract 任务卡** |
| **[impl](./skills/impl/SKILL.md)** | **按任务依赖隔离实现，由主 Agent集成原子提交并维护状态** |
| **[code-review](./skills/code-review/SKILL.md)** | **从项目规范与需求符合度两个独立维度评审代码变更** |

### 关键辅助

[grill-with-docs](./skills/grill-with-docs/SKILL.md) 是主管线之外最重要的辅助 skill：通过“设计树 → 当前前沿 → 批量提问”的对话压力测试方案，挑战术语一致性，主动挖掘和确认领域文档候选知识。

> `to-task`、`impl` 在上下文不足时会自动触发它的追问流程；`to-prd` 首次合成 PRD 前默认必跑一轮（本轮已执行过则跳过）。

### 其他辅助 Skill

| Skill | 用途 |
|-------|------|
| **[diagnose](./skills/diagnose/SKILL.md)** | 结构化调试循环：复现 → 最小化 → 假设 → 插桩 → 修复 → 回归测试 |
| **[zoom-out](./skills/zoom-out/SKILL.md)** | 让 agent 跳出当前代码，给出更高层次的全局视角 |
| **[prototype](./skills/prototype/SKILL.md)** | 构建一次性原型验证设计——终端交互验逻辑，或多 UI 变体验视觉 |
| **[improve-codebase-architecture](./skills/improve-codebase-architecture/SKILL.md)** | 找出职责分散、重复、难测试的代码，并给出重构建议 |
| **[commit](./skills/commit/SKILL.md)** | 生成高质量的约定式提交消息，并按需完成本地提交 |

### 配置

| Skill | 用途 |
|-------|------|
| **[setup-agent-skills](./skills/setup-agent-skills/SKILL.md)** | 初始化领域文档基础设施，并写入维护判断入口 |

---

## 与原版的差异

| 原版 (mattpocock/skills) | 本仓库                                              |
|--------------------------|--------------------------------------------------|
| 依赖 Issue Tracker 和 triage labels | 不接外部任务系统，只配置 `CONTEXT.md` + `RULES`                |
| `/to-spec` 发布规格到 Issue Tracker | `/to-prd` 写入本地 PRD 文件，并按前端/后端视角组织需求 |
| `/to-tickets` 发布轻量 tracer-bullet tickets | `/to-task` 生成详细方案任务卡，并为宽范围重构提供 expand-contract 拆法 |
| `/implement` 驱动 TDD 并衔接代码评审 | `/impl` 隔离实现并原子集成，`/code-review` 按需单独评审 |
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
