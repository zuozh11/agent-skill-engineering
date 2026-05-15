# 领域文档

工程类 skill 在探索代码库时应如何使用本仓库的领域文档。

## 探索前先阅读

- 仓库根目录的 **`CONTEXT.md`**
- **`docs/adr/`** — 阅读与当前工作区域相关的架构决策记录（ADR）

如果这些文件不存在，**静默继续**。不要提示缺失，也不要建议提前创建。生产者 skill（`/grill-with-docs`）会在术语或决策实际确定时按需创建。

## 文件结构

单 Context 仓库（大多数仓库）：

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-xxx.md
│   └── 0002-xxx.md
└── src/
```

多 Context 仓库（根目录存在 `CONTEXT-MAP.md`）：

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← 系统级决策
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← Context 级决策
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## 使用术语表中的词汇

当输出涉及领域概念（task 标题、重构提案、假设、测试名称）时，使用 `CONTEXT.md` 中定义的术语。不要漂移到术语表明确避免的同义词。

如果你需要的概念不在术语表中，这是一个信号——要么你在发明项目不使用的语言（重新考虑），要么存在真正的空白（记录下来留给 `/grill-with-docs`）。

## 标记 ADR 冲突

如果你的输出与现有 ADR 矛盾，明确指出而不是静默覆盖：

> _与 ADR-NNNN（标题）矛盾——但值得重新讨论，因为……_
