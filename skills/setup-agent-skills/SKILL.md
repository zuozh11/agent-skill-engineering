---
name: setup-agent-skills
description: 为新仓库搭建 Agent 领域文档基础设施。配置 CONTEXT.md 和 RULES 布局，使工程类 skill 能正确读取领域上下文。首次使用工程 skill 前运行，或当 skill 缺少上下文时重新运行。
disable-model-invocation: true
---

# Setup Agent Skills

为目标仓库搭建 Agent 工程 skill 所需的领域文档配置：

- **领域文档** — `CONTEXT.md` 和 RULES（项目规则）的布局规则

## 流程

### 1. 探索

读取目标仓库的现有状态，不要假设：

- `git remote -v` — 远程仓库信息
- `CLAUDE.md` / `AGENTS.md` — 是否已有 `## 领域文档` 段落
- `CONTEXT.md` / `CONTEXT-MAP.md` — 领域文档是否存在
- `docs/rules/` — 探索是否已有规则
- `docs/agents/` — 是否已有 skill 配置输出

### 2. 确认布局

向用户展示发现，然后确认领域文档布局。

假设用户不了解这些概念，先用一句话解释用途。

**领域文档布局：**

> 解释：部分 skill 会读取 `CONTEXT.md` 了解领域术语，读取 `docs/rules/` 了解项目规则（RULES）。需要确认是单 Context 还是多 Context（monorepo）。

- **单 Context** — 根目录一个 `CONTEXT.md` + `docs/rules/`（大多数仓库）
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

**按第 2 步确认的布局选择模板**：单 Context 用「单 Context 模板」，多 Context（monorepo）用「多 Context 模板」。两者的读取/落盘细节都指向 `docs/agents/domain.md`（唯一权威），段落本身只写清本仓库属于哪种布局。

**单 Context 模板：**

```markdown
## 领域文档

单 Context 布局：根目录 `CONTEXT.md` + `docs/rules/`。读取与落盘解析详见 `docs/agents/domain.md`。

做任何与项目相关的任务前，按需查阅以下资源：

- 仓库根目录的 **`CONTEXT.md`**
- **`docs/rules/`** — 项目规则（RULES）。先列出该目录，依据文件名（自描述，说明每条规则管什么）判断哪些与当前任务相关，读取相关规则；拿不准就读。

**CONTEXT 自动提炼**：对话中出现新的业务术语、实体关系或领域概念时，判断是否应补充到 `CONTEXT.md`。是则主动提议追加条目（给出术语和一句话定义），经确认后按 `docs/agents/context-format.md` 格式写入根目录 `CONTEXT.md`。已有定义覆盖的不重复提。

**RULES 自动提炼**：两类触发出现时，判断是否应沉淀为一条规则/约定/约束。是则主动提议（给出标题和一句话摘要），经确认后按 `docs/agents/rules-format.md` 格式写入 `docs/rules/`。

- **修正暴露模式性问题**：用户在会话中指出修正，且揭示了可复现的模式性问题。一次性笔误或已有规则覆盖的不重复提。
- **用户陈述全项目约定/约束**：用户主动陈述一条全项目应遵守的约定或约束（如金额单位、错误码包装、日志规范）。只要满足「项目长期有效 + agent 必须遵守 + 违反就跑偏」即可提议，无需难逆转或权衡。已有规则覆盖的不重复提。

**PRD 自动更新**：用户在会话中指出修正时，判断是否改变了现有 PRD 的范围、验收标准或优先级。是则主动提议更新（给出变更点和理由），无需确认直接写入对应 PRD。

```

**多 Context 模板（monorepo）：**

```markdown
## 领域文档

多 Context 布局（monorepo）：根目录 `CONTEXT-MAP.md` + 各 Context 的 `src/<ctx>/CONTEXT.md`；规则分系统级（根 `docs/rules/`）与 Context 级（`src/<ctx>/docs/rules/`）。完整的读取/落盘解析详见 `docs/agents/domain.md`。

做任何与项目相关的任务前，按需查阅以下资源：

- 根目录 **`CONTEXT-MAP.md`** — 据此定位当前任务相关的 Context，读取该 Context 的 `src/<ctx>/CONTEXT.md`
- **`docs/rules/`（两层）** — 系统级（根 `docs/rules/`）+ 相关 Context 级（`src/<ctx>/docs/rules/`）。各层先列目录，依据文件名判断与当前任务相关的规则读取；拿不准就读。

**CONTEXT 自动提炼**：对话中出现新的业务术语、实体关系或领域概念时，判断是否应补充到对应 Context 的 `CONTEXT.md`。是则主动提议追加条目（给出术语和一句话定义），经确认后按 `docs/agents/context-format.md` 格式写入；写哪个 Context 的 `CONTEXT.md`（及跨 Context 关系写入 `CONTEXT-MAP.md`）见 `docs/agents/domain.md`。已有定义覆盖的不重复提。

**RULES 自动提炼**：两类触发出现时，判断是否应沉淀为一条规则/约定/约束。是则主动提议（给出标题和一句话摘要），经确认后按 `docs/agents/rules-format.md` 格式写入；按作用域落系统级或 Context 级 `docs/rules/`（落点见 `docs/agents/domain.md`）。

- **修正暴露模式性问题**：用户在会话中指出修正，且揭示了可复现的模式性问题。一次性笔误或已有规则覆盖的不重复提。
- **用户陈述全项目约定/约束**：用户主动陈述一条全项目应遵守的约定或约束（如金额单位、错误码包装、日志规范）。只要满足「项目长期有效 + agent 必须遵守 + 违反就跑偏」即可提议，无需难逆转或权衡。已有规则覆盖的不重复提。

**PRD 自动更新**：用户在会话中指出修正时，判断是否改变了现有 PRD 的范围、验收标准或优先级。是则主动提议更新（给出变更点和理由），无需确认直接写入对应 PRD。

```

然后写入配置文件，使用本 skill 目录中的种子模板：

**`docs/agents/` 下：**

- [domain.md](./domain.md) — 领域文档消费规则
- [context-format.md](./context-format.md) → 部署为 `docs/agents/context-format.md` — CONTEXT.md 格式模板
- [rules-format.md](./rules-format.md) → 部署为 `docs/agents/rules-format.md` — RULES 格式模板

### 5. 首次初始化 CONTEXT.md（仅当本次新建时）

仅当第 1 步探索发现 `CONTEXT.md` / `CONTEXT-MAP.md` 之前不存在、本次由本 skill 新建时执行。已存在的 CONTEXT.md **不要**改写。

目的：避免给用户一个空骨架文件，让首次使用就有可用的初始术语表。

**扫描代码库提炼候选术语**——读取仓库源码。识别本项目**特有**的领域概念，**排除**通用编程词汇（参见 `context-format.md` 的规则）。

如果扫描结果不足以提炼出可信术语（如代码量太少、领域不清晰），**保持空骨架**——宁可留空，也不写入低质量术语。告知用户「初始扫描未发现明确的领域术语，CONTEXT.md 将随后续对话按需自动提炼」。

多 Context 布局下，首次种子术语按 Context 归属落到各自的 `src/<ctx>/CONTEXT.md`（落点解析见 `docs/agents/domain.md`）；跨 Context 关系写入根 `CONTEXT-MAP.md`。

### 6. 完成

告知用户配置完成，列出哪些 skill 会读取这些文件。提醒用户可以直接编辑 `docs/agents/*.md`——只有从头重来时才需要重新运行本 skill。
