# Agent Skills — Engineering

面向开发工程师的 Agent Skill 集合，从 [mattpocock/skills](https://github.com/mattpocock/skills) 改造而来，专注于**需求收敛 → 拆解 → 实现**的完整工程管线。

与原版的区别：去掉了 GitHub Issues / Linear 集成和 TDD 流程，改为本地 Markdown 任务追踪 + vertical slice 实现模式，更适合个人开发者或小团队的轻量工作流。

## 快速开始

1. 安装 skill（以 Claude Code 为例）：

```bash
npx skills@latest add https://devcloud.szlanyou.com/gitlab/ly-zuozhi/agent-skill-engineering.git
```

2. 在目标仓库中运行 `/setup-agent-skills`，它会引导你配置：
   - 任务追踪目录（默认 `docs/scratch/`）
   - 分诊标签映射
   - 领域文档布局（单上下文 or monorepo）
   - 工作流管线确认

3. 配置完成后即可使用全部 skill。

## 工作流管线

```
grill-with-docs → to-prd → to-task → impl → [retro]
   (收敛)         (PRD)    (拆任务)   (实现)   (复盘，可选)
```

辅助 skill（按需调用，不在主管线中）：`diagnose`、`zoom-out`、`prototype`、`improve-codebase-architecture`

## 为什么要这套流程

### 问题 1：Agent 做的不是你想要的

最常见的失败模式是对齐不足。你以为 agent 理解了你的意图，结果交付的东西完全不对。

**解法**：在动手之前先做一轮 grilling session。`/grill-with-docs` 会逼你把模糊的想法变成精确的决策，同时把术语沉淀到 `CONTEXT.md`，把架构决策记录到 ADR。

### 问题 2：Agent 输出太啰嗦

Agent 被丢进一个项目，需要自己摸索行话，于是用 20 个词表达 1 个概念能说清的事。

**解法**：共享语言。`CONTEXT.md` 是项目的术语表，所有 skill 都会读取它来保持一致的命名。一旦建立，agent 的输出会显著精简，变量和文件命名也会统一。

### 问题 3：任务太大，实现质量失控

把一个大需求直接丢给 agent，它会试图一次性搞定所有事情，结果代码质量崩塌。

**解法**：vertical slice。`/to-task` 把需求拆成薄的端到端切片，每个切片独立可验证。`/impl` 一次只做一个 task，一个 task = 一个原子提交。小步快走，每步都有反馈。

### 问题 4：代码变成一团泥

Agent 加速了编码，也加速了软件熵。代码库以前所未有的速度变复杂。

**解法**：`/improve-codebase-architecture` 帮你发现"加深"机会——把浅模块变成深模块，提升可测试性和 AI 可导航性。建议每隔几天跑一次。

## 核心概念

### 领域文档

每个 skill 都会读取两类领域文档：

- **`CONTEXT.md`** — 项目术语表。定义业务概念、实体关系、规范命名。所有 skill 输出都使用这里的词汇。
- **`docs/adr/`** — 架构决策记录。记录"为什么这么做"的 hard-to-reverse 决策，防止 agent 重新发明轮子。

这两个文件由 `/grill-with-docs` 在对话中按需创建和更新，不需要提前准备。

### 本地任务追踪

任务以 Markdown 文件形式存放，不依赖外部服务：

```
docs/scratch/<feature-slug>/
├── PRD.md                    ← /to-prd 产出
└── tasks/
    ├── 01-create-schema.md   ← /to-task 产出
    ├── 02-add-api.md
    └── 03-add-ui.md          ← /impl 逐个实现
```

### 分诊标签

四个状态标签驱动任务流转：

| 标签 | 含义 |
|------|------|
| `needs-triage` | 维护者需要评估 |
| `needs-info` | 等待补充信息 |
| `ready-for-agent` | 描述完整，AI Agent 可独立处理 |
| `ready-for-human` | 需要人类开发者实施 |

## Skill 参考

### 主管线

| Skill | 用途 |
|-------|------|
| **[grill-with-docs](./grill-with-docs/SKILL.md)** | 逼问式对话，收敛需求，同步更新 `CONTEXT.md` 和 ADR |
| **[to-prd](./to-prd/SKILL.md)** | 将对话上下文合成为 PRD 文档 |
| **[to-task](./to-task/SKILL.md)** | 将需求拆解为 vertical slice 任务卡 |
| **[impl](./impl/SKILL.md)** | 按任务卡实现代码变更，一个 task = 一个原子提交 |
| **[retro](./retro/SKILL.md)** | （可选）复盘 review 修改，提炼偏差和认知盲区，更新领域文档和行为规则 |

### 辅助 Skill

| Skill | 用途 |
|-------|------|
| **[diagnose](./diagnose/SKILL.md)** | 结构化调试循环：复现 → 最小化 → 假设 → 插桩 → 修复 → 回归测试 |
| **[zoom-out](./zoom-out/SKILL.md)** | 让 agent 跳出当前代码，给出更高层次的全局视角 |
| **[prototype](./prototype/SKILL.md)** | 构建一次性原型验证设计——终端交互验逻辑，或多 UI 变体验视觉 |
| **[improve-codebase-architecture](./improve-codebase-architecture/SKILL.md)** | 发现"加深"机会，把浅模块变深模块，提升可测试性 |

### 配置

| Skill | 用途 |
|-------|------|
| **[setup-agent-skills](./setup-agent-skills/SKILL.md)** | 为新仓库搭建 agent 工作流基础设施，首次使用前运行一次 |

## 安装

```bash
npx skills@latest add https://devcloud.szlanyou.com/gitlab/ly-zuozhi/agent-skill-engineering.git
```

`skills` CLI 会 clone 仓库并列出可用 skill，选择需要的即可安装到 Claude Code / Cursor / Windsurf 等 agent。

前提：机器能通过 git 访问该地址（HTTP 凭证或 SSH key 已配置）。

## 与原版的差异

| 原版 (mattpocock/skills) | 本仓库 |
|--------------------------|--------|
| GitHub Issues / Linear 集成 | 本地 Markdown 文件追踪 |
| `/to-issues` 发布到 GitHub | `/to-task` 生成本地 task 文件 |
| `/tdd` 红绿重构循环 | `/impl` vertical slice 原子提交 |
| `/triage` Issue 分诊状态机 | 简化为四级标签 |
| 英文 | 中文 skill 描述和交互 |

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
