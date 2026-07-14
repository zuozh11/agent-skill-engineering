# Agent Skills — Engineering

面向开发工程师的 Agent Skill 集合，从 [mattpocock/skills](https://github.com/mattpocock/skills) 改造而来，专注于**需求收敛 → 拆解 → 实现**的完整工程管线。

与原版的区别：去掉了 GitHub Issues / Linear 集成和 TDD 流程，改为本地 Markdown 任务追踪 + vertical slice 实现模式，更适合实际企业项目。

## 快速开始

1. 安装/更新 skill：

```bash
npx skills@latest add https://devcloud.szlanyou.com/gitlab/ly-zuozhi/agent-skill-engineering.git
```

2. 在目标仓库中运行 `/setup-agent-skills`。

3. 配置完成后即可使用全部 skill。

---

## 工作流管线

```
完整工作流:  to-prd → to-task → impl 
            (PRD)   (拆任务)   (实现)
      
辅助:  grill-with-docs
     （追问对齐，自动触发）
```

其他辅助 skill（按需调用）：`retro`、`diagnose`、`zoom-out`、`prototype`、`improve-codebase-architecture`、`commit`。

## 为什么要这套流程

### 问题 1：很难一次性把所有逻辑讲清楚

> _不知道怎么和 agent 讲需求，很难一次性把所有逻辑讲清楚。目标、限制、边界和取舍没说完，agent 就会用自己的假设补空白。_

**解法**：`/grill-with-docs` 通过逼问强迫你补齐上下文，把模糊想法、边界条件和关键取舍都定义清楚。

---

### 问题 2：口头需求没法复盘

> _口头描述散在对话里，缺少整体视图，人工很难回看、评审和发现遗漏。_

**解法**：`/to-prd` 生成 `PRD.md`，把需求固化成可回看、可评审的文档。

---

### 问题 3：需求太大，不能一次实现

> _把一整个模块完整的需求直接交给 agent，它都会试图一次性搞定所有事情，任务边界、提交边界和验证路径都会变模糊。_

**解法**：`/to-task` 把需求拆成 vertical slice 任务卡。每张卡前置完成必要调研、主要入口定位和方案选择，明确边界、依赖与验收，使执行者拿到即可直接动手，同时不在任务卡里提前编写实现代码。

---

### 问题 4：多任务实现容易互相污染

> _一次实现多个任务时，依赖顺序、写集冲突、上下文长度和提交边界都会叠在一起，最后很难追踪每个 task 到底改了什么。_

**解法**：`/impl` 直接从任务卡或当前对话开始实现，根据任务数量、依赖和写集冲突自主选择直接实现或编排子 Agent；验证通过后按完成单元原子提交。

---

### 问题 5：Agent 听不懂项目术语

> _你说一个业务词，agent 不知道它对应哪个实体、模块，就只能每次重新查代码库，或者用猜的。_

**解法**：`CONTEXT.md` 沉淀项目术语、实体关系和规范命名，让 agent 先有领域词典；同时让 PRD、任务卡和代码使用同一套语言，减少术语漂移。

---

### 问题 6：做过的决策被反复询问

> _数据权限怎么做、用户信息怎么取，这类长期决策不能只留在对话里，否则后续实现很容易绕开它。_

**解法**：`RULES` 记录通用的、难逆转的决策：为什么这样做、放弃什么、何时重审。所有主线 skill 都会按需查阅相关 `RULES`，避免重复争论已经定下来的约束。

---

## 核心概念

### 领域文档

工作流会读取两类项目知识：

- **`CONTEXT.md`** — 项目术语表。定义业务概念、实体关系、规范命名。所有 skill 输出都使用这里的词汇。
- **`RULES`** — 项目规则。把项目长期有效的关键决策与约定（架构、选型、错误码、单位、命名等）显式写下来供 agent 遵守，防止实现跑偏。

> `CONTEXT.md` 和 `RULES` 在对话中按需创建和更新。

### 项目文档布局

领域知识和任务都以 Markdown 文件形式存放在仓库内，不依赖外部服务：

```
docs/
├── CONTEXT.md                ← 项目术语和命名约定
├── agents/                   ← 消费规则 domain.md + 格式模板 context-format.md / rules-format.md
├── rules/                    ← 项目规则（RULES）
│   ├── 01-数据权限-按部门隔离.md
│   └── 02-接口错误码-统一包装.md
└── scratch/
    └── <feature-slug>/
        ├── PRD.md            ← /to-prd 产出
        └── tasks/
            ├── 01-create-schema.md   ← /to-task 产出
            ├── 02-add-api.md
            └── 03-add-ui.md          ← /impl 逐个实现
```

> 上面是单 Context 布局（大多数仓库）。monorepo（多 Context）改用 `docs/CONTEXT-MAP.md` 指向各 Context 的 `docs/CONTEXT.md`（目录位置由地图声明，不限于 `src/`）；RULES 不随 Context 拆分，始终统一放在仓库根 `docs/rules/`。两种布局的读取与落盘解析统一见 `docs/agents/domain.md`。

---

## Skill 参考

### 主管线

| Skill | 用途 |
|-------|------|
| **[to-prd](./skills/to-prd/SKILL.md)** | **将对话上下文合成为 `PRD` 文档，并自动判断以前端或后端视角组织需求** |
| **[to-task](./skills/to-task/SKILL.md)** | **将需求拆成拿到即可直接动手的 vertical slice 方案任务卡，不提前编写实现代码** |
| **[impl](./skills/impl/SKILL.md)** | **根据任务卡或当前对话实现代码变更，按独立实现单元原子提交** |

### 关键辅助

[grill-with-docs](./skills/grill-with-docs/SKILL.md) 是主管线之外最重要的辅助 skill：通过逼问式对话压力测试方案，挑战术语一致性，并把确定的概念沉淀到 `CONTEXT.md`、把权衡决策记录为 `RULES`。

> `to-task`、`impl` 在上下文不足时会自动触发它的追问流程；`to-prd` 首次合成 PRD 前默认必跑一轮（本轮已执行过则跳过）。

### 其他辅助 Skill

| Skill | 用途 |
|-------|------|
| **[retro](./skills/retro/SKILL.md)** | 复盘会话，必要时更新 `PRD` 或 `RULES` |
| **[diagnose](./skills/diagnose/SKILL.md)** | 结构化调试循环：复现 → 最小化 → 假设 → 插桩 → 修复 → 回归测试 |
| **[load-rules](./skills/load-rules/SKILL.md)** | 强制枚举并读取仓库内所有 RULES，并在当前会话中自动遵守相关规则 |
| **[zoom-out](./skills/zoom-out/SKILL.md)** | 让 agent 跳出当前代码，给出更高层次的全局视角 |
| **[prototype](./skills/prototype/SKILL.md)** | 构建一次性原型验证设计——终端交互验逻辑，或多 UI 变体验视觉 |
| **[improve-codebase-architecture](./skills/improve-codebase-architecture/SKILL.md)** | 找出职责分散、重复、难测试的代码，并给出重构建议 |
| **[commit](./skills/commit/SKILL.md)** | 加载并按需补充 `CONTEXT.md` 术语，生成约定式提交 |

### 配置

| Skill | 用途 |
|-------|------|
| **[setup-agent-skills](./skills/setup-agent-skills/SKILL.md)** | 初始化领域文档基础设施，并写入最小 Agent 配置入口 |

---

## 与原版的差异

| 原版 (mattpocock/skills) | 本仓库                                              |
|--------------------------|--------------------------------------------------|
| 依赖 Issue Tracker 和 triage labels | 不接外部任务系统，只配置 `CONTEXT.md` + `RULES`                |
| `/to-prd` 发布 PRD 到 Issue Tracker | `/to-prd` 写入本地PRD文件，并按前端/后端视角组织需求                |
| `/to-issues` 发布 vertical slice issues | `/to-task` 生成详细方案任务卡，收口主要入口、实现方案、依赖和验收，但不提前编写代码 |
| `/tdd` 红绿重构循环 | `/impl` 按任务或口头描述执行实现，加载项目约束，必要时编排子 Agent，验证后原子提交 |
| `/triage` 管理 Issue 分诊状态机 | 移除（本地 Markdown 工作流无需 Issue 分诊）                   |
| 英文 skill 描述和交互 | 中文 skill 描述和交互                                   |

## 通用工作流工具

除工程 skill 外，推荐搭配安装 [mattpocock/skills](https://github.com/mattpocock/skills) 中的通用生产力工具：

| Skill | 用途 |
|-------|------|
| **caveman** | 超压缩沟通模式，去除填充词同时保持技术准确性，可减少约 75% 的 token 使用量 |
| **grill-me** | 针对计划或设计进行严苛的面试，直到决策树的每一个分支都得到解决 |
| **handoff** | 将当前对话压缩为一份交接文档，以便其他 agent 可以继续后续工作 |
| **write-a-skill** | 创建具有适当结构、渐进式披露和捆绑资源的新 skill |

安装命令：

```bash
npx skills@latest add mattpocock/skills -s caveman,grill-me,handoff,write-a-skill
```

## 致谢

基于 [Matt Pocock](https://github.com/mattpocock) 的 [skills](https://github.com/mattpocock/skills) 仓库改造。核心理念——共享语言、vertical slice、深模块——来自 Eric Evans 的 DDD、John Ousterhout 的 A Philosophy of Software Design、以及 The Pragmatic Programmer。
