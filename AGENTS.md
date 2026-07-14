# AGENTS.md

## 仓库定位

这是一个由仓库所有者维护、主要供本人使用的 Agent Skill 仓库，目标是沉淀一套可复用、可组合、可持续迭代的工程工作流。

修改本仓库时，优先服务实际使用体验，不为了兼容假想用户、追求形式完整或引入通用框架而增加复杂度。除非用户明确要求，不做与当前需求无关的重构、抽象、批量改写或兼容层。

## 沟通与执行

- 始终使用简体中文回复；Skill 正文和面向用户的交互文案也默认使用简体中文。
- 先检查仓库真实状态再行动，不根据通用经验猜测现有结构、清单或约定。
- 需求有歧义且不同选择会显著改变结果时，使用当前宿主提供的提问工具确认，并给出推荐选项；能从仓库中查明的内容不要询问用户。
- 开始修改前说明准备做什么；执行时间较长时及时汇报进展。
- 用户要求使用子 Agent、并行调研或任务本身已规定编排方式时，不得因为任务简单或担心耗时而跳过。
- 不主动推送；“提交”默认仅指本地 commit。

## 目录与事实来源

- `skills/<skill-name>/SKILL.md`：Skill 的唯一权威实现。
- `skills/<skill-name>/` 下的其他 Markdown、脚本和资源：仅用于承载该 Skill 按需读取的细节。
- `skills/setup-agent-skills/domain.md`：领域文档布局、读取和落盘解析的唯一权威说明；其他 Skill 应引用它，不复制另一套完整规则。
- `.claude-plugin/plugin.json`：Claude 插件的 Skill 安装清单。
- `plugins/agent-skill-engineering/.codex-plugin/plugin.json`：Codex 插件元数据。
- `plugins/agent-skill-engineering/skills`：指向根目录 `skills/` 的符号链接，不得替换为复制目录。
- `.agents/plugins/marketplace.json`：个人插件市场入口。
- `README.md`：面向使用者的能力说明、安装方式和工作流总览。

同一规则不要在多个文件中维护互相独立的完整副本。需要复用时，选择一个权威文件，其余位置只保留简短说明和链接。

## Skill 设计原则

### 触发边界清晰

- 每个 Skill 只解决一个可清楚描述的问题。
- `description` 必须同时说明“做什么”和“什么时候触发”，包含用户可能说出的自然语言触发方式。
- 触发条件应尽量互斥。新增 Skill 前先检查是否应扩展现有 Skill，而不是制造职责重叠的新入口。
- 仅允许用户显式调用的 Skill，应保留 `disable-model-invocation: true`。

### 指令可执行

- 使用明确动作和顺序描述流程，避免“适当处理”“视情况优化”等无法验证的表述。
- 明确写出输入、输出路径、停止条件、需要用户确认的决策点和完成标准。
- 能通过仓库、代码、日志或工具确认的事实必须先验证，不把调查工作转嫁给用户。
- 涉及写入、提交、推送、删除、外部发布等有副作用的动作，要明确授权边界。
- 不在 Skill 中假设某个未声明的外部服务、私有环境或特定宿主能力必然存在。

### 渐进式披露

- `SKILL.md` 保留触发条件、核心流程、硬性规则和资源导航。
- 大段模板、专项方法、示例或平台差异应拆到同目录的独立文件中，并从 `SKILL.md` 明确说明何时读取。
- 脚本适合承载需要确定性、重复执行或容易抄错的机械操作；不要用脚本掩盖本应写清楚的决策规则。
- 新增引用文件后，检查所有相对链接均以当前 Skill 目录为基准且真实存在。

### 跨宿主兼容

- 规则优先描述能力和行为，不无必要地绑定 Codex、Claude 或其他单一宿主的专有名称。
- 确实依赖宿主能力时，明确写出所需能力和无该能力时的降级方式。
- “提问工具”“子 Agent”“文件编辑工具”等概念应与当前仓库已有表述保持一致；只有确需精确调用时才写具体工具名。
- 宿主专属配置放在对应插件目录，不把宿主差异散落到所有 Skill 中。

## 新增或修改 Skill

新增 Skill 时：

