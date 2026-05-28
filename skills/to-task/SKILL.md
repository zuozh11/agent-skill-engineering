---
name: to-task
description: 将需求拆解为可独立实现的任务卡。适用于用户要求拆任务、出实施计划、把需求落到代码改动，或说「拆任务」「to-task」「出开发计划」等场景。
---

# To Task

将需求拆解为可独立实现的 vertical slice 任务卡，每个任务端到端可验证。

任务卡的目的是把"需求 → 代码"之间的决策一次性收口：前置完成调研、定位和方案选择，让下游执行者拿卡即可动手，无需再回头翻需求或追问业务。一份合格的任务卡 = 一次已被评审通过的实现方案。

需求来源不限：PRD 文档、当前对话上下文、口头描述、截图、task 等均可作为输入。

任务文件存放在 `docs/scratch/<feature-slug>/tasks/` 下。

## 流程

### 1. 明确需求边界

确认输入来源并提取核心需求：
- 如果是文档（PRD/task），直接读取
- 如果是对话上下文，归纳用户已表达的意图
- 如果输入存在歧义或关键信息缺失，用 `提问工具` 补齐

### 2. 加载领域知识

按需查阅以下资源：

- 仓库根目录的 **`CONTEXT.md`**
- **`docs/adr/`** — 强制读取全部架构决策记录（ADR），无需判断相关性，每次任务开始前直接全部读取

### 3. 调研与核验

起草任务前，**逐项读取**以下内容（不凭记忆，必须打开文件确认）：

- **代码现状**：定位需求涉及的现有模块、文件、方法，记录文件名:行号
- **业务口径**：逐项核对需求中的字段、状态、规则是否可落地
- **项目规则**：读取 `CLAUDE.md` / `AGENTS.md` 中的项目约定
- **ADR**：读取 `docs/adr/` 中全部决策记录
- **相关 skill**：读取与需求领域相关的 skill 文件，提取实现约束

发现需求缺规则或自相矛盾时，**先回头补需求**，不在任务里偷偷拍板。

### 4. 阻塞性决策点收口

调研后识别"不解决就写不动任务"的技术方案选项。用 `提问工具` 提问，每题给推荐选项。

### 5. 拟草 vertical slices

将需求拆成 **tracer bullet** 任务。每个任务是一个薄的 vertical slice：

- 端到端切穿所有相关层
- 完成后可独立验证
- 优先多个薄 slice 而非少数厚 slice

### 6. 确认任务分解

向用户展示任务列表，每个任务显示：
- Title / Blocked by / 共享写集风险

问用户：粒度是否合适？依赖关系是否正确？

### 7. 写入任务文件

按依赖顺序（blocker 先写入）在 `docs/scratch/<feature-slug>/tasks/` 下创建文件。

### 8. advisor 复审

所有任务落盘后调用 `advisor` 或者 `review agent` 复审一次。按反馈修订任务文件。

### 9. 自动提交

任务落盘完成后立即提交

## 单个 task 文件模板

```markdown
---
Status: ready-for-agent
Blocked by: None
---

## Parent

[需求标题](../PRD.md)

## What to build

<vertical slice 描述：端到端行为，一句话概括>

## 改动文件

- `module/path/File.ext`（现状：line XX 已有 YYY，缺 ZZZ）
- `module/path/AnotherFile.ext`（现状：无对应实现）

## 改动内容

### 改动点标题（文件名.方法名 / 文件名 — 片段描述）

<功能说明：这个改动点是为了什么，做什么，核心逻辑概述（1-2 句）>

<可评审的具体实现：改动片段>

<约束或注意事项（可选，1-2 句）>

### 下一个改动点…

## 明确不做

- <本任务边界外的相关功能点>

## 验收

- [ ] 场景 1：<可独立验证的操作或请求>
- [ ] 场景 2：<边界场景>
```

## 任务卡质量标准

**好（开发可直接动手）：**
- 改动文件精确到路径
- 现状段写明行号和已有逻辑摘要
- 改动内容有伪码或模板
- 验收是具体的操作 + 预期结果

**差（开发还得回去翻需求）：**
- "在保存接口里加上编号生成逻辑，按需求要求处理"
- "按占位表 xxx 查询，联调前替换"

## 评审友好原则

**任务卡的首要读者是人类评审者**，格式、排版、样式都要为「快速扫读 + 精准定位 + 一眼判断对错」服务：

