---
name: to-prd
description: 将当前对话上下文转化为 PRD。适用于用户要求产出 PRD、需求文档、功能方案，或说「写个 PRD」「出需求文档」「to-prd」等场景。
---

# To PRD

将当前对话上下文和代码库理解合成为一份 PRD。

PRD 存放在 `docs/scratch/<feature-slug>/PRD.md`。

## 流程

### 1. 加载领域知识

按需查阅以下资源：

- **领域文档**（`CONTEXT.md` + `docs/rules/`）：默认读 `docs/CONTEXT.md` + `docs/rules/`（按文件名挑相关的读，拿不准就读；不存在则静默继续）。若存在 `docs/CONTEXT-MAP.md`（多 Context monorepo），规则分系统级 + Context 级**两层**、别只读根目录，定位相关 Context 与落点见 `docs/agents/domain.md`。

### 2. 探索代码库

如果尚未探索，先了解当前代码库状态。使用 `CONTEXT.md` 中的领域术语，遵守并对齐 `docs/rules/` 中的规则（RULES），让 PRD 的 Requirements 与既有规则约束一致。

### 3. 追问对齐上下文

完成领域知识加载和代码库探索后，先用 `grill-with-docs` 的追问流程把上下文对齐到足以产出高质量 PRD——这一步默认必跑，不预设当前上下文已经充分。

只要当前上下文尚未加载/执行过 `grill-with-docs`，就直接执行其追问流程，将确认的结论作为 PRD 输入继续后续步骤；若已执行过则跳过本步。

### 4. 确定 feature slug 和输出路径

- 输出路径：`docs/scratch/<feature-slug>/PRD.md`
- feature-slug 从需求主题推导（如 `sup-quote-export`、`delivery-plan-change`）
- 如目录不存在则创建

### 5. 确定书写视角

根据当前仓库技术栈自动选择主视角：
- 后端仓库：侧重业务规则（状态流转、持久化、查询隔离、流程回写）
- 前端仓库：侧重交互行为（页面流转、组件状态、表单校验、接口调用契约）

### 6. 拟草 PRD

使用下方模板。重点：
- User Stories 要覆盖面广（numbered list）
- Requirements 按能力项组织，规则优先
- Implementation Decisions 含锁定决策和待补输入
- 凡 Requirements 中受 `docs/rules/` 约束的口径，在锁定决策「来源」列标注依据规则的短号（短号格式见 `docs/agents/rules-format.md`：单 Context 用 `RULE-NN`，多 Context 用 `SYS-NN` / `<CTX>-NN`）；若某需求与既有 RULES 冲突，不擅自覆盖，写入 Open Questions 用提问工具向用户确认。
- 不写代码库能力缺口对比（留给 to-task 调研阶段）

### 7. 收敛未决问题

**强制规则：** 只要 Open Questions 或 Assumptions 中有未解决项，必须用 `提问工具` 主动追问。不允许只写不问。

每轮用户回答后立刻更新 PRD，清理已确认的问题。循环直到所有问题解决或明确标记为暂不处理。

### 8. 发布

将 PRD 写入 `docs/scratch/<feature-slug>/PRD.md`。

### 9. 自动提交

PRD 发布完成后立即提交。

## PRD 模板

```markdown
# <功能名称> PRD

## Scope
<本次包含的业务范围、页面、接口、角色>

## Out of Scope
<本次明确不做的内容>

## User Stories
1. As a <角色>, I want <功能>, so that <收益>
2. ...（覆盖面要广）

## Requirements
### <能力项 1>
- 规则：<业务规则、状态、权限、校验>
- 功能：<系统要提供什么能力>

### <能力项 2>
- 规则：...
- 功能：...

## Implementation Decisions
### 锁定决策
| 决策项 | 决策值 | 来源 |
|---|---|---|
| ... | ... | 用户确认 / RULES / PRD |

## Assumptions
- <尚未确认但当前按此推进的假设>

## Open Questions
- <暂时无法确认的业务问题>

```

## 质量要求

- Requirements 以规则优先，先写规则再补功能
- 对关键口径做「可实施性精度」自检：字段清单是否完整、日期/状态/编号是否有明确时机和值
- 不伪造已确认事实；无法确认的写入 Open Questions
- 不写实现流水账、技术建议或改造建议
- 使用 CONTEXT.md 中定义的术语，不漂移到同义词
