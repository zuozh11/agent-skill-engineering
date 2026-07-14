# 领域文档

工程类 skill 在探索代码库时应如何使用本仓库的领域文档。**本文件是领域文档「读取」与「落盘」的唯一权威说明**，覆盖单 Context 与多 Context 两种布局——各 skill 只需指向本文件，不再各自重复布局逻辑。

## 布局判定

- 存在 `docs/CONTEXT.md` → **单 Context**（大多数仓库）。
- 存在 `docs/CONTEXT-MAP.md` → **多 Context**（monorepo）。`CONTEXT-MAP.md` 列出各 Context 的位置与相互关系。
- 两者都没有 → 领域文档尚未建立，**静默继续**。

## 文件结构

单 Context 仓库（大多数仓库）：

```
/
├── docs/
│   ├── CONTEXT.md
│   └── rules/
│       ├── 01-数据权限-按部门隔离.md
│       └── 02-用户信息-从登录态获取.md
└── src/
```

多 Context 仓库（存在 `docs/CONTEXT-MAP.md`）：

```
/
├── docs/
│   ├── CONTEXT-MAP.md
│   └── rules/                          ← 全仓库统一规则
│       └── 01-日志必须带traceId.md
└── src/
    ├── ordering/
    │   └── docs/
    │       └── CONTEXT.md
    └── billing/
        └── docs/
            └── CONTEXT.md
```

> 上面的 `src/ordering`、`src/billing` **只是示例**。各 Context 的实际目录位置由 `CONTEXT-MAP.md` 的 Contexts 列表声明（链接里带路径），可能在 `src/`、`packages/`、`apps/`、`modules/`、`services/` 等任意路径下，不要假设一定在 `src/`。下文用 `<ctx-dir>/` 指代某个 Context 的目录——它的真实路径来自 `CONTEXT-MAP.md`。

## 探索前先读（读取解析）

**单 Context：**

- `docs/CONTEXT.md`
- `docs/rules/`——先列目录，再按保守触发条件读取规则。按需读取不是只读明显相关规则：只要某条 RULES 有哪怕约 1% 的可能影响当前任务的命名、单位、错误处理、权限、数据流、模块边界、集成方式、测试或验收，就必须读取；只有能明确说明完全无关时才可跳过。

**多 Context：**

1. 读 `docs/CONTEXT-MAP.md`，依据当前任务判断涉及哪个（或哪几个）Context；不确定就问用户。从 Contexts 列表的链接拿到该 Context 的目录 `<ctx-dir>/`（路径以地图为准，别假设在 `src/`）。
2. 读相关 Context 的 `<ctx-dir>/docs/CONTEXT.md`。`CONTEXT-MAP.md` 的「共享概念」区是被全部 Context 同等使用的平台级术语，对任何 Context 的任务都适用，一并读。
3. 读根 `docs/rules/`。RULES 不按 Context 拆分；先列目录，再按保守触发条件读取：只要某条 RULES 有哪怕约 1% 的可能影响当前任务的命名、单位、错误处理、权限、数据流、模块边界、集成方式、测试或验收，就必须读取；只有能明确说明完全无关时才可跳过。

任一文件不存在则**静默继续**。

## 自动提炼往哪写（落盘解析）

会话中提炼出新术语或新规则、经确认后写入时，**落点取决于布局**：

**单 Context：**

- 新术语 → `docs/CONTEXT.md`
- 新规则 → `docs/rules/`

**多 Context：**

- 新术语 → 它所属 Context 的 `<ctx-dir>/docs/CONTEXT.md`（`<ctx-dir>` 路径见 `CONTEXT-MAP.md`）。**被全部 Context 同等使用的平台级术语**（如业务单号、审批状态等跨域通用概念）→ `docs/CONTEXT-MAP.md` 的「共享概念」区，只定义一次、各 Context 引用而不重复；Context 之间的**依赖关系**（谁下达谁、谁引用谁的 ID）→ `CONTEXT-MAP.md` 的 Relationships。术语定义、共享术语、依赖关系是三类内容，别混。
- 新规则 → 统一写入根 `docs/rules/`。RULES 可在正文中说明适用的 Context，但目录、编号和短号不按 Context 拆分。
- 拿不准术语属于哪个 Context（还是平台级共享）时，在提议时一并问用户。

无论单 Context 还是多 Context，根 `docs/rules/` 都使用同一编号序列与 `RULE-NN` 短号，详见 `rules-format.md`。

格式见 `docs/agents/context-format.md`（CONTEXT.md）与 `docs/agents/rules-format.md`（RULES）。

## 使用术语表中的词汇

当输出涉及领域概念（task 标题、重构提案、假设、测试名称）时，使用 `CONTEXT.md` 中定义的术语。不要漂移到术语表明确避免的同义词。

## 标记 RULES 冲突

默认遵守现有 RULES。如果当前任务确有正当理由偏离某条规则，不要静默违反——显式标出冲突并说明理由，交用户裁决：

> _本实现与 RULES《数据权限-按部门隔离》冲突，因为……。是按规则约束改实现，还是更新这条规则？_
