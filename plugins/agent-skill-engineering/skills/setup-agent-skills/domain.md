# 项目知识维护

本文件只说明哪些项目知识值得记录、写到哪里以及发生冲突时怎样处理。运行时选择和加载由项目 Hook 与 `docs/agents/project-knowledge.mjs` 负责。

## 维护判断

任务中自然出现下列内容时，将其视为候选项目知识：

- 项目特有的术语、实体关系、Context 关系和规范命名；
- 长期有效，且 Agent 不遵守就容易实现跑偏的项目规则、决策或约定。

通用编程知识、一次性结论、局部实现细节、能直接从代码确认的事实以及现有文档已经覆盖的内容不记录。不要为了维护文档而强行扩展每个任务。

## 落点

### 单 Context

- 术语写入 `docs/CONTEXT.md`。
- 规则写入 `docs/rules/`。

### 多 Context

- 某个 Context 专属术语写入地图声明的 `<ctx-dir>/CONTEXT.md`。
- 所有 Context 同等使用的平台术语写入 `docs/CONTEXT-MAP.md` 的 `## 共享概念`。
- Context 之间的依赖写入 `docs/CONTEXT-MAP.md` 的 `## Relationships`。
- 规则统一写入领域文档根目录的 `docs/rules/`，不按 Context 分目录。

CONTEXT 与 CONTEXT-MAP 的格式见 `docs/agents/context-format.md`，RULE 的格式和场景命名见 `docs/agents/rules-format.md`。

## 提议与落盘

1. 先检查现有 CONTEXT、CONTEXT-MAP 和 RULE，确认候选内容没有被覆盖。
2. 向用户说明候选内容、依据和预计落点。
3. 只有用户确认且当前任务允许修改项目文档时才写入；只读任务只报告候选项。
4. 修改后运行对应 validator：

   ```bash
   node docs/agents/project-knowledge.mjs validate-context
   node docs/agents/project-knowledge.mjs validate-rules
   ```

## 冲突处理

候选内容与现有文档或代码冲突时，展示具体冲突并交给用户决定，不静默覆盖。已加载的 RULE 之间或 RULE 与当前需求冲突时同样先说明冲突；用户决定前不擅自选择一边。
