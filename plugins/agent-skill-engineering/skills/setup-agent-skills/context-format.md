# CONTEXT 格式

本文件只定义项目采用的 Context 布局应怎样编写。任务运行时如何选择 Context 由项目知识协议说明。

<!-- layout:single:start -->
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
<!-- layout:single:end -->
<!-- layout:multiple:start -->
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
<!-- layout:multiple:end -->

## Frontmatter

每个 `CONTEXT.md` 文件开头必须提供单行简短说明：

```yaml
---
description: 供应商服务
---
```

`description` 使用非空单行普通文本，直接填写便于选择的简洁 Context 显示名称，例如「功能平移服务」「生产寻源服务」。不填写职责摘要、文件路径或技术栈。当前不添加其他 Frontmatter 字段。

<!-- layout:single:start -->
运行时 `scope` 以单行 JSON 返回单 Context 模式和 RULE 候选；`load` 自动加载 `docs/CONTEXT.md`，不能传 `--context`。
<!-- layout:single:end -->
<!-- layout:multiple:start -->
运行时 `scope` 以单行 JSON 返回 Map 注册的稳定 `path`、对应 `description` 和 RULE 候选。Agent 可将所选 `path` 作为可重复的 `load --context` 参数，也可只选择 RULE 而不加载具体 Context；`load` 始终保留 Map 的共享概念、Relationships 与其他正文，但省略已由 `scope` 提供的 `## Contexts` 发现列表。
<!-- layout:multiple:end -->

## 术语写法

- 定义项目特有概念，不记录通用编程术语。
- 同一概念选择一个统一名称，把应避免的别名写在 `_Avoid_` 中。
- 定义保持一到两句话；说明它是什么，不堆砌操作步骤。
- 术语自然聚类时再使用子标题，不为形式完整制造章节。

修改后运行：

```bash
node docs/agents/project-knowledge.mjs validate-context
```
