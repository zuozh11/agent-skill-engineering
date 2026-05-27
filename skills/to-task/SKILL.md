---
name: to-task
description: 将需求拆解为可独立实现的任务卡。适用于用户要求拆任务、出实施计划、把需求落到代码改动，或说「拆任务」「to-task」「出开发计划」等场景。
---

# To Task

将需求拆解为可独立实现的 vertical slice 任务卡，每个任务端到端可验证。

需求来源不限：PRD 文档、当前对话上下文、口头描述、截图、task 等均可作为输入。

任务文件存放在 `docs/scratch/<feature-slug>/tasks/` 下。

## 流程

### 1. 明确需求边界

确认输入来源并提取核心需求：
- 如果是文档（PRD/task），直接读取
- 如果是对话上下文，归纳用户已表达的意图
- 如果信息不足，用 `提问工具` 补齐关键缺失

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

调研后识别"不解决就写不动任务"的决策。用 `提问工具` 提问，每题给推荐选项。

### 5. 拟草 vertical slices

将需求拆成 **tracer bullet** 任务。每个任务是一个薄的 vertical slice：

- 端到端切穿所有相关层
- 完成后可独立验证
- 优先多个薄 slice 而非少数厚 slice

### 6. 确认任务分解

向用户展示任务列表，每个任务显示：
- Title / Blocked by / AFK or HITL / 共享写集风险

问用户：粒度是否合适？依赖关系是否正确？

### 7. 写入任务文件

按依赖顺序（blocker 先写入）在 `docs/scratch/<feature-slug>/tasks/` 下创建文件。

### 8. advisor 复审

所有任务落盘后调用 `advisor` 或者 `review agent` 复审一次。按反馈修订任务文件。

### 9. 自动提交

任务落盘完成后立即提交：

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

<可评审的具体实现：代码片段 / 配置 / 命令 / key=value>

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

## 硬性规则

- 每个任务必须端到端可验证（vertical slice），不允许纯水平切片（如"先写所有 Entity"）
- `Blocked by` 不只表达业务依赖，也表达可预期写集冲突；共享核心文件且可能同区修改时必须串行化
- 涉及未确认的表/字段/枚举时，任务标为阻塞，不写占位实现
- 不在任务里讨论"为什么这么做"——那是需求文档和 ADR 的职责
- 改动内容必须按改动点分节（`###` 小标题），每节包含可评审的具体实现（代码片段 / 配置 / 命令 / key=value），纯散文描述不达标
- 一个 `###` = 一个完整代码单元（方法体 / 类定义 / 配置片段）；方法内部多步逻辑用注释分段，不要把同一个方法拆成多个小标题
- 代码块内必须用简短注释标记逻辑段落，帮助评审者快速定位每段在做什么：
  - 方法体内每个逻辑段落前加一行简短注释，标记这段在做什么
  - 逻辑段落之间用空行分隔
  - 不要给单行赋值或简单 setter 加注释，只标记"逻辑转折点"
- 使用 CONTEXT.md 中的术语命名任务标题

## 代码块格式规则

根据改动类型选择代码块标识：

| 改动类型 | 代码块标识 | 标记方式 |
|----------|------------|----------|
| **插入型**（只新增代码） | 实际语言（`java`、`xml`、`sql`） | `+` 标记新增行 |
| **修改型**（改/删现有代码） | `diff` | `+`/`-` 标记改动行 |

**判断标准**：有没有 `-`（删除/替换行）
- 只有 `+` → 用语言标识（保留语法高亮）
- 有 `-` → 用 `diff`（红绿对比更清晰）

**格式要求**：
- 保留方法名和方法片段，展示改动点上下文（前后各 1-2 行）
- 省略无关代码，用 `// ... 省略说明 ...` 标记
- 改动行用 `+` 或 `-` 前缀标记，与上下文代码对齐

## 改动内容正反例

**反例 1（❌ 同一方法拆成多个小标题，逻辑不连续，需脑补拼接）：**

```markdown
### handleAwardPass — 回写来源询价包

​```java
BuPsInqPkgEntity inqPkgUpdate = new BuPsInqPkgEntity();
inqPkgUpdate.setInqPkgId(award.getInqPkgId());
inqPkgUpdate.setSourceStatus(DicSourceStatus.AWARDED.fullCode());
buPsInqPkgService.updateById(inqPkgUpdate);
​```

### handleAwardPass — 释放无中标物料对应需求池

- 每个物料判断其供应商是否存在 `isAward=Y`
- 无中标供应商的物料：通过 `inqPkgLineId` 找到 `reqPoolId`
- 批量调用 `buPsReqPoolService.updatePoolStatus`

### handleAwardPass — 幂等保护

按 `reqPoolId + operType + operDesc` 查重，存在则跳过。
```

