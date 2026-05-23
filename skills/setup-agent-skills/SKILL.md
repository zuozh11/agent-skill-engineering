---
name: setup-agent-skills
description: 为新仓库搭建 Agent 领域文档基础设施。配置 CONTEXT.md 和 ADR 布局，使工程类 skill 能正确读取领域上下文。首次使用工程 skill 前运行，或当 skill 缺少上下文时重新运行。
disable-model-invocation: true
---

# Setup Agent Skills

为目标仓库搭建 Agent 工程 skill 所需的领域文档配置：

- **领域文档** — `CONTEXT.md` 和 ADR 的布局规则

## 流程

### 1. 探索

读取目标仓库的现有状态，不要假设：

- `git remote -v` — 远程仓库信息
- `CLAUDE.md` / `AGENTS.md` — 是否已有 `## 领域文档` 段落
- `CONTEXT.md` / `CONTEXT-MAP.md` — 领域文档是否存在
- `docs/adr/` — 架构决策记录
- `docs/agents/` — 是否已有 skill 配置输出

### 2. 确认布局

向用户展示发现，然后确认领域文档布局。

假设用户不了解这些概念，先用一句话解释用途。

**领域文档布局：**

> 解释：部分 skill 会读取 `CONTEXT.md` 了解领域术语，读取 `docs/adr/` 了解架构决策。需要确认是单 Context 还是多 Context（monorepo）。

- **单 Context** — 根目录一个 `CONTEXT.md` + `docs/adr/`（大多数仓库）
- **多 Context** — 根目录 `CONTEXT-MAP.md` 指向多个 `CONTEXT.md`（monorepo）

### 3. 确认并编辑

向用户展示草稿：

- 要添加到 `CLAUDE.md` / `AGENTS.md` 的 `## 领域文档` 段落
- `docs/agents/domain.md` 的内容

让用户在写入前修改。

### 4. 写入

**选择编辑的文件：**

- 如果 `CLAUDE.md` 存在，编辑它
- 否则如果 `AGENTS.md` 存在，编辑它
- 都不存在则询问用户创建哪个

如果 `## 领域文档` 段落已存在，原地更新而非追加重复。

**`## 领域文档` 段落模板：**

```markdown
## 领域文档

[一行摘要]。详见 `docs/agents/domain.md`。

做任何与项目相关的任务前，按需查阅以下资源：

- 仓库根目录的 **`CONTEXT.md`**
- **`docs/adr/`** — 阅读与当前工作区域相关的架构决策记录（ADR）

**CONTEXT 自动提炼**：对话中出现新的业务术语、实体关系或领域概念时，判断是否应补充到 `CONTEXT.md`。是则主动提议追加条目（给出术语和一句话定义），经确认后按 `docs/agents/context-format.md` 格式写入。已有定义覆盖的不重复提。

**ADR 自动提炼**：用户在会话中指出修正时，判断是否揭示了可复现的模式性问题。是则主动提议创建 ADR（给出标题和一句话摘要），经确认后按 `docs/adr/TEMPLATE.md` 格式写入 `docs/adr/`。一次性笔误或已有 ADR 覆盖的不重复提。

```

然后写入配置文件，使用本 skill 目录中的种子模板：

**`docs/agents/` 下：**

- [domain.md](./domain.md) — 领域文档消费规则
- [context-format.md](./context-format.md) → 部署为 `docs/agents/context-format.md` — CONTEXT.md 格式模板

**`docs/adr/` 下：**

- [adr-format.md](./adr-format.md) → 部署为 `docs/adr/TEMPLATE.md` — ADR 格式模板

### 5. 完成

告知用户配置完成，列出哪些 skill 会读取这些文件。提醒用户可以直接编辑 `docs/agents/*.md`——只有从头重来时才需要重新运行本 skill。
