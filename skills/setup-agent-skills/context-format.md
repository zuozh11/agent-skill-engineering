# CONTEXT 格式

本文件只定义 `CONTEXT.md` 与 `CONTEXT-MAP.md` 应怎样编写。任务运行时如何选择 Context 由项目 Hook 说明。

## 单 Context

入口为 `docs/CONTEXT.md`：

```markdown
---
description: 管理订单创建、履约与状态流转
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

`## Contexts` 中每项只放一个普通 Markdown 链接。链接文本用于识别，业务说明放在目标 `CONTEXT.md` 的 `description` 中；列表顺序就是 `scope` 的展示顺序。

链接必须是指向 `CONTEXT.md` 的相对文件路径，目标真实存在且位于领域文档根目录内。`## 共享概念` 和 `## Relationships` 不参与 Context 注册。

## Frontmatter

每个 `CONTEXT.md` 文件开头必须提供单行简短说明：

```yaml
---
description: 管理供应商注册、主数据、评价与状态等全生命周期业务
---
```

`description` 使用非空单行普通文本，不重复文件路径、Context 名称或技术栈。当前不添加其他 Frontmatter 字段。

## 术语写法

- 定义项目特有概念，不记录通用编程术语。
- 同一概念选择一个统一名称，把应避免的别名写在 `_Avoid_` 中。
- 定义保持一到两句话；说明它是什么，不堆砌操作步骤。
- 术语自然聚类时再使用子标题，不为形式完整制造章节。

修改后运行：

```bash
node docs/agents/project-knowledge.mjs validate-context
```
