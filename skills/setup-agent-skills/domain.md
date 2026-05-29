# 领域文档

工程类 skill 在探索代码库时应如何使用本仓库的领域文档。

## 探索前先阅读

- 仓库根目录的 **`CONTEXT.md`**
- **`docs/rules/`** — 项目规则（RULES）。先列出该目录，依据文件名（自描述，说明每条规则管什么）判断哪些与当前任务相关，读取相关规则；拿不准就读。

如果这些文件不存在，**静默继续**。

## 文件结构

单 Context 仓库（大多数仓库）：

```
/
├── CONTEXT.md
├── docs/rules/
│   ├── 数据权限-按部门隔离.md
│   └── 用户信息-从登录态获取.md
└── src/
```

多 Context 仓库（根目录存在 `CONTEXT-MAP.md`）：

```
/
├── CONTEXT-MAP.md
├── docs/rules/                        ← 系统级决策
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/rules/                ← Context 级决策
    └── billing/
        ├── CONTEXT.md
        └── docs/rules/
```

## 使用术语表中的词汇

当输出涉及领域概念（task 标题、重构提案、假设、测试名称）时，使用 `CONTEXT.md` 中定义的术语。不要漂移到术语表明确避免的同义词。

## 标记 RULES 冲突

如果你的输出与现有 RULES 矛盾，明确指出而不是静默覆盖：

> _与 RULES《数据权限-按部门隔离》矛盾——但值得重新讨论，因为……_
