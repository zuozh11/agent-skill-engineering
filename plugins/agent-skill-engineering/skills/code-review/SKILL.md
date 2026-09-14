---
name: code-review
description: 只读评审指定代码范围，核对项目规范与已确认需求；支持 --std、--spec。
---

# Code Review

对固定代码范围执行一次只读评审，交付有明确来源与代码证据的问题、覆盖情况及结论。保持代码、提交与远端状态不变。

## 选择维度

用户或调用方指定 `--std` / `--spec` 时，只启用指定维度；未指定时分别启用有依据的维度。候选依据按来源分类，历史或已被本次明确要求取代的内容不作依据：

| 维度 | 依据 | 按需读取 |
| --- | --- | --- |
| Standards | 项目全部 RULE、Agent 工程指令、代码必要性 | [STANDARDS.md](./STANDARDS.md) |
| Spec | PRD、API 清单、任务卡、Issue、当前对话已确认的业务规则 | [SPEC.md](./SPEC.md) |

项目 RULE 即使包含权限、状态或业务流程，也只归 Standards；需求来源只归 Spec。调用方提供的候选必须纳入对应维度判断，Standards 的候选列表不能缩小项目全部 RULE 的覆盖范围。只启用 Spec 时，直接进入 Spec 分支，不读取 Standards 参考或执行 RULE 加载流程。

## 固定评审范围

优先使用调用方或用户指定的 commit、branch、tag、range、PR 或路径，并记录实际 diff 命令和 commit 列表。分支使用 `git diff <fixed-point>...HEAD`。

调用方指定的 commit、range 或 pathspec 与用户指定同等优先。`impl` 传入单笔提交时，范围就是该 SHA，不使用分支 merge-base。

用户未明确固定点时：

- PR 编号或 URL：解析真实 base、head 和 patch；
- 当前分支：使用可确认的上游或默认分支 merge-base，无法确认时提问；
- 未提交改动：覆盖未暂存、已暂存和未跟踪文件；
- 文件或目录当前实现：完整读取 [SNAPSHOT.md](./SNAPSHOT.md) 固定文件列表和工作区状态。

用户指定路径时用同一 pathspec 限制范围。引用无效、diff 为空或 snapshot 无有效文件时停止。

## 执行与交付

两个维度只共享固定代码范围，使用隔离输入：Standards 仅接收它的依据和参考；Spec 仅接收它的依据和参考。两个维度同时启用时，以独立执行上下文并行评审，完成前不交换中间结论；委派时只传该维度的输入，不继承另一维度材料或整段会话。

Standards 可由主 Agent 执行，也可按 RULE 清单的连续区间分批委派；每批接收完整固定范围，返回区间内每个 RULE 的唯一判定。只启用 Spec 时可由一个 Spec 子 Agent 完成。主 Agent 按对应参考完成终检后合并报告，分批不改变全量覆盖要求。

输出先说明固定点、实际 diff 命令和路径，再给出已启用维度的结果。Standards 的全部 RULE 表与 R/R、H/H 终检由 STANDARDS.md 定义，Spec 的需求覆盖与问题格式由 SPEC.md 定义。缺失必要材料时如实说明该维度未完成，不宣称通过。
