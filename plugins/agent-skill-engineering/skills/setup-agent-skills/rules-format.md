# RULE 格式

本文件只定义 RULE 的收录、命名、引用和维护方式。Agent 先按场景发现候选，再按需下钻原子 RULE；`project-knowledge load` 负责展开正文和引用。

## 何时记录

满足下列任一类即可提议 RULE：

- 难以逆转、缺少背景会令人困惑且确实经过取舍的项目决策；
- 跨任务长期有效，Agent 不遵守就会产生不一致的项目约定或约束。

一次性结论、局部实现细节、通用知识、能直接从代码看出的事实和现有文档已覆盖的内容不记录。

## 文件名与场景

RULE 统一存放在领域文档根目录的 `docs/rules/`，文件名为：

```text
<sceneId><两位序号>-<sceneName>-<ruleName>.md
```

示例：

```text
A01-通用约束-优先改造现有骨架.md
C02-校验规则-字段校验用BeanValidation.md
```

- `sceneId` 使用一个或多个大写英文字母，同一 `sceneId` 始终对应同一 `sceneName`。
- 场景编码按重要程度排列，越重要越靠前。
- `ruleId` 由 `sceneId` 和两位序号组成；每个场景都从 `01` 开始连续编号，场景内序号同样按重要程度排列，`01` 最重要。
- `sceneName` 不包含 `-`；`ruleName` 应能直接说明约束。
- 新规则优先归入已有场景。确实需要新增场景时，由用户确认 `sceneId` 和 `sceneName`。

## 正文

每个 RULE 只表达一个可独立判断的原子约束。
正文写目标行为：改哪里、做什么、看到什么。平台默认和未纳入本期的范围不写成约束。

```markdown
---
references: []
---
# 查询必须按部门权限隔离

查询条件必须使用当前登录人的部门权限范围。
```

- 不在单条 RULE 中编写适用范围、长清单、示例、例外和验收章节。
- 多个可独立判断的约束必须拆成多个 RULE，并通过 `references` 表达直接关系。
- 确有共同背景时提炼为被引用的独立知识文件。

## 引用

RULE 的直接依赖写在文件开头的 `references`：

```yaml
---
references:
  - ../../architecture/query-contract.md
  - ../shared/platform-helper.md
---
```

- 每个 RULE 都必须提供 Frontmatter；没有直接依赖时写成：

  ```yaml
  ---
  references: []
  ---
  ```

- 每项使用相对于当前文件所在目录的 Markdown 路径，可引用 `docs/rules/` 外的项目知识文件；使用 `/` 分隔，不使用绝对路径、URL、锚点或通配符，解析后的真实文件必须位于项目根目录内。
- 只声明直接依赖；传递依赖由 `load` 展开。
- 普通被引用文件若继续依赖其他文件，使用同样的 `references` Frontmatter；没有 Frontmatter 的普通被引用文件视为递归终点。
- 引用项不重复，并按相对路径 UTF-8 字节序排列。
- 引用环允许存在，加载时按真实路径去重终止并给出提醒；RULE 与递归引用文件按项目根相对路径稳定排序，固定入口和所选 Context 仍保持入口优先与 Map 顺序。

运行时 `scope` 默认输出单行 JSON。每个 RULE 场景只返回 `sceneId`、`sceneName` 和 `rules`；`rules` 按 `ruleId` 排序，每项只含 `ruleId` 和 `ruleName`。`ruleName` 来自文件名去掉 `<ruleId>-<sceneName>-` 前缀和 `.md` 后缀，不返回路径或其他字段。

`load --rule` 可重复传入 `sceneId` 或 `ruleId`。`sceneId` 加载整个场景，`ruleId` 加载单条原子 RULE；多 Context 项目可以只选择 RULE，不必同时传入 `--context`。混合与重复选择按真实路径去重，并自动递归展开所选 RULE 及普通知识文件的 `references`。`load` 用 `## RULE <ruleId> · <标题>` 输出 RULE，省略 RULE Frontmatter 和重复一级标题，但正文行保持不变；普通递归引用文件保留完整内容。

## 创建、重命名与删除

创建、拆分或修改 RULE 后运行：

```bash
node docs/agents/project-knowledge.mjs validate-rules
```

迁移长 RULE 时，先列出原约束，再压缩或拆分为多个原子 RULE；拆出的每个文件都使用 Frontmatter，并用相对 `references` 保留原有依赖和语义。迁移前后逐项核对，不得因压缩丢失例外或验收含义。

迁移或增删 RULE 时，对每个场景从 `01` 连续重编号，并在同一次候选变更中同步所有入向 `references`；验证候选快照不存在缺失引用后再写入真实项目。

重命名或移动任意被引用文件时，在同一次变更中更新所有 `references`；RULE 的 `sceneId` 或 `sceneName` 变化时，同场景文件一起更新。删除前先查找入向引用，不保留别名或跳转文件。
