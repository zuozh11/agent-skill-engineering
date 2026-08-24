---
name: setup-agent-skills
description: 为仓库初始化或升级 Agent 项目知识基础设施。部署 CONTEXT/RULE 格式、按需加载脚本和当前宿主的项目级 Hook，并迁移旧的全量 RULE 读取入口。首次使用工程 Skill 前运行，或在配置缺失、升级后需要检查漂移时重新运行。
disable-model-invocation: true
---

# Setup Agent Skills

为目标仓库部署项目知识基础设施。`AGENTS.md` / `CLAUDE.md` 标记块与 Codex / Claude Code 项目 Hook 注入同一套协议；无 Hook 宿主按标记块执行。本 Skill 是唯一安装和升级入口。项目运行时只依赖 `docs/agents/project-knowledge.mjs`。`maintain` 返回确认流程与已部署的两份格式文档；`protocol` 返回标记块正文。

## 1. 探索项目

先读取并保留目标项目真实状态：

- 根 `AGENTS.md`、`CLAUDE.md` 及其中已有的项目知识或领域文档段落；
- `docs/CONTEXT.md`、`docs/CONTEXT-MAP.md`、地图声明的 Context 文件和 `docs/rules/`；
- `docs/agents/` 下已有文档、`read-rules.py` 和 `project-knowledge.mjs`；
- 当前宿主的项目配置：Codex 使用 `.codex/hooks.json` 或 `.codex/config.toml`，Claude Code 使用 `.claude/settings.json`；
- 本次运行前的 Git 状态。已有用户改动不得覆盖、暂存或提交。

从子目录或独立子仓库启动时，向上查找已有 Context 入口；如果外层 `CONTEXT-MAP.md` 明确链接当前 Context，使用地图所在项目作为领域文档根。没有既有布局时使用当前项目 Git 根。

根据当前正在执行 Skill 的宿主选择 Codex 或 Claude Code，不根据项目中存在什么指令文件猜测，也不顺带修改另一个宿主的配置。

## 2. 确定布局与迁移内容

- 已存在且有效的单/多 Context 布局保持不变。
- 两个入口都不存在时：仓库只有一个主要业务边界或无法确认多个独立边界，使用 `docs/CONTEXT.md`；确有多个可独立描述的业务 Context，使用 `docs/CONTEXT-MAP.md`。
- 两个入口同时存在，或不同选择会明显改变知识归属时，提问确认。

先确定本次部署采用单 Context 或多 Context，再形成清楚的迁移清单：

- 创建或更新两份格式文档与 `project-knowledge.mjs`；旧 `docs/agents/domain.md`、`maintenance.md` 的去留；
- 需要补充或修正的 Context `description`、需要规范的 Map 链接。`description` 直接使用现有 Map 链接文本、Context 标题或项目既有服务名作为发现列表显示名，不把长业务职责搬入该字段。
- 旧 RULE 文件名、短号或正文引用迁移到场景文件名和 `references`。场景编码按重要程度排列；每个场景从 `01` 连续重编号，场景内序号同样按重要程度排列；在同一候选变更中同步全部入向引用。每个 RULE 都补齐 Frontmatter；无直接引用时使用 `references: []`，已有引用按声明文件所在目录改为相对路径。
- 正文包含多个可独立判断的约束或多章节的 RULE 时，压缩、重排或拆分：先逐项记录原约束，拆出的每个文件保持原子约束，并通过 `references` 保留关系，迁移前后语义不得遗漏。
- 旧 Agent 指令、`read-rules.py` 和旧 Hook 的去留；
- 当前宿主需要新增或更新的三个 Hook。

能从文件名和现有规则内容明确判断场景时直接整理；场景划分或项目定制存在多种合理结果时，展示建议后再询问用户。

## 3. 保护项目定制

本 Skill 内置文件是发布种子，不是覆盖用户内容的理由：

