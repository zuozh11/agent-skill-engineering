# 项目知识按需加载 PRD

## Solution

通过 Hook 和统一 CLI 建立两阶段项目知识加载流程：

1. Hook 调用 `project-knowledge scope`，把可选 CONTEXT、RULE 场景和选择协议注入 Agent。
2. Agent 根据当前任务选择所有可能相关的范围，只调用一次 `project-knowledge load`。
3. `load` 固定加入当前布局的根级领域文档，加载所选 CONTEXT、所选 RULE 场景及 RULE 递归引用，一次性返回带路径分隔的完整正文。

单 Context 项目不选择 CONTEXT，`load` 固定返回 `docs/CONTEXT.md`；多 Context 项目由 Agent 选择具体 CONTEXT，`load` 固定返回 `docs/CONTEXT-MAP.md`。RULE 始终按场景选择，“必读”与其他场景使用相同机制，不自动加入。

Agent 不自行搜索领域文档路径，不逐个读取或拼接正文。CLI 负责发现领域文档根目录、校验范围、展开场景与引用。

项目知识 CLI 由 Agent Skills Engineering 插件中的 `setup-agent-skills` Skill 统一部署为项目内单文件 `docs/agents/project-knowledge.mjs`。该 Skill 同时根据当前执行它的 Agent 宿主安装对应 Hook 适配配置。核心知识发现、加载与校验逻辑属于项目产出物，Agent 专属部分只负责事件绑定、输入输出协议转换和调用项目脚本。

本仓库只用于方案设计和真实产出物验证；本阶段不安装脚本、不设置 Hook，也不修改 `docs/agents/`。设计确认后，本文档移交插件仓库实施、测试和发布。

## Scope

### 本仓库设计范围

- 使用现有 CONTEXT 和 40 条 RULE 验证布局发现、范围枚举、场景展开、引用递归和合并输出。
- 明确 CONTEXT 元数据、CLI 契约、Hook 行为、插件落点和验收标准。
- 产出可直接移交 Agent Skills Engineering 插件仓库的需求契约。
- 不新增 CLI、Hook 配置、Skill 实现或验证性原型。

### 后续插件仓库实施范围

- 在 `setup-agent-skills` 中提供并部署 `docs/agents/project-knowledge.mjs`，替代现有 `read-rules.py`。
- 实现对外的 `project-knowledge scope`、`project-knowledge load` 和供 Hook 调用的内部 `project-knowledge hook`。
- 根据当前 Agent 宿主安装其支持的 `UserPromptSubmit`、`SessionStart(compact)`、`SubagentStart` 同步 Hook；不同宿主使用各自的事件名和响应协议适配层。
- 更新 Agent 指令入口，使 Agent 只通过 Hook 提供的范围和命令加载项目知识，不再要求 `read-rules.py` 全量读取 RULE。
- 提供 CONTEXT 布局、CONTEXT 元数据、RULE 文件名、场景映射和引用有效性校验。
- 更新 Skill 库中的 CONTEXT/RULE 使用说明与创建规范。

### 项目产出物

- 单 Context 项目继续使用 `docs/CONTEXT.md`。
- 多 Context 项目继续使用 `docs/CONTEXT-MAP.md` 和地图声明的 `<ctx-dir>/CONTEXT.md`。
- 全项目 RULE 继续存放在领域文档根目录的 `docs/rules/`。
- 项目知识脚本固定为 `docs/agents/project-knowledge.mjs`，由 `setup-agent-skills` 安装和升级。
- 不建立 RULE 索引、场景清单或额外的 Context 注册表。
- 本仓库设计阶段不修改 `.codex/`、`.claude/`、`scripts/`、`docs/agents/` 和插件安装配置；插件实施后的真实安装会按目标 Agent 写入对应配置。

## Out of Scope

- 不在本仓库实现、安装、启用或试运行 CLI 和 Hook。
- 不把项目知识核心脚本长期放在插件运行目录，也不为不同 Agent 维护多份核心实现。
- 不自动选择 CONTEXT 或 RULE 场景。
- 不根据用户提示、正文关键词或模型推断选择范围。
- 不为被引用 RULE 扩展其所属场景。
- 不建立 RULE 索引、场景配置文件或编号注册表。
- 不使用 `PreToolUse` 阻止直接读取，不使用 `Stop` 检查是否已经加载知识。
- 不使用 `PostToolUse`、`PermissionRequest`、`SessionEnd` 等其他 Hook。
- 不把 Hook 当作安全边界。

## Document Contracts

### `docs/agents/` V2

`docs/agents/` 完整改写为以下职责边界：

```text
docs/agents/
├── domain.md                 # 何时维护知识、写到哪里、冲突如何处理
├── context-format.md         # CONTEXT 与 CONTEXT-MAP 的唯一格式规范
├── rules-format.md           # RULE 创建、命名、引用、重命名与删除规范
└── project-knowledge.mjs     # scope、load、hook、validate-context、validate-rules
```

- `domain.md` 不再承担运行时知识加载。Hook 与 `project-knowledge.mjs` 是加载协议的唯一真源。
- 两个 formatter 只定义作者应写成什么样，不重复 Hook、CLI 或根目录发现流程。
- `validate-context`、`validate-rules` 两个子命令把 formatter 中可机器判断的约束落成确定性校验。
- 所有子命令调用单文件内同一套解析与校验函数，不存在跨脚本重复实现。
- Agent 指令只保留加载入口和维护指针，不复制格式细则。

三份文档重写后的内容骨架：

| 文档 | 保留内容 | 移出内容 |
|---|---|---|
| `domain.md` | 候选知识判断、CONTEXT/RULE 落点、用户确认边界、冲突处理、修改后验证 | 根目录搜索、单/多布局格式、任务开始时如何加载、所有 RULE 必读 |
| `context-format.md` | 单/多 Context 文件布局、Frontmatter、术语格式、Context Map 注册链接、共享概念与关系格式 | 任务选择逻辑、Hook 行为、RULE 规则 |
| `rules-format.md` | RULE 收录标准、场景命名、两位编码、正文模板、`references`、创建/重命名/删除流程 | Context 布局、运行时场景选择、全量读取要求、`RULE-NN` 旧短号 |

每个文档开头用一句话声明自身唯一职责；跨职责内容只放一个带触发条件的指针，不复制正文。

### Agent Instruction Pointer

`AGENTS.md`、`CLAUDE.md` 等项目指令只安装一个由 Skill 管理的紧凑入口：

```markdown
<!-- project-knowledge:start -->
## 项目知识

执行项目任务时，先遵循项目 Hook 注入的知识选择与加载协议；加载结果中的项目术语用于当前任务命名，项目规则必须遵守。

任务中出现需要长期记录或调整的项目术语、Context 关系或规则时，按 `docs/agents/domain.md` 提议和维护。
<!-- project-knowledge:end -->
```

