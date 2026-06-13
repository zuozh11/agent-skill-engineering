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
- 如果输入存在歧义或关键信息缺失，调用 `grill-with-docs` 与用户对齐

### 2. 加载领域知识

按需查阅以下资源：

- **领域文档**（`CONTEXT.md` + `docs/rules/`）：默认读 `docs/CONTEXT.md`，并按 `docs/agents/domain.md` 的保守触发条件读取 `docs/rules/`：只要某条 RULES 有哪怕约 1% 的可能影响当前任务，就必须读取；只有能明确说明完全无关时才可跳过。不存在则静默继续。若存在 `docs/CONTEXT-MAP.md`（多 Context monorepo），规则分系统级 + Context 级**两层**、别只读根目录，定位相关 Context 与落点见 `docs/agents/domain.md`。

### 3. 调研与核验

起草任务前查阅以下内容，目标是定位改动入口、识别阻塞性歧义

- **代码现状**：定位需求涉及的入口模块/方法，记录文件名:行号；同类实现已有 1-2 个例子即可
- **业务口径**：核对会落到代码的字段、状态、规则；只要存在歧义就标阻塞，不在任务里替业务拍板
- **RULES**：依据 `docs/agents/domain.md` 的保守触发条件读取规则；只要有哪怕约 1% 的可能影响当前任务，就必须读取，只有明确完全无关才可跳过
- **相关 skill**：按需读取与需求领域相关的 skill 文件，提取实现约束

发现需求缺规则、自相矛盾、或拟定方案与 RULES 冲突时，**先回头对齐**，不在任务里偷偷拍板。

### 4. 阻塞性决策点收口

调研后识别"不解决就写不动任务"的技术方案选项。用 `提问工具` 提问，每题给推荐选项。

若候选技术方案与已有 RULES 冲突，标阻塞交用户确认是改方案还是改规则。

### 5. 拟草 vertical slices

将需求拆成 **tracer bullet** 任务。每个任务是一个薄的 vertical slice：

- 端到端切穿所有相关层
- 完成后可独立验证
- 优先多个薄 slice 而非少数厚 slice
- 无真实依赖、无预计写集冲突的 slice 保持彼此独立，不人为串成依赖链

### 6. 确认任务分解

向用户展示任务列表，每个任务显示：
- Title / Blocked by / 共享写集风险

问用户：粒度是否合适？依赖关系是否正确？

### 7. 写入任务文件

按依赖顺序（blocker 先写入）在 `docs/scratch/<feature-slug>/tasks/` 下创建文件。文件名用 `NN-<英文短slug>.md`（两位零填充、按依赖顺序编号，如 `01-create-schema.md`、`02-add-api.md`），与下游 impl 的读取路径及按编号引用（如「实现 02」）对齐。

### 8. 自动提交

任务落盘完成后立即提交。

## 单个 task 文件模板

```markdown
---
Status: ready-for-agent
Blocked by: None
---

## Parent

<有 PRD：[需求标题](../PRD.md)；从口头/截图等无 PRD 输入拆解时：写一句话需求摘要或指向需求来源，不要留指向不存在文件的死链>

## What to build

<vertical slice 描述：端到端行为，一句话概括>

## 适用 RULES

- <RULE-NN / SYS-NN / CTX-NN：规则标题——本任务必须遵守的执行约束>
- <如无适用规则：None，已扫描并排除 docs/rules/ 中明确完全无关的规则>

## 改动文件

- `module/path/File.ext`（现状：已有 YYY，缺 ZZZ）
- `module/path/AnotherFile.ext`（现状：无对应实现）

## 改动内容

### 改动点标题（文件名.方法名 / 文件名 — 片段描述）

<功能说明：这个改动点是为了什么，做什么，核心逻辑概述（1-2 句）>

<精简代码片段：可使用伪代码，可使用文字说明；只展示 `+`/`-` 行 + 必要上下文，未变内容用 `// ... 简短逻辑说明 ...` 截掉>

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

