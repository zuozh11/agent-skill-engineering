# CONTEXT 格式

本文件只定义 `CONTEXT.md` 与 `CONTEXT-MAP.md` 应怎样编写。任务运行时如何选择 Context 由项目 Hook 说明。

## 单 Context

入口为 `docs/CONTEXT.md`：

```markdown
---
description: 订单服务
---
# Ordering

## Language

**Order**:
客户确认购买后形成的交易意向。
_Avoid_: Purchase
```

## 多 Context

入口为 `docs/CONTEXT-MAP.md`，每个 Context 的术语文件直接放在其根目录：

```markdown
# Context Map

## Contexts

- [订单](../ordering/CONTEXT.md)
- [结算](../billing/CONTEXT.md)

## 共享概念

**CustomerId**:
跨 Context 引用同一客户的稳定标识。

## Relationships

- **Ordering → Billing**: Ordering 提供已确认订单，Billing 据此结算
```

`## Contexts` 中每项只放一个普通 Markdown 链接。目标 `CONTEXT.md` 的 `description` 是 `scope` 发现列表中的显示名称；列表顺序就是 `scope` 的展示顺序。

链接必须是指向 `CONTEXT.md` 的相对文件路径，目标真实存在且位于领域文档根目录内。`## 共享概念` 和 `## Relationships` 不参与 Context 注册。

## Frontmatter

每个 `CONTEXT.md` 文件开头必须提供单行简短说明：

```yaml
---
description: 供应商服务
---
```

`description` 使用非空单行普通文本，直接填写便于选择的简洁 Context 显示名称，例如“功能平移服务”“生产寻源服务”。不填写职责摘要、文件路径或技术栈。当前不添加其他 Frontmatter 字段。

运行时 `scope` 只返回 Map 注册的稳定 `path` 和对应 `description`，并以单行 JSON 输出；`scope --compact` 是等价兼容入口。`scope --pretty` 只美化相同数据，仅供人类在终端手动查看，Agent 项目知识加载禁止使用。Agent 将所选 `path` 作为可重复的 `load --context` 参数。`load --compact` 用 `## CONTEXT <description>` 替代 Context Frontmatter 和重复一级标题；多 Context 项目的 Map 保留共享概念、Relationships 与其他正文，但省略已由 `scope` 提供的 `## Contexts` 发现列表。完整 `load` 保留原始诊断信息。

## 术语写法

- 定义项目特有概念，不记录通用编程术语。
- 同一概念选择一个统一名称，把应避免的别名写在 `_Avoid_` 中。
- 定义保持一到两句话；说明它是什么，不堆砌操作步骤。
- 术语自然聚类时再使用子标题，不为形式完整制造章节。

修改后运行：

```bash
node docs/agents/project-knowledge.mjs validate-context
```