- 第一行是运行分支，只指向 Hook 已注入的完整协议，不重复“所有可能相关”“只调用一次”、命令参数、失败策略和重复加载规则。
- 第二行是维护分支；`domain.md` 再按修改对象指向 formatter 和 validator，`AGENTS.md` 不跨层直指全部文件。
- 指令文件不声明单/多 Context、不记录具体入口路径、不要求直接读取 `CONTEXT-MAP.md`、具体 CONTEXT 或枚举 `docs/rules/`。
- `project-knowledge:start/end` 是安装 Skill 的所有权边界，不进入模型行为语义；Skill 只能替换边界内文本。
- 子 Agent 不依赖该段转述加载范围，由 `SubagentStart` Hook 独立注入。

安装与升级规则：

1. 已存在完整标记块：原位替换块内文本，保证只有一个块。
2. 存在未定制的旧 `## 领域文档` 模板：在原位置整体迁移为新标记块。
3. 存在已定制的旧段落：展示保留内容与建议迁移结果，经用户确认后合并，不能直接覆盖。
4. 不存在新旧入口：在根 Agent 指令文件末尾追加一次标记块。
5. `AGENTS.md` 与 `CLAUDE.md` 都存在时，两者都安装相同语义的块；Hook 仍只配置当前运行 Skill 的 Agent 宿主。
6. 验证每个目标文件恰好有一个完整标记块，且块外不存在 `read-rules.py`、直接枚举 RULE 或旧全量读取入口。

### Command Rendering

`project-knowledge` 是本文中的逻辑命令名。实际 Hook 注入可直接执行的项目脚本命令，Agent 原样使用，不搜索路径、不自行拼接：

```bash
node "/absolute/domain-root/docs/agents/project-knowledge.mjs" load \
  --context "ly-sm-supplier/CONTEXT.md" \
  --rule "A"
```

- Hook 根据 `project-knowledge.mjs` 的规范真实路径渲染绝对命令；该路径只进入当前会话上下文，不写入知识文档。
- Agent 只替换或重复 `--context`、`--rule` 参数，不修改 Node.js 入口和脚本路径。
- 仓库移动后由已安装 Hook 重新解析脚本位置，下一次注入自动得到新绝对路径。
- PRD 后文的 `project-knowledge scope|load|hook` 示例表达子命令契约，不表示依赖全局 PATH。

### Pointer Migration

插件发布时必须一次性迁移以下旧指针，避免按需协议与“全部 RULE”协议并存：

| 位置 | 删除的旧语义 | 新语义 |
|---|---|---|
| 项目 `AGENTS.md`、`CLAUDE.md` | 直接读取领域文件、枚举或全量读取 `docs/rules/` | 使用 Hook 提供的 scope 和单次 load |
| `docs/agents/domain.md` | 根目录搜索、探索前全量读取、全部 RULE 必读 | 只保留维护判断、落点与冲突处理 |
| `setup-agent-skills/SKILL.md` | 安装 `read-rules.py`、验证全部规则加载 | 安装 V2 文档、单文件 MJS、当前 Agent Hook 并运行两个校验子命令 |
| `to-prd`、`to-task`、`impl`、`code-review`、`codebase-design`、`diagnosing-bugs`、`grill-with-docs`、`zoom-out` | “遵守全部项目规则”或自行定位领域文件 | 使用当前任务已经由 `project-knowledge load` 返回的知识；不触发第二套读取流程 |
| RULE 文档和引用说明 | `NN-主题.md`、`RULE-NN`、正文主题引用 | 场景文件名与 Frontmatter `references` 完整文件名 |

迁移完成条件：插件仓库与项目指令中搜索 `read-rules`、`枚举 docs/rules`、`全部 RULE`、`RULE-NN`，除迁移说明和历史记录外不得再命中可执行指令。

旧 `read-rules.py` 仅在以下条件全部满足后删除：新脚本已部署、Hook 已安装、所有旧指针已迁移、两个校验子命令通过。不得保留兼容入口，避免 Agent 继续走全量路径。

### Current Repository Migration Preview

移交插件仓库实施后，本仓库预期迁移面为：

- 重写 `docs/agents/domain.md`、`context-format.md`、`rules-format.md`。
- 新增单文件 `project-knowledge.mjs`，由其提供运行命令和两个校验子命令。
- 更新 `AGENTS.md` 与 `CLAUDE.md` 的领域文档段落为新入口。
- 为 8 个 Context 的 `CONTEXT.md` 补充 `description` Frontmatter。
- 将 `CONTEXT-MAP.md` 的 8 个粗体带说明链接规范为普通注册链接；说明迁移到各 Context Frontmatter，正文共享概念和关系保持不变。
- 当前 40 个 RULE 文件已经采用场景命名；实施时主要由 `validate-rules` 子命令校验 12 个含 `references` 的 Frontmatter、映射与排序，不因 V2 重新改写规则正文。
- 按当前 Agent 宿主安装 Hook；本阶段已有 `.codex/`、`.claude/` 用户改动均不触碰。

### CONTEXT Frontmatter

每个 `CONTEXT.md` 使用 YAML Frontmatter 提供单行简短说明：

```yaml
---
description: 管理供应商注册、主数据、评价与状态等全生命周期业务
---
```

- `description` 必填，使用单行纯文本说明该 Context 负责的业务范围。
- Frontmatter 必须位于文件起始位置，使用 YAML mapping；当前只支持 `description` 一个字段，未知字段校验失败。
- `description` 必须是去除首尾空白后非空、且不含换行的字符串；不接受数组、对象或 YAML 多行块。
- 只支持受控的 YAML 兼容子集：`description: 文本` 单行普通标量；不支持注释、引号转义、锚点、标签、flow mapping 或其他 YAML 扩展语法。
- 说明不重复文件路径、Context 名称和技术栈。
- `scope` 只读取 Frontmatter，不读取 CONTEXT 正文。
- 多 Context 的可选路径仍以 `CONTEXT-MAP.md` 的 Contexts 链接为准；Frontmatter 只提供选择说明，不注册路径。
- 当前真实 CONTEXT 需要在后续设计产出调整阶段补齐该元数据；插件实施前必须完成。

### CONTEXT-MAP Format

多 Context 地图使用唯一的二级标题 `## Contexts`，该节只接受以下列表项：

```markdown
## Contexts

- [通用依赖包](../ly-cm-commonutil/CONTEXT.md)
- [供应商服务](../ly-sm-supplier/CONTEXT.md)
```