- 当前文件与已知旧官方模板一致时，可以升级为当前种子；
- 文件包含项目术语、自定义流程或其他明显定制时，保留内容，展示当前文件与建议结果，只合并用户确认的部分；
- Agent 指令只维护 `project-knowledge` 标记块；
- Hook 只维护调用 `docs/agents/project-knowledge.mjs hook` 的三个项目级条目；
- 无法可靠识别所有权时，停止该文件的写入并提醒用户，不影响其他只读检查。

不读取或修改用户级、本地级、托管级、插件级 Hook。

## 4. 生成并验证候选快照

在临时目录复制本次迁移涉及的知识文件，先生成完整候选结果，不直接改真实项目：

1. 根据已确定的布局生成两份格式文档，并部署 `scripts/project-knowledge.mjs`。必须运行以下命令生成文档，不得把同时介绍两种布局的源种子直接复制到项目：

   ```bash
   node <setup-agent-skills目录>/scripts/render-layout-docs.mjs <single|multiple> <候选根>/docs/agents
   ```

   生成的 `context-format.md` 只能包含所选布局；`rules-format.md` 为两种布局共用。
2. 保留 Context 正文、共享概念和 Relationships；按迁移清单压缩、拆分、连续重编号 RULE，并同步全部入向 `references`，逐项核对原约束仍有对应落点；同时递归检查所有引用目标，确认缺失、越界和循环均能被验证器明确处理。
3. 在候选根运行：

   ```bash
   node docs/agents/project-knowledge.mjs validate-context
   node docs/agents/project-knowledge.mjs validate-rules
   node docs/agents/project-knowledge.mjs scope
   node docs/agents/project-knowledge.mjs maintain
   node docs/agents/project-knowledge.mjs protocol
   ```

4. 检查 `scope.rule_scene_options` 按 `sceneId` 排序，每项只含 `sceneId`、`sceneName`、`rules`，其中 `rules` 按 `ruleId` 排序且每项只含 `ruleId`、`ruleName`；从返回结果选择代表性 RULE 执行不带 `--context` 的 `load`，多 Context 布局再选择代表性 Context 验证带 `--context` 的加载。项目没有 RULE 时只验证固定 Context 文档。`maintain` 返回确认流程与当前布局的两份格式，无需再读这些文件。`protocol` 返回标记块正文，按原样写入第 7 节标记块。

Node 不可用或候选验证失败时，给出直接错误和失败命令，删除临时快照，真实项目保持不变。

## 5. 部署知识文件

候选快照通过后，展示将创建、更新、重命名和删除的文件。涉及项目定制、RULE 重命名或删除时，在副作用发生前取得用户确认。

只为本轮会修改的真实文件创建恢复副本，然后应用已经验证的候选知识树：

- `context-format.md` → `docs/agents/context-format.md`
- `rules-format.md` → `docs/agents/rules-format.md`
- `scripts/project-knowledge.mjs` → `docs/agents/project-knowledge.mjs`

未定制的 `docs/agents/domain.md`、`maintenance.md` 在部署后删除；有定制则展示后由用户确认。

任一步失败时恢复本轮已修改文件，并报告仍需人工处理的内容。

## 6. 安装当前宿主 Hook

三个事件都调用项目内同一入口：`UserPromptSubmit`、`SessionStart`（只匹配 `compact`）、`SubagentStart`。按当前宿主把对应模板合并进项目配置，字段与事件结构以模板为准，不把模板内容再抄写一遍：

- Codex：[hook-templates/codex-hooks.json](./hook-templates/codex-hooks.json)
- Claude Code：[hook-templates/claude-settings.json](./hook-templates/claude-settings.json)

### Codex

- 项目已有 `.codex/hooks.json` 时，解析 JSON，只合并或更新自己的三个 Hook。
- 项目只使用 `.codex/config.toml` 内联 Hook 时，在文件末尾维护 `# project-knowledge:start` / `# project-knowledge:end` 标记段，把模板中的三个 Hook 等价写入段内；已有完整标记段时原位更新段内内容，不解析或重写标记段外 TOML。
- 两种 Codex Hook 表示同时存在时，只更新已经包含自有 Hook 的那一种；尚未安装时优先写入 `.codex/hooks.json`，并提醒用户 Codex 会合并同层两个来源。
- Hook 命令从当前项目 Git 根定位 `docs/agents/project-knowledge.mjs`，不把安装时绝对路径作为身份。
- 其他 Hook 和配置保持不变；发现相似但无法确认归属的条目时提醒用户，不自动删除。

