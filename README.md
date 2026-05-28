# Agent Skills — Engineering

面向开发工程师的 Agent Skill 集合，从 [mattpocock/skills](https://github.com/mattpocock/skills) 改造而来，专注于**需求收敛 → 拆解 → 实现**的完整工程管线。

与原版的区别：去掉了 GitHub Issues / Linear 集成和 TDD 流程，改为本地 Markdown 任务追踪 + vertical slice 实现模式，更适合实际企业项目。

## 快速开始

1. 安装/更新 skill：

```bash
npx skills@latest add https://devcloud.szlanyou.com/gitlab/ly-zuozhi/agent-skill-engineering.git
```

2. 在目标仓库中运行 `/setup-agent-skills`。

3. 配置完成后即可使用全部 skill。

---

## 工作流管线

```
主线:  to-prd → to-task → impl 
      (PRD)   (拆任务)   (实现)
      
辅助:  grill-with-docs
     （追问对齐，任一阶段上下文不足时触发）
```

其他辅助 skill（按需调用）：`retro`、`diagnose`、`zoom-out`、`prototype`、`improve-codebase-architecture`、`commit`。

## 为什么要这套流程

### 问题 1：很难一次性把所有逻辑讲清楚

> _不知道怎么和 agent 讲需求，很难一次性把所有逻辑讲清楚。目标、限制、边界和取舍没说完，agent 就会用自己的假设补空白。_

**解法**：`/grill-with-docs` 通过逼问强迫你补齐上下文，把模糊想法、边界条件和关键取舍都定义清楚。

---

### 问题 2：口头需求没法复盘

> _口头描述散在对话里，缺少整体视图，人工很难回看、评审和发现遗漏。_

**解法**：`/to-prd` 生成 `PRD.md`，把需求固化成可回看、可评审的文档。

---

### 问题 3：需求太大，不能一次实现

> _把一整个模块完整的需求直接交给 agent，它都会试图一次性搞定所有事情，任务边界、提交边界和验证路径都会变模糊。_

**解法**：`/to-task` 把需求拆成 vertical slice 任务卡。每张卡都有清晰边界、依赖和验收项，方便人工先评审，再交给 agent 实现。

---

### 问题 4：多任务实现容易互相污染

> _一次实现多个任务时，依赖顺序、写集冲突、上下文长度和提交边界都会叠在一起，最后很难追踪每个 task 到底改了什么。_

**解法**：`/impl` 把实现变成受控流程：多任务时编排子 Agent 隔离上下文；验证通过后按完成单元原子提交。

---

### 问题 5：Agent 听不懂项目术语

> _你说一个业务词，agent 不知道它对应哪个实体、模块，就只能每次重新查代码库，或者用猜的。_

**解法**：`CONTEXT.md` 沉淀项目术语、实体关系和规范命名，让 agent 先有领域词典；同时让 PRD、任务卡和代码使用同一套语言，减少术语漂移。

---

### 问题 6：做过的决策被反复询问

> _数据权限怎么做、用户信息怎么取，这类长期决策不能只留在对话里，否则后续实现很容易绕开它。_

**解法**：`ADR` 记录通用的、难逆转的决策：为什么这样做、放弃什么、何时重审。所有主线 skill 都会读取 `ADR`，避免重复争论已经定下来的约束。

---

## 核心概念

### 领域文档

工作流会读取三类项目知识：

- **`CONTEXT.md`** — 项目术语表。定义业务概念、实体关系、规范命名。所有 skill 输出都使用这里的词汇。
- **`ADR`** — 架构决策记录。记录"为什么这么做"的 hard-to-reverse 决策，防止 agent 重新发明轮子。

> `CONTEXT.md` 和 `ADR` 在对话中按需创建和更新。

### 项目文档布局

领域知识和任务都以 Markdown 文件形式存放在仓库内，不依赖外部服务：

```
CONTEXT.md                    ← 项目术语和命名约定
docs/
├── adr/                      ← 架构决策记录
│   ├── 0001-record-architecture-decision.md
│   └── 0002-choose-module-boundary.md
└── scratch/
    └── <feature-slug>/
        ├── PRD.md            ← /to-prd 产出
        └── tasks/
            ├── 01-create-schema.md   ← /to-task 产出
            ├── 02-add-api.md
            └── 03-add-ui.md          ← /impl 逐个实现
```

---

## Skill 参考

### 主管线

| Skill | 用途 |
|-------|------|
| **[to-prd](./skills/to-prd/SKILL.md)** | **将对话上下文合成为 `PRD` 文档，并自动判断以前端或后端视角组织需求** |
| **[to-task](./skills/to-task/SKILL.md)** | **将需求拆解为便于人工评审的 vertical slice 任务卡** |
| **[impl](./skills/impl/SKILL.md)** | **按任务卡实现代码变更，一个 task = 一个原子提交。多任务时自动评估开发模式（顺序 / 子 Agent 顺序 / 子 Agent 并行）** |

### 关键辅助

[grill-with-docs](./skills/grill-with-docs/SKILL.md) 是主管线之外最重要的辅助 skill：通过逼问式对话压力测试方案，挑战术语一致性，并把确定的概念沉淀到 `CONTEXT.md`、把权衡决策记录为 `ADR`。

> `to-prd`、`to-task`、`impl` 在上下文不足时会自动触发它的追问流程。

### 其他辅助 Skill

| Skill | 用途 |
|-------|------|
| **[retro](./skills/retro/SKILL.md)** | 复盘会话，必要时更新 `PRD` 或 `ADR` |
| **[diagnose](./skills/diagnose/SKILL.md)** | 结构化调试循环：复现 → 最小化 → 假设 → 插桩 → 修复 → 回归测试 |
| **[zoom-out](./skills/zoom-out/SKILL.md)** | 让 agent 跳出当前代码，给出更高层次的全局视角 |
| **[prototype](./skills/prototype/SKILL.md)** | 构建一次性原型验证设计——终端交互验逻辑，或多 UI 变体验视觉 |
| **[improve-codebase-architecture](./skills/improve-codebase-architecture/SKILL.md)** | 找出职责分散、重复、难测试的代码，并给出重构建议 |
| **[commit](./skills/commit/SKILL.md)** | 加载并按需补充 `CONTEXT.md` 术语，生成约定式提交 |

### 配置

| Skill | 用途 |
|-------|------|
| **[setup-agent-skills](./skills/setup-agent-skills/SKILL.md)** | 配置领域文档和工作流管线，首次使用前运行一次 |

---

## 与原版的差异

| 原版 (mattpocock/skills) | 本仓库                                              |
|--------------------------|--------------------------------------------------|
| 依赖 Issue Tracker 和 triage labels | 不接外部任务系统，只配置 `CONTEXT.md` + `ADR`                |
| `/to-prd` 发布 PRD 到 Issue Tracker | `/to-prd` 写入本地PRD文件，并按前端/后端视角组织需求                |
| `/to-issues` 发布 vertical slice issues | `/to-task` 生成便于人工评审的本地任务卡，包含改动文件、代码片段、依赖和验收项     |
| `/tdd` 红绿重构循环 | `/impl` 按任务或口头描述执行实现，加载项目约束，必要时编排子 Agent，验证后原子提交 |
| `/triage` 管理 Issue 分诊状态机 | 移除（本地 Markdown 工作流无需 Issue 分诊）                   |
| 英文 skill 描述和交互 | 中文 skill 描述和交互                                   |

## 通用工作流工具

除工程 skill 外，推荐搭配安装 [mattpocock/skills](https://github.com/mattpocock/skills) 中的通用生产力工具：

| Skill | 用途 |
|-------|------|
| **caveman** | 超压缩沟通模式，去除填充词同时保持技术准确性，可减少约 75% 的 token 使用量 |
| **grill-me** | 针对计划或设计进行严苛的面试，直到决策树的每一个分支都得到解决 |
| **handoff** | 将当前对话压缩为一份交接文档，以便其他 agent 可以继续后续工作 |
| **write-a-skill** | 创建具有适当结构、渐进式披露和捆绑资源的新 skill |

安装命令：

```bash
npx skills@latest add mattpocock/skills -s caveman,grill-me,handoff,write-a-skill
```

## 致谢

基于 [Matt Pocock](https://github.com/mattpocock) 的 [skills](https://github.com/mattpocock/skills) 仓库改造。核心理念——共享语言、vertical slice、深模块——来自 Eric Evans 的 DDD、John Ousterhout 的 A Philosophy of Software Design、以及 The Pragmatic Programmer。