- 每项只能包含一个普通 Markdown 链接，不使用粗体，不附加破折号说明；简短说明只存在于目标 `CONTEXT.md` 的 `description`。
- 链接文本必须非空且在地图内唯一，只用于人类识别，不进入 `scope` 输出。
- 链接目标相对于 `docs/CONTEXT-MAP.md` 所在目录解析，必须是相对文件路径并以 `CONTEXT.md` 结尾。
- 不接受绝对路径、URL、锚点、查询参数、图片链接、引用式链接、通配符或目录链接。
- 规范化后的 Context 路径必须互不重复、真实存在，并位于领域文档根目录内。
- `## 共享概念`、`## Relationships` 等其他章节保留给人类知识，不参与 Context 注册和 `scope` 解析。
- `## Contexts` 的列表顺序是 Context 唯一顺序来源。

### RULE 文件名

- 文件名统一为 `<英文场景编码><两位场景内编码>-<场景名称>-<规则名称>.md`，并匹配：

  ```regex
  ^([A-Z]+)([0-9]{2})-([^-]+)-(.+)\.md$
  ```

- 英文场景编码只使用大写英文字母，位数不限；场景编码按重要程度排列，越重要越靠前。
- 场景内编码固定为两位数字，每个场景从 `01` 开始连续编号，并按重要程度排列。
- 场景名称不得包含结构分隔符 `-`；规则名称必须非空，可以包含 `-`。
- 同一场景编码只能对应一个场景名称，同一场景名称也只能对应一个场景编码。
- 场景信息只存在于文件名，不在正文或元数据重复维护。

### RULE 引用

RULE 的直接依赖写在 YAML Frontmatter 的 `references` 中：

```yaml
---
references:
  - B02-查询接口-列表参数统一由BaseQueryParam生成Wrapper.md
  - F01-平台能力调用-调用前追踪Helper与Decoder完整语义.md
---
```

- 每一项是相对于当前规则目录的完整文件名，包含 `.md`，不添加 `RULE-` 前缀。
- 引用不包含绝对路径、目录跳转或路径分隔符，只能指向同一 `docs/rules/` 目录。
- `references` 只声明直接依赖，传递依赖由 `load` 递归展开。
- 没有直接依赖时省略整个 Frontmatter。
- CLI 不扫描正文猜测依赖；RULE 重命名时同步更新所有引用。
- RULE Frontmatter 当前只支持 `references` 字段，出现未知字段时校验失败。
- `references` 必须是无重复项的字符串数组，并按目标完整文件名字节序排列；空数组应删除整个 Frontmatter。
- `references` 只接受 `references:` 后跟零个或多个 `  - 完整文件名.md` 的块列表；不支持 flow list、锚点、标签或多行标量。
- 循环引用允许存在，由 `load` 的访问集合终止；validator 仍应报告引用环信息，但不因此失败。

### RULE Lifecycle

创建 RULE：

1. 先判断应归入已有场景还是新增场景；已有场景必须复用其 code 和 name。
2. 按重要程度确定规则在场景内的位置，并对该场景从 `01` 连续编号；编号变化时同步全部入向 `references`。
3. 新增场景时由用户确认新的大写英文 code 与场景名称，并按重要程度确定它与现有场景的相对顺序。
4. 直接依赖写入 `references`，随后运行 `project-knowledge validate-rules`。

重命名或移动 RULE 场景：

1. 先计算全部文件重命名与反向引用更新清单。
2. 同一变更中完成目标文件重命名和所有 `references` 精确替换，不保留别名文件或跳转文件。
3. 场景 code 或 name 变化时，同场景全部文件必须一起更新，不能形成一对多映射。
4. 完成后运行 `project-knowledge validate-rules`；失败则该次迁移未完成。

删除 RULE 前必须查找所有入向引用；先更新引用方或取消删除。不得留下悬空引用。

### Validators

```bash
node docs/agents/project-knowledge.mjs validate-context
node docs/agents/project-knowledge.mjs validate-rules
```

`validate-context` 负责：

- 单/多 Context 布局互斥；
- CONTEXT Frontmatter 和 `description`；
- `CONTEXT-MAP.md` 的 `## Contexts` 结构、顺序、链接文本、路径、重复项和目标文件；
- 路径规范化、领域根目录边界和符号链接目标。

`validate-rules` 负责：

- RULE 文件名语法、完整编码唯一性、code/name 双向唯一映射；
- RULE Frontmatter 支持字段、`references` 类型、顺序、重复项和目标存在性；
- 引用目标目录边界、全部入向引用和引用环报告。

两个校验子命令都遵守：

- 无业务参数；从 `project-knowledge.mjs` 所在的 `docs/agents/` 锚定领域文档根目录。
- 成功退出 `0`，向 stdout 输出一行摘要；失败非零退出，每个错误包含相对路径和可定位原因。
- 非阻断 warning 写入 `stderr`；引用环 warning 必须列出完整环路，不能混入成功摘要。
- 一次收集并报告全部独立错误，不在首个格式错误处停止。
- 只读，不自动格式化、重命名或修复文件。
- `setup-agent-skills` 安装或迁移结束时必须同时执行；修改对应知识文件后也必须执行对应 validator。

单文件使用 Node.js 标准库解析上述受控 Frontmatter 和严格 Map 列表格式，不依赖 npm 包或项目 `node_modules`。所有子命令通过同一组内部函数得到结构化结果。

## Root Anchoring

- `project-knowledge.mjs` 以自身真实路径所在的 `docs/agents/` 为锚点，领域文档根目录固定为其上两级目录；不从当前工作目录搜索候选根。
- 脚本路径先解析符号链接和 `..` 得到规范绝对路径；脚本真实位置不满足 `<root>/docs/agents/<script>` 时命令失败。
- 当前工作目录不参与根目录选择，因此嵌套 Git 仓库、同名祖先布局和多个候选根不会改变结果。
- 存在 `docs/CONTEXT.md` 时识别为单 Context；存在 `docs/CONTEXT-MAP.md` 时识别为多 Context。
- 多 Context 的名称和路径从 `CONTEXT-MAP.md` 的 Contexts 列表解析，不另建注册表。
- RULE 目录固定为领域文档根目录下的 `docs/rules/`。
- 脚本锚定的领域文档根目录中未发现 `docs/CONTEXT.md` 或 `docs/CONTEXT-MAP.md` 时，视为项目没有采用本知识结构；`scope`、`load`、`hook` 均退出 `0` 且不输出内容。
- 单独存在 `docs/rules/` 不建立领域文档根目录，也不改变上述静默行为。
- 已发现 CONTEXT 布局但不存在 `docs/rules/` 时不报错；`scope` 返回空的 `rule_scene_options`，`load` 仍返回布局固定文档和所选 CONTEXT。
- 同一领域文档根目录同时存在 `docs/CONTEXT.md` 与 `docs/CONTEXT-MAP.md` 时，命令失败并报告布局冲突。

核心边界是：项目没有采用本知识结构时静默跳过；一旦识别出布局，`scope`、`load` 和两个校验子命令对布局声明、选择目标或引用损坏明确失败，Hook 则转换成可见告警并继续任务。

