# 项目知识维护

本文件说明项目知识的使用和维护边界。运行时选择和加载由项目 Hook 与 `docs/agents/project-knowledge.mjs` 负责。

## 维护判断

任务中自然出现下列内容时，将其视为候选项目知识：

- 项目特有的术语、实体关系、Context 关系和规范命名；
- 长期有效，且 Agent 不遵守就容易实现跑偏的项目规则、决策或约定。

通用编程知识、一次性结论、局部实现细节、能直接从代码确认的事实以及现有文档已经覆盖的内容不记录。不要为了维护文档而强行扩展每个任务。

## 落点

<!-- layout:single:start -->
- 术语写入 `docs/CONTEXT.md`。
- 规则写入 `docs/rules/`。
<!-- layout:single:end -->
<!-- layout:multiple:start -->
- 某个 Context 专属术语写入地图声明的 `<ctx-dir>/CONTEXT.md`。
- 所有 Context 同等使用的平台术语写入 `docs/CONTEXT-MAP.md` 的 `## 共享概念`。
- Context 之间的依赖写入 `docs/CONTEXT-MAP.md` 的 `## Relationships`。
- 规则统一写入领域文档根目录的 `docs/rules/`，不按 Context 分目录。
<!-- layout:multiple:end -->

## 格式参考

<!-- layout:single:start -->
- 编写或修改 CONTEXT 前，读取 [CONTEXT 格式](./context-format.md)。
<!-- layout:single:end -->
<!-- layout:multiple:start -->
- 编写或修改 CONTEXT、CONTEXT-MAP 或 Context 关系前，读取 [CONTEXT 格式](./context-format.md)。
<!-- layout:multiple:end -->
- 编写、拆分、重命名或删除 RULE 前，读取 [RULE 格式](./rules-format.md)。

## 提议与落盘

<!-- layout:single:start -->
1. 先检查现有 CONTEXT 和 RULE，确认候选内容没有被覆盖。
<!-- layout:single:end -->
<!-- layout:multiple:start -->
1. 先检查现有 CONTEXT、CONTEXT-MAP 和 RULE，确认候选内容没有被覆盖。
<!-- layout:multiple:end -->
2. 向用户说明候选内容、依据和预计落点。
3. 只有用户确认且当前任务允许修改项目文档时才写入；只读任务只报告候选项。
4. 修改后运行对应 validator：

   ```bash
   node docs/agents/project-knowledge.mjs validate-context
   node docs/agents/project-knowledge.mjs validate-rules
   ```

## 冲突处理

候选内容与现有文档或代码冲突时，展示具体冲突并交给用户决定，不静默覆盖。已加载的 RULE 之间或 RULE 与当前需求冲突时同样先说明冲突；用户决定前不擅自选择一边。

## 领域感知

自行查证和追问时，使用当前任务已经由 `project-knowledge load` 返回的 CONTEXT 术语并遵守已加载的 RULE，不自行定位或重复读取领域文档。

- 后端仓库重点检查状态流转、持久化边界、查询隔离和流程回写；前端仓库重点检查页面流转、组件状态、表单校验和接口调用契约。
- 用户用词与 CONTEXT 冲突时立即指出；术语含糊或多义时提出精确的规范术语并要求确认。
- 讨论领域关系时使用具体场景压力测试边界。
- 用户陈述的现状与代码不一致时展示证据并要求对齐。
- 方案触及已加载 RULE 时检查冲突；发现违反时要求在修改方案与更新规则之间明确选择，不静默偏离。
