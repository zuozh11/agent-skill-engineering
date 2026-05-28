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
- **`docs/adr/`** — 强制读取全部架构决策记录（ADR），无需判断相关性，每次任务开始前直接全部读取

**CONTEXT 自动提炼**：对话中出现新的业务术语、实体关系或领域概念时，判断是否应补充到 `CONTEXT.md`。是则主动提议追加条目（给出术语和一句话定义），经确认后按 `docs/agents/context-format.md` 格式写入。已有定义覆盖的不重复提。

**ADR 自动提炼**：用户在会话中指出修正时，判断是否揭示了可复现的模式性问题。是则主动提议创建 ADR（给出标题和一句话摘要），经确认后按 `docs/adr/TEMPLATE.md` 格式写入 `docs/adr/`。一次性笔误或已有 ADR 覆盖的不重复提。

**PRD 自动更新**：用户在会话中指出修正时，判断是否改变了现有 PRD 的范围、验收标准或优先级。是则主动提议更新（给出变更点和理由），无需确认直接写入对应 PRD。

```

然后写入配置文件，使用本 skill 目录中的种子模板：

**`docs/agents/` 下：**

- [domain.md](./domain.md) — 领域文档消费规则
- [context-format.md](./context-format.md) → 部署为 `docs/agents/context-format.md` — CONTEXT.md 格式模板

**`docs/adr/` 下：**

- [adr-format.md](./adr-format.md) → 部署为 `docs/adr/TEMPLATE.md` — ADR 格式模板

### 5. 首次初始化 CONTEXT.md（仅当本次新建时）

仅当第 1 步探索发现 `CONTEXT.md` / `CONTEXT-MAP.md` 之前不存在、本次由本 skill 新建时执行。已存在的 CONTEXT.md **不要**改写。

目的：避免给用户一个空骨架文件，让首次使用就有可用的初始术语表。

**扫描代码库提炼候选术语**——读取仓库源码。识别本项目**特有**的领域概念，**排除**通用编程词汇（参见 `context-format.md` 的规则）。

如果扫描结果不足以提炼出可信术语（如代码量太少、领域不清晰），**保持空骨架**——宁可留空，也不写入低质量术语。告知用户「初始扫描未发现明确的领域术语，CONTEXT.md 将随后续对话按需自动提炼」。

### 6. 完成

告知用户配置完成，列出哪些 skill 会读取这些文件。提醒用户可以直接编辑 `docs/agents/*.md`——只有从头重来时才需要重新运行本 skill。
