# CONTEXT.md Format

## 结构

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**订单 (Order)**:
客户提交的购买请求，记录所购商品、数量、价格与履约状态。
_Avoid_: Purchase, transaction

**发票 (Invoice)**:
交付后向客户发送的付款请求。
_Avoid_: Bill, payment request

**客户 (Customer)**:
下达订单的个人或组织。
_Avoid_: Client, buyer, account

```

## Rules

- **要有主见。** 当同一概念存在多个词汇时，选择最好的一个，将其他的列为应避免的别名。
- **明确标记冲突。** 如果一个术语被歧义使用，在"标记的歧义"中指出并给出明确的解决方案。
- **定义要精炼。** 最多一到两句话。定义它*是*什么，而不是它做什么。
- **中文主名 + 英文/代码标识。** 术语以中文业务名为主；若存在稳定英文名或代码标识（字段名、包名、模块名、类名、接口名、枚举值、代码缩写等），写成 `中文术语 (EnglishOrCodeName)`。没有稳定标识时不要强行翻译。同一概念只保留一条词条，不要把中英文拆成两条。
- **只包含本项目上下文特有的术语。** 通用编程概念（超时、错误类型、工具模式）不属于这里，即使项目大量使用它们。添加术语前先问：这是本上下文特有的概念，还是通用编程概念？只有前者才属于这里。
- **当自然聚类出现时按子标题分组。** 如果所有术语属于同一个内聚领域，平铺列表即可。

## Single vs multi-context repos

**Single context (most repos):** `docs/CONTEXT.md`。

**multi-context：** `docs/CONTEXT-MAP.md` 列出各 contexts、它们的位置、跨 Context 共享的平台术语以及相互关系：

```md
# Context Map

## Contexts

每个 Context 声明一个**大写英文缩写前缀**，用于该 Context 级 RULES 的文件名前缀（`<CTX>-NN-<主题>.md`）和跨层引用短号消歧（系统级规则文件名不带前缀）。

- **ORD** · [Ordering](../src/ordering/docs/CONTEXT.md) — 接收和跟踪客户订单
- **BIL** · [Billing](../src/billing/docs/CONTEXT.md) — 生成发票和处理付款
- **FUL** · [Fulfillment](../src/fulfillment/docs/CONTEXT.md) — 管理仓库拣货和发货

## 共享概念

被全部 Context 同等使用的平台级术语，在此只定义一次、各 Context 引用而不重复（用与 `CONTEXT.md` 相同的 **术语 / 定义 / _Avoid_** 三段式）。新增此类术语写本区，不要塞进某个 Context；它与 Relationships 不同——这里放术语定义，Relationships 放 Context 间的依赖关系。

**客户标识 (CustomerId)**:
跨订购（Ordering）与账务（Billing）引用同一客户的稳定标识。
_Avoid_: ClientKey

## Relationships

- **订购 (Ordering) → 履约 (Fulfillment)**: 订购（Ordering）发出 `OrderPlaced` 事件；履约（Fulfillment）消费它们以开始拣货
- **履约 (Fulfillment) → 账务 (Billing)**: 履约（Fulfillment）发出 `ShipmentDispatched` 事件；账务（Billing）消费它们以生成发票
- **订购 (Ordering) ↔ 账务 (Billing)**: 共享 `CustomerId` 和 `Money` 类型
```

本 skill 如何判定单/多 Context、以及多 Context 下当前话题归属哪个 Context（不确定就问用户），见 `docs/agents/domain.md`（唯一权威）。本文件只定义 `CONTEXT.md` 与 `CONTEXT-MAP.md` 的格式。
