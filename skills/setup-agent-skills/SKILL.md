---
name: setup-agent-skills
description: 为新仓库搭建 Agent 工作流基础设施。配置任务追踪、分诊标签、领域文档、工作流管线，使 grill-with-docs / to-prd / to-task / impl / retro 等 skill 能正常工作。首次使用工程 skill 前运行，或当 skill 缺少上下文时重新运行。
disable-model-invocation: true
---

# Setup Agent Skills

为目标仓库搭建 Agent 工作流所需的基础配置：

- **任务追踪** — task 文件存放位置和命名约定
- **分诊标签** — 四个规范角色对应的标签字符串
- **领域文档** — `CONTEXT.md` 和 ADR 的布局规则
- **工作流管线** — skill 之间的调用顺序和职责边界

## 流程

### 1. 探索

读取目标仓库的现有状态，不要假设：

- `git remote -v` — 远程仓库信息
- `CLAUDE.md` / `AGENTS.md` — 是否已有 `## Agent skills` 段落
- `CONTEXT.md` / `CONTEXT-MAP.md` — 领域文档是否存在
- `docs/adr/` — 架构决策记录
- `docs/agents/` — 是否已有 skill 配置输出
- `docs/scratch/` — 本地任务追踪目录

### 2. 逐项确认

向用户展示发现，然后**逐项**确认配置。每次只问一个 section，等用户回答后再进入下一个。

假设用户不了解这些概念，每个 section 先用一句话解释用途。

**Section A — 任务追踪。**

> 解释：「任务追踪」决定 PRD 和实施任务存放在哪里。`to-prd`、`to-task`、`impl` 等 skill 需要知道往哪里写文件、从哪里读任务。

固定使用本地 Markdown：任务以文件形式存放在 `docs/scratch/<feature>/` 下。确认用户是否需要调整目录路径或命名约定。

**Section B — 分诊标签。**

> 解释：当 skill 处理任务时，会给任务打上状态标签来驱动流转。这些标签需要和你实际使用的字符串一致，否则 skill 会创建重复标签。

四个规范角色：

- `needs-triage` — 维护者需要评估
- `needs-info` — 等待提报人补充信息
- `ready-for-agent` — 描述完整，AI Agent 可独立处理
- `ready-for-human` — 需要人类开发者实施

默认：每个角色的标签字符串等于其名称。问用户是否需要覆盖。

**Section C — 领域文档布局。**

> 解释：部分 skill（`grill-with-docs`、`diagnose`、`impl`）会读取 `CONTEXT.md` 了解领域术语，读取 `docs/adr/` 了解架构决策。需要确认是单 Context 还是多 Context （monorepo）。

- **单 Context** — 根目录一个 `CONTEXT.md` + `docs/adr/`（大多数仓库）
- **多 Context** — 根目录 `CONTEXT-MAP.md` 指向多个 `CONTEXT.md`（monorepo）

**Section D — 工作流管线。**

> 解释：确认 skill 之间的调用顺序。默认管线如下，如果你的团队有不同的流程可以调整。

默认管线：
```
grill-with-docs → to-prd → to-task → impl → retro
   (收敛)        (PRD)    (拆任务)   (实现)    (复盘)
```

辅助 skill（按需调用，不在主管线中）：
- `diagnose` — 调试 bug
- `zoom-out` — 全局视角
- `prototype` — 原型验证

### 3. 确认并编辑

向用户展示草稿：

- 要添加到 `CLAUDE.md` / `AGENTS.md` 的 `## Agent skills` 段落
- `docs/agents/task-tracker.md` 的内容
- `docs/agents/triage-labels.md` 的内容
- `docs/agents/domain.md` 的内容

让用户在写入前修改。

### 4. 写入

**选择编辑的文件：**

- 如果 `CLAUDE.md` 存在，编辑它
- 否则如果 `AGENTS.md` 存在，编辑它
- 都不存在则询问用户创建哪个

如果 `## Agent skills` 段落已存在，原地更新而非追加重复。

**`## Agent skills` 段落模板：**

```markdown
## Agent skills

### 默认工作流

\```
grill-with-docs → to-prd → to-task → impl
   (收敛)        (PRD)    (拆任务)   (实现)
\```

### 任务追踪

[一行摘要]。详见 `docs/agents/task-tracker.md`。

### 分诊标签

使用默认的四级分诊标签词汇（needs-triage / needs-info / ready-for-agent / ready-for-human）。详见 `docs/agents/triage-labels.md`。

### 领域文档

[一行摘要]。详见 `docs/agents/domain.md`。
```

### ADR 自动提炼

当用户在会话中指出修正（review 反馈、纠偏、指出错误做法），判断该修正是否具有通用性：

- **值得提 ADR**：修正揭示了一个可复现的模式性问题，未来同类场景会再次踩坑
- **不需要 ADR**：一次性笔误、个人偏好、已有 ADR 覆盖的场景

判断为值得时，主动提议创建或更新 ADR，给出标题和一句话摘要，经用户确认后写入 `docs/adr/`。

然后写入配置文件，使用本 skill 目录中的种子模板：

**`docs/agents/` 下：**

- [task-tracker-local.md](./task-tracker-local.md) — 本地 Markdown 任务追踪
- [triage-labels.md](./triage-labels.md) — 标签映射
- [domain.md](./domain.md) — 领域文档消费规则

### 5. 完成

告知用户配置完成，列出哪些 skill 会读取这些文件。提醒用户可以直接编辑 `docs/agents/*.md`——只有切换任务追踪器或从头重来时才需要重新运行本 skill。