所有知识路径执行以下规范化：

1. 以声明文件所在目录解析相对路径。
2. 消解 `.`、`..` 和符号链接，得到规范绝对路径。
3. 要求规范路径仍位于规范化后的领域文档根目录内。
4. 转回相对于领域文档根目录、使用 `/` 分隔的路径作为比较键和输出值。

符号链接本身允许存在，但其最终目标逃出领域文档根目录时校验失败。同一真实文件通过不同文本路径声明两次，按规范路径判定为重复。

## Command: scope

### Usage

```bash
project-knowledge scope
```

- 不接收业务参数。
- 只向 `stdout` 输出 JSON。
- 读取布局、`CONTEXT-MAP.md` 的 Contexts 列表、CONTEXT Frontmatter、RULE 文件名和所有 RULE Frontmatter；不读取 RULE Markdown 正文。
- 在输出范围前校验完整 RULE 引用图，因此任一 RULE Frontmatter、引用目标或场景映射损坏都会使 `scope` 失败，即使该 RULE 最终不会被 Agent 选择。
- 不输出任何 CONTEXT、CONTEXT-MAP 或 RULE 正文。

### Single Context Output

```json
{
  "context_mode": "single",
  "rule_scene_options": [
    {
      "code": "A",
      "name": "必读",
      "paths": [
        "docs/rules/A01-必读-需求范围只做明确要求的最小改动.md",
        "docs/rules/A02-必读-实现方式优先复用当前受支持能力.md"
      ]
    }
  ]
}
```

- 不返回 `context_options`；唯一 `docs/CONTEXT.md` 由 `load` 固定返回。

### Multiple Context Output

```json
{
  "context_mode": "multiple",
  "context_options": [
    {
      "path": "ly-cm-commonutil/CONTEXT.md",
      "description": "沉淀跨服务复用的公共契约、自动配置和工具能力"
    },
    {
      "path": "ly-sm-supplier/CONTEXT.md",
      "description": "管理供应商注册、主数据、评价与状态等全生命周期业务"
    }
  ],
  "rule_scene_options": [
    {
      "code": "A",
      "name": "必读",
      "paths": [
        "docs/rules/A01-必读-需求范围只做明确要求的最小改动.md",
        "docs/rules/A02-必读-实现方式优先复用当前受支持能力.md"
      ]
    },
    {
      "code": "C",
      "name": "保存接口",
      "paths": [
        "docs/rules/C01-保存接口-业务参数默认由调用方完整构建.md",
        "docs/rules/C02-保存接口-结构性入参校验优先使用BeanValidation.md"
      ]
    }
  ]
}
```

- `context_options[].path` 是相对于领域文档根目录的 Context 文件路径。
- `context_options[].description` 来自对应 CONTEXT Frontmatter。
- `rule_scene_options[]` 同时返回场景编码、名称和该场景的全部文件路径。
- RULE 文件路径用于帮助 Agent 判断场景是否相关；`load` 传入场景编码，不传这些路径。
- `docs/CONTEXT-MAP.md` 不作为选项返回，由 `load` 固定返回。
- 不返回协议版本、Context 名称、文件数量、正文摘要或其他派生字段。

### Ordering and Errors

- CONTEXT 按 `CONTEXT-MAP.md` 声明顺序输出。
- RULE 场景按 code 的 UTF-8 字节序输出；场景内规则先按两位数字的数值升序，再以完整文件名 UTF-8 字节序作为确定性兜底。场景编码和场景内序号的顺序表达维护者确定的重要程度。
- 不存在 `docs/rules/` 时返回 `"rule_scene_options": []`。
- CONTEXT Frontmatter、RULE 文件名、完整编码或场景映射无效时，命令非零退出。
- 成功 JSON 只写入 `stdout`；错误只写入 `stderr`。

## Agent Selection Protocol

- 单 Context 项目只选择 RULE 场景。
- 多 Context 项目选择所有可能相关的 CONTEXT；即使只有较低概率相关，也应选择。
- RULE 根据场景名称和 `paths` 中的具体文件名判断，选择所有可能相关的场景。
- “必读”无特殊处理，是否选择完全由 Agent 判断。
- Agent 选择完成后只调用一次 `load`。

## Command: load

### Usage

单 Context：

```bash
{load_command} \
  --rule "A" \
  --rule "C"
```

多 Context：

```bash
{load_command} \
  --context "ly-sm-supplier/CONTEXT.md" \
  --context "ly-of-offering/CONTEXT.md" \
  --rule "A" \
  --rule "C"
```

- `--context` 接收 `scope.context_options[].path`，可以重复。
- `--rule` 接收 `scope.rule_scene_options[].code`，可以重复。
- 不提供通用 `--path`，不接受 Context 名称、RULE 场景名称或具体 RULE 路径。
- 重复的 CONTEXT 路径和 RULE 场景编码自动去重。
- 单 Context 项目不传 `--context`；多 Context 项目至少传入一个 `--context`。
- `--rule` 不自动补入“必读”或其他场景。

### Fixed Documents

| 布局 | `load` 固定返回 | Agent 选择 |
|---|---|---|
| 单 Context | `docs/CONTEXT.md` | 不选择、不传 `--context` |
| 多 Context | `docs/CONTEXT-MAP.md` | 另外选择一个或多个具体 CONTEXT |

固定文档不作为 `load` 参数。多 Context 的 `CONTEXT-MAP.md` 和单 Context 的 `CONTEXT.md` 无论选择哪些 RULE 都必须返回。

### Expansion

1. 加入当前布局的固定文档。
2. 加入所有 `--context` 指定的 CONTEXT。
3. 将每个 `--rule` 场景编码展开为该场景的全部 RULE。
4. 递归解析初始 RULE 集合和新增 RULE 的 `references`，直到集合不再增长。
5. 被引用 RULE 只加入自身及其递归引用，不扩展其所属场景。
6. 使用已访问集合终止循环引用，每个文件最多输出一次。

### Output

`load` 向 `stdout` 返回纯文本合并正文，不使用 JSON：

```text
===== docs/CONTEXT-MAP.md =====
完整正文……

===== ly-sm-supplier/CONTEXT.md =====
完整正文……

===== docs/rules/A01-必读-需求范围只做明确要求的最小改动.md =====
完整正文……
```

- 分隔行使用相对于领域文档根目录的完整路径。
- 分隔行后原样输出完整文件，包括 Frontmatter 和 Markdown 正文。
- 相邻文件之间保留一个空行。
- 输出不增加选择解释、场景汇总或加载统计。
- 固定文档最先输出；所选 CONTEXT 按地图顺序输出；全部 RULE 按稳定文件路径顺序输出。
- RULE 的最终稳定顺序按完整规范相对路径的 UTF-8 字节序排列，与引用发现顺序和参数顺序无关。
- CLI 完成全部校验和内容收集后才写入 `stdout`，失败时不返回部分正文。