1. 使用小写 kebab-case 创建 `skills/<skill-name>/`。
2. 创建 `SKILL.md`，至少包含合法的 YAML frontmatter：

   ```yaml
   ---
   name: <skill-name>
   description: <能力说明与触发条件>
   ---
   ```

3. 确保 frontmatter 的 `name` 与目录名一致。
4. 只在确有渐进式披露或确定性执行需要时添加引用文档、`scripts/`、模板或其他资源。
5. 将 Skill 路径加入 `.claude-plugin/plugin.json` 的 `skills` 数组；保持现有排序风格且不得重复。
6. Codex 插件当前通过整个 `skills/` 目录自动发现 Skill，通常无需逐项登记；若清单结构发生变化，必须同步插件元数据。
7. 在 `README.md` 的对应分类中补充用途；若工作流、安装方式或目录布局有变化，同步更新相关章节。

修改已有 Skill 时：

- 修改前完整读取目标 `SKILL.md`，并读取本次流程实际涉及的直接引用文件。
- 保留其既有职责，除非用户明确要求改变行为或触发边界。
- 搜索 Skill 名称及相关规则在仓库中的全部引用，避免只改一处造成文档漂移。
- 若修改了共享约定，检查所有消费该约定的主管线和辅助 Skill。
- 不为了统一措辞而批量重写无关 Skill；把变更限制在可审查的最小范围内。

删除或重命名 Skill 时，必须同步清理插件清单、README、其他 Skill 的引用和安装示例，确认没有残留死链。

## 验证要求

本仓库当前没有统一构建或测试命令。每次变更至少完成与范围相称的静态验证：

- 检查所有一级 Skill 目录都包含 `SKILL.md`。
- 检查 YAML frontmatter 存在、字段合法，且 `name` 与目录名一致。
- 检查新增或修改的相对链接、脚本路径、输出路径真实可达。
- 检查 `plugins/agent-skill-engineering/skills` 仍是指向 `../../skills` 的符号链接。
- 对照 `skills/`、`.claude-plugin/plugin.json` 与 `README.md`，确认 Skill 清单没有遗漏、重复或失效项。
- 使用 `rg` 搜索被重命名或删除的术语、路径和 Skill 名称，确认无残留引用。
- 审阅 `git diff --check` 和最终 diff，确保没有尾随空格、意外生成物、私密信息或无关修改。

可直接执行的基础检查：

```bash
git diff --check
python3 -m json.tool .claude-plugin/plugin.json >/dev/null
python3 -m json.tool .agents/plugins/marketplace.json >/dev/null
python3 -m json.tool plugins/agent-skill-engineering/.codex-plugin/plugin.json >/dev/null
find skills -mindepth 2 -maxdepth 2 -name SKILL.md -print | sort
test "$(readlink plugins/agent-skill-engineering/skills)" = "../../skills"
git status --short
```

修改流程型 Skill 时，还要用至少一个具体用户场景从触发到完成走读流程，重点检查：

- 是否会在信息不足时擅自假设；
- 是否存在无法到达、循环不退出或互相矛盾的步骤；
- 用户确认点是否发生在副作用之前；
- 产物路径、后续 Skill 的输入和自动提交行为是否衔接一致。

## 文档与风格

- 标题和列表保持清晰，优先使用短句、表格和步骤，不堆砌口号。
- 规则使用 `必须`、`不得`、`默认`、`仅当` 等词表达约束强度。
- 示例应服务于边界理解，不为展示完整性而添加大量重复示例。
- 路径、命令、字段名和 Skill 名称使用反引号。
- README 面向使用者说明“有什么、怎么用”；实现细节和 Agent 维护规则放在对应 `SKILL.md`、引用文档或本文件中。

## 安全与仓库卫生

- 不读取、写入或提交 `.env`、凭据、令牌、个人会话数据及本地 Agent 运行状态。
- 不提交 `.DS_Store`、IDE 配置、缓存、日志、临时文件和生成物；发现已被 Git 跟踪时先报告，不擅自删除用户文件。
- 不使用破坏性 Git 命令覆盖用户改动。
- 工作区存在无关改动时保留它们，只编辑当前任务需要的文件。
- 引入外部 Skill 内容时，先核对许可、来源和实际需要；不要无差别复制整个上游仓库。