**反例 2（❌ 方法完整但无注释，代码像一堵墙，评审者需逐行阅读）：**

```markdown
### BuPsAwardAppService.handleAwardPass — 审批通过完整数据流

定标审批通过的业务回写入口。回写定标状态和来源询价包寻源状态为已定标，识别无供应商中标的物料并释放对应需求池。

​```java
private void handleAwardPass(BuPsAwardVO award) {
    award.setAwardStatus(DicAwardStatus.AWARDED.fullCode());
    award.setAwardStatusText(DicAwardStatus.AWARDED.dictName());
    BuPsInqPkgEntity inqPkgUpdate = new BuPsInqPkgEntity();
    inqPkgUpdate.setInqPkgId(award.getInqPkgId());
    inqPkgUpdate.setSourceStatus(DicSourceStatus.AWARDED.fullCode());
    inqPkgUpdate.setSourceStatusText(DicSourceStatus.AWARDED.dictName());
    buPsInqPkgService.updateById(inqPkgUpdate);
    List<BuPsAwardLineVO> lines = buPsAwardLineAppService.queryBuPsAwardLineList(award.getAwardId());
    Map<String, String> reqPoolIdMap = buPsInqPkgLineAppService
        .queryBuPsInqPkgLineList(award.getInqPkgId()).stream()
        .collect(Collectors.toMap(BuPsInqPkgLineVO::getInqPkgLineId, BuPsInqPkgLineVO::getReqPoolId, (a, b) -> a));
    List<String> releasePoolIds = lines.stream()
        .filter(line -> line.getBuPsAwardSupList().stream().noneMatch(sup -> "Y".equals(sup.getIsAward())))
        .map(line -> reqPoolIdMap.get(line.getInqPkgLineId()))
        .filter(Objects::nonNull)
        .collect(Collectors.toList());
    if (CollUtil.isNotEmpty(releasePoolIds)) {
        buPsReqPoolService.updatePoolStatus(releasePoolIds, DicPoolStatus.PENDING);
        for (String poolId : releasePoolIds) {
            saveReleaseOperRecord(poolId, award);
        }
    }
}
​```
```

**正例（✅ 一个方法一个小标题，功能说明在前，完整方法体在后，注释标记逻辑段落）：**

```markdown
### BuPsAwardAppService.handleAwardPass — 审批通过完整数据流

定标审批通过的业务回写入口。回写定标状态和来源询价包寻源状态为已定标，识别无供应商中标的物料并释放对应需求池，同时写操作记录。

​```java
private void handleAwardPass(BuPsAwardVO award) {
    // 回写来源询价包寻源状态
    BuPsInqPkgEntity inqPkgUpdate = new BuPsInqPkgEntity();
    inqPkgUpdate.setInqPkgId(award.getInqPkgId());
    inqPkgUpdate.setSourceStatus(DicSourceStatus.AWARDED.fullCode());
    inqPkgUpdate.setSourceStatusText(DicSourceStatus.AWARDED.dictName());
    buPsInqPkgService.updateById(inqPkgUpdate);

    // 识别无中标物料，收集需释放的需求池
    List<BuPsAwardLineVO> lines = buPsAwardLineAppService.queryBuPsAwardLineList(award.getAwardId());
    Map<String, String> reqPoolIdMap = buPsInqPkgLineAppService
        .queryBuPsInqPkgLineList(award.getInqPkgId()).stream()
        .collect(Collectors.toMap(BuPsInqPkgLineVO::getInqPkgLineId, BuPsInqPkgLineVO::getReqPoolId, (a, b) -> a));
    List<String> releasePoolIds = lines.stream()
        .filter(line -> line.getBuPsAwardSupList().stream().noneMatch(sup -> "Y".equals(sup.getIsAward())))
        .map(line -> reqPoolIdMap.get(line.getInqPkgLineId()))
        .filter(Objects::nonNull)
        .collect(Collectors.toList());

    // 释放需求池并写操作记录（含幂等）
    if (CollUtil.isNotEmpty(releasePoolIds)) {
        buPsReqPoolService.updatePoolStatus(releasePoolIds, DicPoolStatus.PENDING);
        for (String poolId : releasePoolIds) {
            saveReleaseOperRecord(poolId, award);
        }
    }
}
​```

有中标供应商的物料保持需求池已打包，不更新。
```