- **判断点前置**：功能说明写在代码块上方，评审者读完就知道下面这段代码该不该这么写
- **省略要显式**：无关代码用 `// ... 省略说明 ...` 标记，不要让评审者怀疑"是不是漏了"
- **注释标记逻辑段落**：方法体内每个逻辑段落前加一行简短注释，段落之间空行分隔，让评审者扫注释就能掌握流程；只标"逻辑转折点"
- **代码块可直接对照**：保留方法名和上下文，按改动类型选代码块标识
  - 有删除/替换行（含 `-`）：用 ` ```diff ` + `+`/`-` 标记，红绿对比清晰
  - 只有新增行（仅 `+`）：用语言标识（`java` / `xml` / `sql`），保留语法高亮

## 硬性规则

- 每个任务必须端到端可验证（vertical slice），不允许纯水平切片（如"先写所有 Entity"）
- `Blocked by` 不只表达业务依赖，也表达可预期写集冲突；共享核心文件且可能同区修改时必须串行化
- 涉及未确认的表/字段/枚举时，任务标为阻塞，不写占位实现
- 不在任务里讨论"为什么这么做"——那是需求文档和 ADR 的职责
- 改动内容必须按改动点分节（`###` 小标题），每节包含可评审的改动片段，纯散文描述不达标
- 一个 `###` = 一个完整代码单元（方法体 / 类定义 / 配置片段）；方法内部多步逻辑用注释分段，不要把同一个方法拆成多个小标题
- 使用 CONTEXT.md 中的术语命名任务标题

## 改动内容正反例

**反例（❌ 同时踩 4 个坑：用错代码块标识、不省略、拆多标题、功能说明缺失）：**

````markdown
### saveOrder — 加订单号生成

```java
public OrderVO saveOrder(OrderDTO dto) {
    OrderEntity order = new OrderEntity();
    order.setOrderId(IdUtil.getSnowflakeNextIdStr());
    order.setCustomerId(dto.getCustomerId());
    order.setAmount(dto.getAmount());
    order.setRemark(dto.getRemark());
    order.setCreateTime(LocalDateTime.now());
    order.setOrderNo(orderNoGenerator.next(dto.getBizType()));
    order.setStatus(DicOrderStatus.PENDING.fullCode());
    order.setStatusText(DicOrderStatus.PENDING.dictName());
    orderMapper.insert(order);
    eventBus.publish(new OrderCreatedEvent(order.getOrderId()));
    return OrderConverter.toVO(order);
}
```

### saveOrder — 改默认状态

把 `DRAFT` 改成 `PENDING`。
````

槽点：
- 用 ` ```java ` 而不是 ` ```diff ` —— 评审者看不出哪几行是改的
- 整段方法贴出来，没有 `// ... 省略 ...` —— 评审者怀疑是不是连无关代码也动了
- 同一个方法拆成两个 `###` —— 违反"一个 ### = 一个完整代码单元"
- 功能说明在代码下方/缺失 —— 评审者得先读完代码再回头猜意图

**正例（✅ 一个标题、说明前置、`diff` 块、上下文省略、注释分段）：**

````markdown
### OrderAppService.saveOrder — 保存订单时生成订单号并默认进入待处理

订单保存入口。在落库前按业务类型生成订单号，并把默认状态从 `DRAFT` 调整为 `PENDING`，使新订单直接进入待处理流转。

```diff
 public OrderVO saveOrder(OrderDTO dto) {
     OrderEntity order = new OrderEntity();
     order.setOrderId(IdUtil.getSnowflakeNextIdStr());
     // ... 基础字段拷贝省略 ...

+    // 按业务类型生成订单号
+    order.setOrderNo(orderNoGenerator.next(dto.getBizType()));
+
     // 设置初始状态
-    order.setStatus(DicOrderStatus.DRAFT.fullCode());
-    order.setStatusText(DicOrderStatus.DRAFT.dictName());
+    order.setStatus(DicOrderStatus.PENDING.fullCode());
+    order.setStatusText(DicOrderStatus.PENDING.dictName());

     orderMapper.insert(order);
     // ... 事件发布与返回省略 ...
 }
```

订单号生成规则由 `OrderNoGenerator` 收口，本任务不改其内部实现。
````

对应 4 条评审友好原则：
- **判断点前置**：功能说明在代码块上方，评审者读完就能判断下面对不对
- **省略显式**：无关行用 `// ... 省略 ...` 截掉，不留疑问
- **注释分段**：`// 按业务类型生成订单号` / `// 设置初始状态` 标记逻辑转折点
- **代码块对照**：` ```diff ` + `+`/`-` + 上下文 1-2 行，红绿一眼看清