### Validation and Errors

未发现单 Context 或多 Context 布局时，`load` 退出 `0` 且不输出内容。

以下任一情况使 `load` 非零退出：

- 单 Context 项目传入 `--context`。
- 多 Context 项目未传入 `--context`。
- CONTEXT 路径不在当前 `scope.context_options` 中。
- RULE 场景编码不在当前 `scope.rule_scene_options` 中。
- CONTEXT 或 RULE 文件不存在、不是普通文件或无法读取。
- RULE 文件名、场景映射、YAML Frontmatter 或 `references` 无效。
- 引用目标不存在、不是同目录完整 Markdown 文件名或逃出 `docs/rules/`。

错误只写入 `stderr`，不得输出部分正文。

### Load Output Budget

- 当前真实最坏集合为 `CONTEXT-MAP + 8 CONTEXT + 40 RULE`，合并正文约 `51 KB`；Codex 命令工具计数约 `13,731 tokens`。
- Codex 默认约 `10,000 tokens` 的命令输出预算会截断该集合；`15,000 tokens` 已实测能够完整返回。Codex Hook 额外注入一条适配提示：调用 `load` 时将命令工具的 `max_output_tokens` 设置为至少 `20,000`。
- `20,000` 是工具调用预算，不是 CLI 参数，不写入 shell 命令。
- Claude Code 的成功 Bash/PowerShell 结果只内联约 `30,000` 字符；超过后由宿主把完整 stdout 保存到会话文件，并向 Agent 返回预览和该文件路径。当前约 `51 KB` 的最坏集合必然进入该分支，且 `BASH_MAX_OUTPUT_LENGTH` 不能提高内联上限。
- Claude Code 仍只允许调用一次 `project-knowledge load`。结果被宿主外置时，Agent 必须完整读取宿主返回的会话文件，并把其中内容视为本次 `load` 的唯一完整结果；不得再次调用 `load`，也不需要搜索项目知识路径。
- 每个 Agent 适配器发布前必须用当前最坏集合验证完整结束标记和最后一个文件正文：Codex 验证内联结果，Claude Code 验证宿主外置文件。一次 `load` 后无法取得完整正文的宿主不得标记为已支持。
- 项目知识增长导致最坏集合超过已验证预算时，`setup-agent-skills` 报告容量风险，要求重新完成目标 Agent 的输出预算验证；第一版不自动分块，也不把截断视为成功。

## Hooks

### Installation

Hook 与脚本由 `setup-agent-skills` 在同一次初始化或升级中安装：

1. 将 Skill 种子脚本部署为领域文档根目录下的 `docs/agents/project-knowledge.mjs`。
2. 将原 `read-rules.py` 全量读取入口迁移为新的按需加载入口；具体升级必须遵循 Skill 的漂移检查和用户修改保护策略。
3. 根据当前运行 Skill 的 Agent 宿主选择 Hook 适配器，而不是根据仓库中是否存在 `AGENTS.md` 或 `CLAUDE.md` 猜测 Agent 类型。
4. 只安装或更新当前宿主的 Hook 配置，不顺带修改其他 Agent 的配置；需要支持另一 Agent 时，在对应宿主中再次运行 Skill。
5. 合并已有配置，只维护“事件 + 调用 `project-knowledge.mjs hook` 的命令”共同标识的 Hook 项，不覆盖项目原有 Hook。

Codex 配置表示形式按以下规则选择：

1. `.codex/hooks.json` 与 `.codex/config.toml` 内联 `[hooks]` 都不存在：创建 `.codex/hooks.json`。
2. 只存在一种：合并到现有表示形式，不新建第二种。
3. 两种同时存在：停止安装并请求用户统一；推荐保留 `.codex/hooks.json`。不得继续写入造成同层双来源 warning。
4. 合并后同一事件只能存在一个本项目知识 Hook；其他 Hook 原样保留。
5. 第一版只在本次领域文档根目录的 Agent 配置层安装，不处理独立子仓库的配置继承与分发。

Claude Code 配置按以下规则合并：

1. `.claude/settings.json` 不存在时创建；存在时解析并原位合并 `hooks`，不覆盖其他设置和其他 Hook。
2. 本项目知识 Hook 的身份由“事件 + matcher + `command=node` + 完整 `args`”共同确定；每个事件在项目配置层只保留一个匹配项，重复运行原位更新。
3. 安装、去重和验收边界只限领域文档根的项目 `.claude/settings.json`；不读取或修改用户级、本地级、托管级、插件级或 Skill 级 Hook。
4. 其他 matcher group、handler 和设置字段保持原顺序与语义；JSON 语法或 schema 无效时停止，不尝试容错重写。
5. 第一版以 Claude Code `2.1.233` 为验收基线；更低版本不声明支持。

Claude 项目配置的事件层级固定为：

- `hooks.UserPromptSubmit`：一个不含 `matcher` 的 matcher group，内部放置项目知识 handler。
- `hooks.SessionStart`：一个 `matcher: "compact"` 的 matcher group，内部放置同一 handler。
- `hooks.SubagentStart`：一个不含 `matcher` 的 matcher group，内部放置同一 handler。

`setup-agent-skills` 的 V2 主流程重写为：

1. **识别宿主与锚点**：识别当前 Agent，定位领域文档根目录和当前布局。
2. **盘点旧协议**：检查项目 Agent 指令、`docs/agents/`、旧 `read-rules.py`、旧 RULE 命名和正文引用，形成迁移清单。
3. **确定布局**：仅在没有现有布局时根据真实业务边界选择单/多 Context；已存在有效布局时保持，不重复判断。
4. **生成候选快照**：在临时目录构造迁移后的完整知识树，包含三个文档、单文件 MJS、CONTEXT、CONTEXT-MAP、RULE 和更新后的引用；不修改真实项目。
5. **验证候选快照**：在快照内执行两个校验子命令、`scope` 和代表性 `load`；失败时删除快照并停止，真实项目保持不变。
6. **确认迁移清单**：展示创建、覆盖、重命名、删除、指针替换和 Hook 变更；涉及项目定制或破坏性迁移时取得用户确认。
7. **落盘知识文件**：保存真实文件的恢复副本后应用已验证快照；任一步失败时恢复本轮已修改文件。
8. **安装当前 Agent Hook**：知识文件成功后合并当前宿主 Hook 配置；此时暂不切换 Agent 指令入口，也不删除旧读取脚本。
9. **等待信任并激活**：报告 Hook 待信任；用户按宿主机制信任后，再验证三个 Hook 事件。
10. **原子切换入口**：Hook 已激活后，在同一最终变更中更新 Agent 指令、删除 `read-rules.py` 和旧 Hook 条目，使运行时只剩 Hook → scope → 单次 load 协议。
11. **报告结果**：列出最终布局、迁移文件、Hook 激活状态、校验结果、保留的项目定制和需要人工处理的冲突。