### Claude Code

- `.claude/settings.json` 不存在时创建，存在时只合并模板中自己的三个 matcher group 和 handler。
- handler 走模板的 `command` + `args`，不经过 shell。
- 重复运行时原位更新同事件、同 matcher、同项目脚本参数的自有 Hook。
- 其他设置、matcher group 和 Hook 保持原语义与顺序；JSON 损坏时停止该文件写入并提醒用户。

安装后检查当前项目配置中每个事件只有一个自有 Hook。信任只做提醒：能在当前宿主真实触发就验证三个事件，不能自动确认时如实报告「Hook 待信任」，不维护额外状态文件。

三个事件的 Hook 输出都不得内联 `scope`、Context 列表或 RULE 路径，只注入延迟选择协议。三个事件仅首句按任务来源变化，其余正文与 `protocol` 的步骤相同：

- `UserPromptSubmit`：同任务知识已完整覆盖则继续，否则按流程加载。
- `SessionStart(compact)`：压缩后按保留任务重新选择并加载知识。
- `SubagentStart`：按当前子任务独立选择并加载知识。

模板中的 `additionalContextLimit` 只负责截断保护，不代替 Hook 文案精简。

## 7. 切换 Agent 指令

在根 `AGENTS.md`、`CLAUDE.md` 中维护以下唯一标记块；两个文件都存在时都更新，但 Hook 仍只安装当前宿主。块内正文必须等于 `node docs/agents/project-knowledge.mjs protocol` 的完整输出：

````markdown
<!-- project-knowledge:start -->
## 项目知识

<protocol 输出>
<!-- project-knowledge:end -->
````

- 已有完整标记块：只替换块内文本。
- 明确匹配旧官方 `## 领域文档` 模板：在原位置迁移为标记块。
- 旧段落包含项目定制：展示保留内容和建议结果，用户确认后合并。
- 没有新旧入口：在文件末尾追加一次。

新脚本、当前 Hook、两个 validator、`scope` 和代表性 `load` 都验证成功后，删除未定制的旧 `read-rules.py` 和旧全量读取入口。定制旧脚本未经用户确认不删除，也不得宣称迁移完成。

## 8. 完成检查

- 两份格式文档和 `project-knowledge.mjs` 已部署；
- 单/多 Context、Map、RULE 场景和跨目录递归引用通过对应 validator；
- 场景编码及场景内序号按重要程度排列，每个场景从 `01` 连续编号；每个 RULE 都有 Frontmatter、非空正文且只表达一个可独立判断的原子约束；Context `description` 是发现列表显示名；
- 当前宿主三个项目 Hook 各有一个，其他配置未被覆盖；
- Agent 指令文件各有一个完整标记块，正文等于 `protocol` 输出，不依赖 Hook 才能加载，不再执行全量 RULE 读取；
- 从项目根及一个子目录触发时，Hook 都只提供延迟选择协议；`scope` 返回的 Context、`sceneId` 与 `ruleId` 足以构造 `load`，完整正文和递归引用由加载结果返回；`maintain` 返回确认流程与当前布局格式；
- 部署后的 `context-format.md` 只描述当前选定的单 Context 或多 Context 布局；候选结果不含 `domain.md`、`maintenance.md`；
- 连续运行本 Skill 第二次不产生重复块、重复 Hook 或无意义文件变化；
- 用户原有改动和项目定制已保留。

最后报告布局、创建或更新的文件、迁移前后 RULE 数量、编号与正文检查、`scope` 结构化发现和紧凑加载证据、跨目录递归加载证据、重复运行的幂等结果、迁移的旧入口、当前宿主 Hook 验证结果，以及仍需用户处理的冲突或信任提醒。
