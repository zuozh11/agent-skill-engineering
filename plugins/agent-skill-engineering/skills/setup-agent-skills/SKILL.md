---
name: setup-agent-skills
description: 为仓库初始化或校验 Agent 领域文档基础设施。创建 CONTEXT.md、RULES 的读取、维护判断与格式配置，并在 AGENTS.md 或 CLAUDE.md 中写入入口。首次使用工程 Skill 前运行，或在配置缺失、升级后需要检查文档漂移时重新运行。
disable-model-invocation: true
---

# Setup Agent Skills

为目标仓库初始化工程 Skill 所需的领域文档基础设施。

**本 Skill 只负责创建入口和基础文件。** 领域文档的读取、维护判断与落盘规则由 `docs/agents/domain.md` 负责，格式分别由 `docs/agents/context-format.md` 和 `docs/agents/rules-format.md` 负责，不在 Agent 指令文件中重复展开。

## 流程

### 1. 探索仓库

读取目标仓库的真实状态：

- `AGENTS.md`、`CLAUDE.md` 及其中已有的 `## 领域文档` 段落；
- 仓库的目录、模块与业务边界；
- `docs/CONTEXT.md`、`docs/CONTEXT-MAP.md`；
- `docs/agents/` 下已有的配置文件。

从子目录或独立子仓库启动时，先按 [domain.md](./domain.md) 的「领域文档根目录」规则向上定位，不得直接把当前 Git 仓库根目录当成领域文档根目录。多 Context 地图已经声明当前 Context 时，以该地图所在目录为根。

首次初始化时领域文件通常不存在，应主要依据代码库结构和业务边界判断布局。已有领域文件只用于识别重复运行和保护现有内容。

如果 `docs/CONTEXT.md` 与 `docs/CONTEXT-MAP.md` 同时存在，停止写入并使用提问工具让用户确认保留哪种布局。

### 2. 确定布局

- **单 Context**：仓库围绕一个主要业务领域组织。普通仓库和无法确认存在独立业务边界的多模块仓库，默认使用此布局。入口为 `docs/CONTEXT.md`。
- **多 Context**：仓库存在多个边界清晰、可独立描述的业务 Context。入口为 `docs/CONTEXT-MAP.md`，由它声明各 Context 的位置和关系。

不要因为目录多或使用 monorepo 就自动选择多 Context。只有布局确实无法判断时，才使用提问工具让用户确认。

### 3. 写入 Agent 指令入口

使用下方入口模板更新 Agent 指令文件中的 `## 领域文档` 段落：

- `AGENTS.md` 和 `CLAUDE.md` 都存在：两者都更新；
- 只有一个存在：更新现有文件；
- 都不存在：创建当前宿主使用的标准指令文件；无法判断当前宿主时再询问用户。

已有 `## 领域文档` 段落时原地替换，不重复追加。只替换该段落，不改动文件中的其他内容。

```markdown

---

## 领域文档

<布局说明>。

执行项目任务时，按 `docs/agents/domain.md` 定位并读取相关 `CONTEXT.md` 与 RULES。

任务中自然出现新的项目特有术语、实体或 Context 关系、规范命名或长期项目规则时，按 `docs/agents/domain.md` 的维护流程自行判断是否值得记录；不要为了维护文档而强行扩展每个任务。

满足记录条件且现有文档未覆盖时，先提出候选内容、依据和落点；经用户确认且当前任务允许写入后再更新。不得借此扩大当前任务的写入范围，也不得静默覆盖与现有文档或代码冲突的内容。
```

写入时将 `<布局说明>` 替换为：

- 单 Context：本仓库采用单 Context 布局，入口为 `docs/CONTEXT.md`
- 多 Context：本仓库采用多 Context 布局，入口为 `docs/CONTEXT-MAP.md`

### 4. 写入领域文档基础文件

将本 Skill 目录中的种子文件部署到目标仓库：

- [domain.md](./domain.md) → `docs/agents/domain.md`
- [context-format.md](./context-format.md) → `docs/agents/context-format.md`
- [rules-format.md](./rules-format.md) → `docs/agents/rules-format.md`

缺失的文件直接创建。已有文件默认保留，不覆盖用户修改；只有用户明确要求刷新模板时，才对比并更新。

已有文件不得只因存在就跳过检查。逐项对照本 Skill 的当前种子文件，区分：

- **内容定制**：项目术语、Context 列表、共享概念和关系等项目事实，必须保留；
- **规则漂移**：与当前 `domain.md`、`context-format.md`、`rules-format.md` 冲突的旧版布局或命名规则，以及缺失的当前必备流程，必须报告。

多 Context 仓库至少搜索以下旧版痕迹：Context 级 `docs/rules/`、`Context 级 RULES`、`SYS-NN`、`<CTX>-NN`、规则文件名前缀、各层独立编号。发现规则漂移时停止自动写入，使用提问工具列出冲突文件和推荐的最小迁移；只有用户明确同意刷新或迁移后才修改，且不得覆盖项目事实。

同时检查已部署的 `docs/agents/domain.md` 是否包含「维护判断与落盘」流程。如果缺失，将其视为规则漂移，避免 Agent 指令已引用维护流程、目标文件却没有对应规则。

根据布局创建缺失的入口文件：

- 单 Context：按 `docs/agents/context-format.md` 创建 `docs/CONTEXT.md` 骨架；
- 多 Context：按 `docs/agents/context-format.md` 创建 `docs/CONTEXT-MAP.md`，并为已识别的各 Context 创建对应的 `docs/CONTEXT.md` 骨架。

已存在的 `CONTEXT.md`、`CONTEXT-MAP.md` 不改写。

### 5. 初始化领域术语

仅对本次新建的 `CONTEXT.md` 执行轻量代码扫描，提炼高置信度的项目特有术语：

- 排除依赖、生成物、第三方代码和通用编程概念；
- 定义遵循 `docs/agents/context-format.md`；
- 多 Context 下按 `docs/agents/domain.md` 确定术语归属；
- 无法提炼出可信术语时保留空骨架，不为填充文件而制造术语。

### 6. 验证并完成

写入后检查：

- 每个目标 Agent 指令文件中只有一个 `## 领域文档` 段落；
- `docs/agents/domain.md`、`context-format.md`、`rules-format.md` 均存在；
- `docs/agents/domain.md` 包含「维护判断与落盘」流程，Agent 指令中对应入口可解析；
- 当前布局的入口文件存在；
- 多 Context 下 `CONTEXT-MAP.md` 指向的 Context 文件真实存在；
- 从任一已声明 Context 目录启动时，都能回溯到同一个领域文档根目录；
- `CONTEXT-MAP.md`、`docs/agents/*.md` 与实际 `docs/rules/` 布局不存在互相矛盾的旧版规则；
- 已有领域文档和用户修改没有被意外覆盖。

最后向用户说明采用的布局、创建或更新的文件，以及初始术语提炼结果。

## 重复运行

- 缺失文件直接补齐；
- Agent 指令中的 `## 领域文档` 段落更新为当前入口模板；
- 已有领域文档和 `docs/agents/*.md` 默认保留，但必须执行规则漂移检查；
- 布局冲突、规则漂移或需要刷新已有模板时，先交由用户确认，再做最小迁移。