安装状态固定为：`候选快照已验证 → 文件已部署 → Hook 待信任 → Hook 已激活 → 迁移完成`。只有最后一个状态可以向用户宣称安装完成。重复运行时使用同一流程做漂移检查：缺失项补齐、Skill 自有且未修改的旧版本升级、项目定制保留并报告；不得通过追加产生重复指令段、重复 Hook 或并存脚本。

种子升级使用插件内置的已发布文件指纹表：

- 当前文件匹配任一已知官方种子指纹：视为未定制，可升级到当前版本。
- 当前文件不匹配已知指纹：视为项目定制，展示旧文件、当前种子和建议迁移结果，不自动覆盖。
- 旧 `read-rules.py` 匹配已知指纹：新协议验收后自动删除。
- 旧 `read-rules.py` 已定制：停止最终切换，由用户确认迁移其有效能力或删除；不得把定制旧脚本留作可执行兼容入口。
- 指纹只用于识别模板所有权，不作为项目运行时文件或 RULE 索引写入仓库。

V2 Skill 仍是用户显式调用的安装 Skill，保留 `disable-model-invocation: true`。它的主体只保留上述有序流程与完成条件；格式细则分别下沉到三个种子文档，Hook 协议下沉到模板，避免 Skill 再复制规范正文。

其他工程 Skills 中的旧读取指针在 Agent Skills Engineering 插件发布 V2 时统一改写，不由安装 Skill 在目标项目中动态修改插件自身。

Agent 适配关系：

| Agent 宿主 | 项目配置落点 | 适配职责 |
|---|---|---|
| Codex | `.codex/hooks.json` | 绑定 Codex 事件，读取 Codex Hook stdin，返回 Codex `hookSpecificOutput` |
| Claude Code | `.claude/settings.json` | 绑定同名事件，读取 Claude stdin，返回 `hookSpecificOutput.additionalContext`；大结果遵循宿主会话文件协议 |

两种适配器都调用同一份 `docs/agents/project-knowledge.mjs`。Agent 专属事件映射不进入核心 `scope`、`load` 逻辑。

Codex 项目本地 Hook 只有在项目 `.codex/` 配置层受信任后才会运行；新安装或 Hook 定义变化后由用户按 Codex 的信任机制确认。

Claude Code 交互会话在工作区受信任前不会运行 settings 中的 Hook；`-p` 和 Agent SDK 会话不会显示信任对话框并把工作目录视为已信任。安装器只在交互会话完成三个事件的真实触发验收后标记“Hook 已激活”。

### Command Portability

- 第一版同时支持 macOS、Linux 和 Windows，运行时只要求 `node` 可用，不要求 Bash、Python、npm 包或项目依赖。
- Codex Hook 同时写入 POSIX `command` 和 Windows `commandWindows`；二者调用同一 MJS 和 `hook` 子命令。
- 写入 `hooks.json` 时使用 `commandWindows`，写入 `config.toml` 内联 Hook 时使用 `command_windows`；其他字段按各自配置格式序列化。
- POSIX 命令按 shell 单引号规则逐参数转义；Windows 命令按 Windows 命令行参数规则转义。实现不得用字符串插值加双引号代替转义函数。
- 路径和选项值含空格、单引号、`$`、反引号、`&`、`%` 时必须仍作为单个普通参数传递；NUL 和换行不允许出现在知识路径中。
- Hook 注入给 Agent 的 `{load_command}` 使用当前平台对应的同一转义器生成。

Claude Code 不使用 shell 命令字符串或平台分支，固定使用跨平台 exec form：

```json
{
  "type": "command",
  "command": "node",
  "args": [
    "${CLAUDE_PROJECT_DIR}/docs/agents/project-knowledge.mjs",
    "hook"
  ],
  "timeout": 5
}
```

- `args` 中每项直接作为一个参数传入，不经过 shell；`${CLAUDE_PROJECT_DIR}` 由 Claude Code 替换，因此空格、单引号、`$`、反引号和 Windows 路径分隔符不会改变参数边界。
- `node`/`node.exe` 必须可从 `PATH` 解析；不调用 npm 的 `.cmd` shim，也不需要 `commandWindows`、PowerShell 脚本或 POSIX 转义。
- Claude Hook stdin 至少使用公共字段 `cwd`、`hook_event_name`；`SessionStart` 另读 `source`，`SubagentStart` 可读 `agent_id`、`agent_type` 但不据此预选范围。

每个 Codex Hook handler 固定设置：

```json
{
  "type": "command",
  "command": "<POSIX command>",
  "commandWindows": "<Windows command>",
  "timeout": 5,
  "additionalContextLimit": 10000
}
```

Hook 能完成错误转换时以退出码 `0` 返回以下 Codex warning，不返回部分 `additionalContext`：

```json
{
  "continue": true,
  "systemMessage": "项目知识未加载：<首个错误>。请运行 <对应 validate-context 或 validate-rules 命令>。"
}
```

进程无法启动、超时或无法生成合法 JSON 时交由 Codex 报告 Hook failure，任务继续；不得使用会阻断 `UserPromptSubmit` 的退出码 `2`。

Claude Code 中 scope 损坏时退出 `0` 并同时返回用户可见告警与 Agent 可见上下文；不返回部分 scope：

```json
{
  "continue": true,
  "systemMessage": "项目知识未加载：<首个错误>。请运行 <对应 validator 命令>。",
  "hookSpecificOutput": {
    "hookEventName": "<当前事件>",
    "additionalContext": "项目知识未加载：<首个错误>。请运行 <对应 validator 命令>。"
  }
}
```

Claude command Hook 超时、无法启动、非零退出或 JSON 无效均按宿主的 non-blocking error 处理，当前请求、压缩或子 Agent 继续；不得返回 `continue: false` 或使用退出码 `2`。

### Events

- `UserPromptSubmit`：每次用户提示提交时执行，不配置 matcher。
- `SessionStart`：只匹配 `source=compact`。
- `SubagentStart`：每个子 Agent 启动时执行。

同一 Agent 下的三个事件使用同一个内部命令：

```bash
project-knowledge hook
```

Agent 项目 Hook 配置只绑定事件，不保存注入文案或范围数据。

### Dynamic Rendering

`hook` 从 Hook 标准输入读取 `cwd` 和 `hook_event_name`，使用与 `scope` 相同的核心逻辑生成范围，再动态组合“事件策略 × 布局模板 × Agent 输出预算提示 × 紧凑 scope JSON”。不为三个事件、两种布局和多个 Agent 维护笛卡尔积模板。

事件首句固定为：