- **文字打头，代码佐证**：功能说明写在代码块上方，评审者读完就知道下面这段代码该不该这么写
- **代码块标识**： 用 ` ```diff ` + `+`/`-` 标记，红绿对比清晰
- **代码片段要精简**：只展示和本次改动直接相关的几行（`+`/`-` 行 + 简短上下文），未变的代码一律 `// ... 简短说明 ...` 省略
- **注释标记逻辑段落**：代码片段中每个 `+` 段落前加注释说明意图，让评审者扫注释就知道要做什么；只标"逻辑转折点"

## 硬性规则

- 每个任务必须端到端可验证（vertical slice），不允许纯水平切片（如"先写所有 Entity"）
- 任务拆分默认服务并行实现：没有真实业务依赖、没有预计写集冲突时，必须保持任务彼此独立，不得把编号顺序或实现习惯写成 `Blocked by`
- `Blocked by` 只表达两类阻塞：真实业务依赖（后续任务必须消费前序产物）或可预期写集冲突（共享核心文件、同一区域修改、同一配置 / 生成物 / task 状态文件等）；写入时必须说明串行原因
- 涉及未确认的表/字段/枚举时，任务标为阻塞，不写占位实现
- 每个任务必须包含 `## 适用 RULES`，列出所有已读取且适用或可能适用的规则；跳过规则只能因为明确完全无关，不能因为"不太像相关"而跳过
- 改动内容不得违反 `docs/rules/` 下适用的 RULES；确需偏离某条规则时标为阻塞、显式说明理由交用户确认，不在任务里默默违反、也不默默改规则
- 不在任务里复述"为什么这么定"——背景与取舍交给需求文档；RULES 是要遵守的项目规则，任务里只对齐执行、不复述论证
- 改动内容必须按改动点分节（`###` 小标题），每节至少有一段方向描述；纯散文一笔带过不达标
- 一个 `###` = 一个完整代码单元（方法体 / 类定义 / 配置片段），不要把同一个方法拆成多个小标题
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
- 整段方法贴出来，未变的字段拷贝、insert、事件发布都没省 —— 评审者得自己肉眼找哪几行是改的
- 缺文字方向说明 —— 看到代码才能反推意图，等于让评审者读两遍
- 同一个方法拆成两个 `###` —— 违反"一个 ### = 一个完整代码单元"

**反例 ❌（太虚 —— 纯散文，缺关键签名和代码佐证）：**

```markdown
### saveOrder — 加订单号生成

在保存接口里加上编号生成逻辑，按需求要求处理一下默认状态。
```

槽点：没有代码片段让评审者核对落点。开发拿到任务还得回头翻代码库确认。

**正例 ✅（文字 + 精简代码片段结合）：**

````markdown
### OrderAppService.saveOrder — 保存订单时生成订单号并默认进入待处理

落库前调用 `orderNoGenerator.next(dto.getBizType())` 生成订单号写入 `order.orderNo`；同时把初始状态从 `DicOrderStatus.DRAFT` 调整为 `DicOrderStatus.PENDING`（`status` 与 `statusText` 同步），使新订单直接进入待处理流转。

```diff
 public OrderVO saveOrder(OrderDTO dto) {
     // ... 基础字段拷贝 ...

+    // 按业务类型生成订单号
+    order.setOrderNo(orderNoGenerator.next(dto.getBizType()));

     // 设置初始状态
-    order.setStatus(DicOrderStatus.DRAFT.fullCode());
-    order.setStatusText(DicOrderStatus.DRAFT.dictName());
+    order.setStatus(DicOrderStatus.PENDING.fullCode());
+    order.setStatusText(DicOrderStatus.PENDING.dictName());

     // ... 落库与事件发布 ...
 }
```

订单号生成规则由 `OrderNoGenerator` 收口，本任务不改其内部实现。
````
