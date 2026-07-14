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

**Single context (most repos):** `docs/CONTEXT.md`。

**多上下文：** `docs/CONTEXT-MAP.md` 列出各 contexts、它们的位置、跨 Context 共享的平台术语以及相互关系：

```md
# Context Map

## Contexts

- **[Ordering](../src/ordering/docs/CONTEXT.md)** — 接收和跟踪客户订单
- **[Billing](../src/billing/docs/CONTEXT.md)** — 生成发票和处理付款
- **[Fulfillment](../src/fulfillment/docs/CONTEXT.md)** — 管理仓库拣货和发货

## 共享概念

被全部 Context 同等使用的平台级术语，在此只定义一次、各 Context 引用而不重复（用与 `CONTEXT.md` 相同的 **术语 / 定义 / _Avoid_** 三段式）。新增此类术语写本区，不要塞进某个 Context；它与 Relationships 不同——这里放术语定义，Relationships 放 Context 间的依赖关系。

**CustomerId**:
跨 Ordering 与 Billing 引用同一客户的稳定标识。
_Avoid_: ClientKey

## Relationships

- **Ordering → Fulfillment**: Ordering 发出 `OrderPlaced` 事件；Fulfillment 消费它们以开始拣货
- **Fulfillment → Billing**: Fulfillment 发出 `ShipmentDispatched` 事件；Billing 消费它们以生成发票
- **Ordering ↔ Billing**: 共享 `CustomerId` 和 `Money` 类型
```

本 skill 如何判定单/多 Context、以及多 Context 下当前话题归属哪个 Context（不确定就问用户），见 `docs/agents/domain.md`（唯一权威）。本文件只定义 `CONTEXT.md` 与 `CONTEXT-MAP.md` 的格式。