| 事件 | 首句 |
|---|---|
| `UserPromptSubmit` | 先判断当前请求是否只是同一任务的延续：若当前上下文已经加载项目知识且原选择完整覆盖本次请求，不调用 load，直接继续；否则重新选择当前完整范围并调用一次 load。 |
| `SessionStart` | 上下文已经压缩，必须根据当前保留的任务重新选择完整范围并调用一次 load。 |
| `SubagentStart` | 执行当前子任务前，必须依据子任务独立选择完整范围并调用一次 load。 |

单 Context 注入模板：

```text
项目知识加载要求：

{event_instruction}

需要加载时，从下方 scope 选择所有可能相关的 RULE 场景；只要存在任何相关可能就选择。汇总后只调用一次 load，并将返回的全部正文作为当前任务必须遵守的项目知识。

调用示例，--rule 可以重复：

{load_command} \
  --rule "<rule_scene_options[].code>" \
  --rule "<rule_scene_options[].code>"

{tool_output_instruction}

<project_knowledge_scope>
{compact_scope_json}
</project_knowledge_scope>
```

多 Context 注入模板：

```text
项目知识加载要求：

{event_instruction}

需要加载时，从下方 scope 选择所有可能相关的 CONTEXT 和 RULE 场景；只要存在任何相关可能就选择。汇总后只调用一次 load，并将返回的全部正文作为当前任务必须遵守的项目知识。

调用示例，--context 和 --rule 均可重复：

{load_command} \
  --context "<context_options[].path>" \
  --context "<context_options[].path>" \
  --rule "<rule_scene_options[].code>" \
  --rule "<rule_scene_options[].code>"

{tool_output_instruction}

<project_knowledge_scope>
{compact_scope_json}
</project_knowledge_scope>
```

- `{load_command}` 由脚本按当前操作系统渲染为已正确转义、可直接执行的 `node <absolute-script-path> load`；模板只表达参数映射和可重复性，不预选任何实际 CONTEXT 或 RULE 场景。
- `{tool_output_instruction}` 由 Agent 适配器提供：Codex 固定提示将命令工具 `max_output_tokens` 设为至少 `20000`；Claude Code 固定提示“结果包含宿主生成的会话文件路径时，完整读取该文件，该文件就是本次 load 的完整正文，不要再次调用 load”。
- `compact_scope_json` 是 `scope` 结果的紧凑 JSON，不增加正文、统计或重复说明。
- 注入内容使用正向入口描述，不枚举其他文件读取工具或绕过方式。

### Behavior

每个 Hook 同步执行以下流程：

1. 读取 Hook 标准输入，取得当前工作目录和事件类型。
2. 生成与 `scope` 相同的结构化范围。
3. 根据 `context_mode` 选择单 Context 或多 Context 模板。
4. 根据 `hook_event_name` 选择事件首句并渲染 `additionalContext`。
5. 输出当前事件对应的合法 Hook 响应 JSON。

Hook 不替 Agent 选择范围、不读取正文、不调用 `load`。不存在项目知识时退出 `0` 且不输出内容；范围生成失败时不注入不完整范围，按下方失败策略继续任务。

Codex 与 Claude Code 的正常响应都使用：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "<当前事件>",
    "additionalContext": "<渲染后的完整注入文本>"
  }
}
```

不得把 `scope` JSON 直接作为 Hook 响应。

上下文压缩后重新提供范围，由 Agent 根据当前任务重新选择；第一版不持久化或恢复压缩前的选择。子 Agent 根据自身子任务独立选择，不依赖主 Agent 转述。

### Failure Policy

| 状态 | Hook 行为 | 任务行为 |
|---|---|---|
| 未采用知识结构 | 退出 `0`，无输出 | 正常继续 |
| 已采用且 scope 有效 | 注入正常选择协议 | 正常继续 |
| 已采用但 scope、地图、Frontmatter、RULE 或引用损坏 | 不注入部分 scope；返回宿主支持的可见 warning，包含首个错误和 validator 命令 | **继续任务** |
| Hook 自身异常或超时 | 交由宿主显示 Hook 失败 | **继续任务** |

- 失败是可见的配置告警，不是安全阻断；第一版不通过 Hook 阻断用户请求。
- Agent 收到知识不可用告警后不得声称已加载或遵守相关知识；最终交付中简短披露未加载状态。
- 手工执行 `scope`、`load` 或两个校验子命令时仍使用非零退出码报告损坏，不因 Hook 的继续策略改成成功。

### Repeated Loading

`UserPromptSubmit` 每轮仍提供最新 scope，但主会话按任务连续性决定是否再次 `load`：

| 当前提示 | `load` 行为 |
|---|---|
| 新任务、主题切换或工作范围变化 | 重新选择全部相关范围，只调用一次 `load` |
| 同一任务的补充、确认、状态追问，且既有加载范围完整覆盖 | 不重复 `load` |
| 同一任务新增 Context 或 RULE 场景，或无法确认既有范围是否覆盖 | 以当前完整范围重新选择，只调用一次 `load` |
| `SessionStart(compact)` | 必须重新选择并调用一次 `load` |
| `SubagentStart` | 子 Agent 必须按自身子任务独立选择并调用一次 `load` |

- 第一版不持久化 session 加载状态，也不读取不稳定的 transcript 推断是否调用过；由 Agent 根据当前上下文判断任务连续性。
- 重新加载时传入当前任务的完整选择集合，不只传新增项，确保本次返回是自足的完整知识。
- Hook 模板应明确写出上述“不重复 / 重新加载”分支，避免每轮机械重复正文。

### Hook Output Limit

Codex 的三个 Hook 都设置：

```json
{
  "additionalContextLimit": 10000
}
```

- 不使用默认约 `2500` token 的限制，避免完整范围发生 spilling 后 Agent 只能看到头尾预览。
- 不设置为 `0`，防止异常输出无上限占用模型上下文。
- Hook 注入严格限制为选择协议、调用示例和紧凑范围 JSON。
- 插件实施测试必须确认真实完整范围低于该限制；未来范围超过时调整限制或收敛输出，不接受依赖 spilling 的正常流程。

Claude Code 没有 `additionalContextLimit` 配置项；Hook 字符串由宿主固定限制为 `10,000` 字符。三个事件必须用真实最大 scope 验证注入文本低于该上限；超过时应收敛选择协议或 scope JSON，不能依赖外置文件作为正常 Hook 注入流程。

按当前 `8 CONTEXT + 40 RULE` 产物计算，紧凑 scope JSON 约 `2,847` 字符，连同最长选择模板预计低于 `4,700` 字符，位于 Claude Code 上限内；插件实施时必须用最终 formatter 产物重新实测，估算值不代替验收。

### Skill and Project Layout

```text
plugins/agent-skill-engineering/
└── skills/setup-agent-skills/
    ├── SKILL.md
    ├── scripts/
    │   └── project-knowledge.mjs
    └── hook-templates/
        ├── codex-hooks.json
        └── claude-settings.json

