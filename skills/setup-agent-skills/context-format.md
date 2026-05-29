# CONTEXT.md Format

## 结构

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
{A one or two sentence description of the term}
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account

```

## Rules

- **要有主见。** 当同一概念存在多个词汇时，选择最好的一个，将其他的列为应避免的别名。
- **明确标记冲突。** 如果一个术语被歧义使用，在"标记的歧义"中指出并给出明确的解决方案。
- **定义要精炼。** 最多一到两句话。定义它*是*什么，而不是它做什么。
- **只包含本项目上下文特有的术语。** 通用编程概念（超时、错误类型、工具模式）不属于这里，即使项目大量使用它们。添加术语前先问：这是本上下文特有的概念，还是通用编程概念？只有前者才属于这里。
- **当自然聚类出现时按子标题分组。** 如果所有术语属于同一个内聚领域，平铺列表即可。

## Single vs multi-context repos

**Single context (most repos):** 仓库根目录一个 `CONTEXT.md`。

**多上下文：** 仓库根目录的 `CONTEXT-MAP.md` 列出各 contexts、它们的位置以及相互关系：

```md
# Context Map

## Contexts

每个 Context 声明一个**大写英文缩写前缀**，供 RULES 短号跨层引用消歧（系统级固定用 `SYS`）。

- **ORD** · [Ordering](./src/ordering/CONTEXT.md) — 接收和跟踪客户订单
- **BIL** · [Billing](./src/billing/CONTEXT.md) — 生成发票和处理付款
- **FUL** · [Fulfillment](./src/fulfillment/CONTEXT.md) — 管理仓库拣货和发货

## Relationships

- **Ordering → Fulfillment**: Ordering 发出 `OrderPlaced` 事件；Fulfillment 消费它们以开始拣货
- **Fulfillment → Billing**: Fulfillment 发出 `ShipmentDispatched` 事件；Billing 消费它们以生成发票
- **Ordering ↔ Billing**: 共享 `CustomerId` 和 `Money` 类型
```

本 skill 推断适用哪种结构：

- 如果 `CONTEXT-MAP.md` 存在，读取它来查找 contexts
- 如果只有根目录的 `CONTEXT.md`，则为单 contexts
- 如果两者都不存在，在第一个术语确定时按需创建根目录的 `CONTEXT.md`

当存在多个 contexts 时，推断当前话题与哪个相关。如果不确定，询问用户。
