# CONTEXT.md 格式

## 结构

```md
# {上下文名称}

{一两句话描述这个上下文是什么以及为什么存在。}

## 术语

**Order（订单）**:
{对该术语的简洁定义}
_避免使用_: Purchase, transaction

**Invoice（发票）**:
交付后发送给客户的付款请求。
_避免使用_: Bill, payment request

**Customer（客户）**:
下订单的个人或组织。
_避免使用_: Client, buyer, account

## 关系

- 一个 **Order** 产生一个或多个 **Invoice**
- 一个 **Invoice** 恰好属于一个 **Customer**

## 示例对话

> **开发者:** "当 **Customer** 下了一个 **Order** 时，我们是否立即创建 **Invoice**？"
> **领域专家:** "不——**Invoice** 只在 **Fulfillment** 确认后才生成。"

## 标记的歧义

- "account" 曾被用来同时表示 **Customer** 和 **User** ——已解决：这是两个不同的概念。
```

## 规则

- **要有主见。** 当同一概念存在多个词汇时，选择最好的一个，将其他的列为应避免的别名。
- **明确标记冲突。** 如果一个术语被歧义使用，在"标记的歧义"中指出并给出明确的解决方案。
- **定义要精炼。** 最多一句话。定义它*是*什么，而不是它做什么。
- **展示关系。** 使用加粗的术语名称，在明显时表达基数。
- **只包含本项目上下文特有的术语。** 通用编程概念（超时、错误类型、工具模式）不属于这里，即使项目大量使用它们。添加术语前先问：这是本上下文特有的概念，还是通用编程概念？只有前者才属于这里。
- **当自然聚类出现时按子标题分组。** 如果所有术语属于同一个内聚领域，平铺列表即可。
- **写一段示例对话。** 一段开发者和领域专家之间的对话，展示术语如何自然交互，并澄清相关概念之间的边界。

## 单上下文 vs 多上下文仓库

**单上下文（大多数仓库）：** 仓库根目录一个 `CONTEXT.md`。

**多上下文：** 仓库根目录的 `CONTEXT-MAP.md` 列出各上下文、它们的位置以及相互关系：

```md
# 上下文地图

## 上下文

- [Ordering](./src/ordering/CONTEXT.md) — 接收和跟踪客户订单
- [Billing](./src/billing/CONTEXT.md) — 生成发票和处理付款
- [Fulfillment](./src/fulfillment/CONTEXT.md) — 管理仓库拣货和发货

## 关系

- **Ordering → Fulfillment**: Ordering 发出 `OrderPlaced` 事件；Fulfillment 消费它们以开始拣货
- **Fulfillment → Billing**: Fulfillment 发出 `ShipmentDispatched` 事件；Billing 消费它们以生成发票
- **Ordering ↔ Billing**: 共享 `CustomerId` 和 `Money` 类型
```

本 skill 推断适用哪种结构：

- 如果 `CONTEXT-MAP.md` 存在，读取它来查找上下文
- 如果只有根目录的 `CONTEXT.md`，则为单上下文
- 如果两者都不存在，在第一个术语确定时按需创建根目录的 `CONTEXT.md`

当存在多个上下文时，推断当前话题与哪个相关。如果不确定，询问用户。