<领域文档根目录>/
├── .codex/hooks.json          # 仅在 Codex 中安装时维护
├── .claude/settings.json      # 仅在 Claude Code 中安装时维护
└── docs/agents/
    ├── domain.md
    ├── context-format.md
    ├── rules-format.md
    └── project-knowledge.mjs  # scope、load、hook、两个校验子命令
```

- `setup-agent-skills` 是脚本和 Hook 的唯一安装、升级入口。
- Hook 调用项目中的 `docs/agents/project-knowledge.mjs`，不依赖插件安装目录作为运行时核心。
- Hook 绑定由安装 Skill 生成，从项目 Git 根稳定定位 `docs/agents/project-knowledge.mjs`；脚本再以自身位置锚定领域文档根目录。
- Git 启动根的 Hook 命令以该启动根的 Git top-level 加上安装时计算的相对路径定位中央脚本，因此从其任意子目录启动都稳定；非 Git 启动根使用安装时的规范绝对路径，仓库移动后需重新运行 Skill。
- Hook 同步执行，输出保持精简。
- 三个 Hook 调用同一个 `project-knowledge hook`；Codex handler 设置 `additionalContextLimit: 10000`，Claude Code 使用宿主固定的 `10,000` 字符 Hook 输出上限。
- Agent 适配器只转换事件和响应格式；动态模板、范围生成及单/多 Context 判断全部由项目脚本完成。
- 首次安装或 Hook 定义变化后的信任确认遵守对应 Agent 运行时机制。

## Acceptance Criteria

以下验收标准供插件仓库实施阶段使用，不要求在本仓库执行：

### Format and Validation

1. 单/多 Context 布局、Frontmatter、Map 链接、RULE 文件名、场景映射和引用图均由两个校验子命令完整验证。
2. 运行命令与校验子命令使用单文件内同一套解析函数，对同一输入给出一致结论。
3. Context、场景、RULE 和引用输出顺序符合各自稳定排序契约；重复运行结果字节一致。
4. 循环引用输出 warning 但校验成功；warning 写 `stderr`，包含完整环路，成功摘要仍只写 `stdout`。

### Scope and Load

1. `scope` 返回约定 JSON，只读取知识元数据，不输出正文；任一 RULE Frontmatter 或引用图损坏时整体失败。
2. 单 Context 不返回 `context_options`；多 Context 返回地图路径和 Frontmatter description。
3. `load --context` 接受 Context 路径，`load --rule` 接受场景编码；“必读”不自动加入。
4. 场景展开、递归引用、循环终止、文件去重和路径分隔符合契约；被引用 RULE 不扩展整个目标场景。
5. 未采用知识结构时静默成功；只有 CONTEXT、没有 RULE 时仍正常加载；已采用但损坏时非零退出且无部分 stdout。
6. 当前最坏集合在 Codex 中使用 `max_output_tokens: 20000` 一次完整返回，结束标记和最后文件正文均存在。
7. 当前最坏集合在 Claude Code 中只调用一次 `load`；结果超过内联上限时，从宿主返回的会话文件完整取得结束标记和最后文件正文，不再次调用 `load`。

### Hooks

1. 三个事件调用同一 `hook` 子命令；UserPromptSubmit 同任务同范围不重复 load，新任务或范围变化重新完整加载，compact 与子 Agent 强制独立加载。
2. 单/多 Context 模板包含正确的可执行命令、Agent 输出预算提示和紧凑 scope JSON。
3. Codex handler 同时包含 `command`、`commandWindows`、`timeout: 5`、`additionalContextLimit: 10000`，并通过带空格和 shell 特殊字符的路径测试。
4. Claude Code handler 使用 `command: node`、`args` exec form 和 `timeout: 5`，三个事件均返回匹配事件名的 `hookSpecificOutput.additionalContext`；真实最大注入文本低于 `10,000` 字符。
5. scope 损坏时以合法 warning JSON 继续任务，不返回部分 scope；Claude Code 的 warning 同时通过 `systemMessage` 告知用户、通过 `additionalContext` 告知 Agent；进程异常或超时由宿主报告且不阻断任务。
6. Codex 项目配置层只使用一种 Hook 表示形式；Claude Code 只维护项目 `.claude/settings.json`；当前项目配置中每个事件恰好存在一个项目知识 Hook，其他已有 Hook 保持不变。
7. Hook 未获得信任时状态为“待信任”；当前宿主的三个事件真实执行成功后才进入“已激活”。

### Installation and Migration

1. `setup-agent-skills` 只向领域文档根部署三份文档和单文件 MJS，并只安装当前 Agent 的根级 Hook。
2. 候选快照在真实项目零写入时通过两个校验子命令、scope 和代表性 load；失败不改变真实项目。
3. 落盘失败能够从恢复副本还原本轮修改；Hook 配置最后安装，信任后才原子切换 Agent 指针并删除旧入口。
4. `AGENTS.md`、`CLAUDE.md` 各自只有一个标记块；重复运行原位更新块内文本，不修改块外项目指令。
5. `read-rules.py`、旧 Hook 和所有直接枚举或全量读取 RULE 的可执行指针在最终状态中均不存在。
6. Skill 重复运行不会重复追加、覆盖项目定制或产生并存协议；最终报告准确区分“待信任”“已激活”“迁移完成”。

## Handoff Status

- **设计已闭环**：文档格式、单文件 CLI、两个校验子命令、scope/load 契约、Codex 与 Claude Code Hook、失败策略、重复加载、跨平台命令、项目级配置合并、事务式迁移和 Agent 指针。
- **Claude Code 已确定**：使用同名 `UserPromptSubmit`、`SessionStart(compact)`、`SubagentStart` 事件；项目 `.claude/settings.json` 使用跨平台 exec form；正常注入使用 `hookSpecificOutput.additionalContext`；损坏时 warning 继续；约 `51 KB` 的最坏 load 通过宿主会话文件完整读取。
- **实施验收**：插件仓库实现后，仍须在 Claude Code `2.1.233` 或更高版本真实触发三个事件，并按 Acceptance Criteria 验证 Windows、工作区信任、最大 scope 和最坏 load；这是实施验收，不再是产品设计未决项。
- **明确不做**：独立子仓库 Hook/Agent 指令继承与分发、自动选择范围、RULE 索引、PreToolUse/Stop 强制拦截、load 自动分块。

Claude Code `2.1.233` 本机配置冒烟已确认 exec form 能解析并接受 `SessionStart`、`UserPromptSubmit` 的 `hookSpecificOutput.additionalContext`；`SubagentStart` 使用官方同一输出契约，留在插件实施阶段随真实子 Agent 一并做激活验收。

## References

- [OpenAI Codex Hooks](https://learn.chatgpt.com/docs/hooks)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- [Claude Code Tools Reference: Output Limits](https://code.claude.com/docs/en/tools-reference#output-limits)
