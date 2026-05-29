# 领域文档

工程类 skill 在探索代码库时应如何使用本仓库的领域文档。**本文件是领域文档「读取」与「落盘」的唯一权威说明**，覆盖单 Context 与多 Context 两种布局——各 skill 只需指向本文件，不再各自重复布局逻辑。

## 布局判定

- 根目录有 `CONTEXT.md` → **单 Context**（大多数仓库）。
- 根目录有 `CONTEXT-MAP.md` → **多 Context**（monorepo）。`CONTEXT-MAP.md` 列出各 Context 的位置与相互关系。
- 两者都没有 → 领域文档尚未建立，**静默继续**。

## 文件结构

单 Context 仓库（大多数仓库）：

```
/
├── CONTEXT.md
├── docs/rules/
│   ├── 01-数据权限-按部门隔离.md
│   └── 02-用户信息-从登录态获取.md
└── src/
```

多 Context 仓库（根目录存在 `CONTEXT-MAP.md`）：

```
/
├── CONTEXT-MAP.md
├── docs/rules/                        ← 系统级规则
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/rules/                ← Context 级规则
    └── billing/
        ├── CONTEXT.md
        └── docs/rules/
```

> 上面的 `src/ordering`、`src/billing` **只是示例**。各 Context 的实际目录位置由 `CONTEXT-MAP.md` 的 Contexts 列表声明（链接里带路径），可能在 `src/`、`packages/`、`apps/`、`modules/`、`services/` 等任意路径下，不要假设一定在 `src/`。下文用 `<ctx-dir>/` 指代某个 Context 的目录——它的真实路径来自 `CONTEXT-MAP.md`。

## 探索前先读（读取解析）

**单 Context：**

- 根目录的 `CONTEXT.md`
- 根目录的 `docs/rules/`——先列目录，依据文件名（自描述，说明每条规则管什么）判断哪些与当前任务相关，读取相关规则；拿不准就读。

**多 Context：**

1. 读根目录 `CONTEXT-MAP.md`，依据当前任务判断涉及哪个（或哪几个）Context；不确定就问用户。从 Contexts 列表的链接拿到该 Context 的目录 `<ctx-dir>/`（路径以地图为准，别假设在 `src/`）。
2. 读相关 Context 的 `<ctx-dir>/CONTEXT.md`。
3. 读**两层规则**：系统级（根 `docs/rules/`）+ 相关 Context 级（`<ctx-dir>/docs/rules/`）。两层都按文件名挑相关的读；拿不准就读。

任一文件不存在则**静默继续**。

## 自动提炼往哪写（落盘解析）

会话中提炼出新术语或新规则、经确认后写入时，**落点取决于布局**：

**单 Context：**

- 新术语 → 根 `CONTEXT.md`
- 新规则 → 根 `docs/rules/`

**多 Context：**

- 新术语 → 它所属 Context 的 `<ctx-dir>/CONTEXT.md`（`<ctx-dir>` 路径见 `CONTEXT-MAP.md`）；跨 Context 的关系写进根 `CONTEXT-MAP.md` 的 Relationships。
- 新规则 → 按**作用域**落层：全系统通用的落系统级（根 `docs/rules/`），仅某 Context 内有效的落该 Context 级（`<ctx-dir>/docs/rules/`）。
- 拿不准术语属于哪个 Context、或规则该落哪一层，在提议时一并问用户。
- 各层 `docs/rules/` 各自从 `01` 起独立编号；规则短号跨层引用要加大写前缀消歧（系统级 `SYS-NN`、Context 级 `<CTX>-NN`，前缀见 `CONTEXT-MAP.md`，详见 `rules-format.md`）。

格式见 `docs/agents/context-format.md`（CONTEXT.md）与 `docs/agents/rules-format.md`（RULES）。

## 使用术语表中的词汇

当输出涉及领域概念（task 标题、重构提案、假设、测试名称）时，使用 `CONTEXT.md` 中定义的术语。不要漂移到术语表明确避免的同义词。

## 标记 RULES 冲突

默认遵守现有 RULES。如果当前任务确有正当理由偏离某条规则，不要静默违反——显式标出冲突并说明理由，交用户裁决：

> _本实现与 RULES《数据权限-按部门隔离》冲突，因为……。是按规则约束改实现，还是更新这条规则？_
