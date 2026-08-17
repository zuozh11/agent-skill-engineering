# 项目知识按需加载 PRD 评审

> **结论：可以直接实施，没有阻塞项。** 这套机制是给 Agent 提供项目知识提示，不是安全边界或严格协议。PRD 已经足够详细，后续应优先把主流程做出来，再根据真实使用问题调整。

本文只修正评审结论，不改写相邻 `PRD.md`，不实施 CLI、Hook、Skill 或 validator。

## 移交基线

| 项目 | 结果 |
|---|---|
| 源文件 | `/Users/zuozhi/workspace/Lanyou/YYC_SRM/yyc-srm-backend/docs/scratch/27-RULE按需加载/PRD.md` |
| 移交文件 | `docs/scratch/01-项目知识按需加载/PRD.md` |
| 源/目标 SHA-256 | `948ed520f7f913c03336970df047dee0f1795030f024a36cb55839db4cbae415` |
| 字节一致性 | `cmp -s` 退出码 `0` |

## 产品判断

方案的目标很简单：

1. Hook 告诉 Agent 当前项目有哪些 Context 和 RULE 场景。
2. Agent 用自然语言理解当前任务，选择可能相关的范围。
3. Agent 只调用一次 `load`，取得完整正文后继续工作。

这里依赖 Agent 的理解能力是合理的。没有必要把每个判断都变成协议字段、错误码、状态机或 validator。

## 已确认的口径

### 1. 全量 RULE 读取就是本次要替换的旧机制

当前 `domain.md` 的“全部 RULE 必读”是迁移对象，不是新方案必须保留的前提。

新方案按场景加载：Agent 选择所有可能相关的场景，`load` 返回的规则必须遵守，未选择的规则不加载。“必读”只是当前场景名称，不需要 CLI 特殊处理。

### 2. Codex TOML 直接追加自有配置

不需要 TOML 库，也不需要做通用 TOML 解析器：

- 没有项目知识 Hook 时，在文件末尾追加；
- 重复运行时找到自己之前写入的那段并更新；
- 其他配置不动；
- 真遇到无法判断的异常内容时，提醒用户手工看一下即可。

实现可以使用简单注释标记自己的配置段，但不需要把标记块设计成复杂协议。

### 3. Hook 使用项目根相对路径

- Codex 从项目根定位 `docs/agents/project-knowledge.mjs`；
- Claude Code 使用 `${CLAUDE_PROJECT_DIR}`；
- 脚本再以自身位置定位领域文档根；
- 仓库移动后不需要更新 Hook 身份。

### 4. 信任状态不进入产品流程

安装完成后提醒用户检查或信任 Hook。宿主能自动验证就验证，不能验证就算了，不额外维护信任状态。

### 5. 只处理当前项目配置

只保证当前项目里不会重复写入自己的 Hook。用户级、插件级或托管级配置不扫描、不修改，也不为理论上的跨层重复增加协议。

## 官方事实核对

- Codex 支持项目级 `hooks.json` 和 `config.toml` 内联 Hook，也支持 `commandWindows`。
- Claude Code 支持 `UserPromptSubmit`、`SessionStart(compact)`、`SubagentStart`，并支持 `command: node` 加 `args` 的跨平台执行方式。
- 两个宿主都可能把大输出外置为文件；PRD 已经给出了 Codex 输出预算和 Claude Code 会话文件的处理方式。
- Hook 不是安全边界，PRD 当前的“失败提醒并继续”符合这个定位。

官方来源：

- [OpenAI Codex Hooks](https://learn.chatgpt.com/docs/hooks)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Tools Reference / Output Limits](https://code.claude.com/docs/en/tools-reference#output-limits)

## 实现时顺手注意

这些不是阻塞项，也不需要先继续讨论：

- `scope` 和 `hook` 复用同一套范围生成逻辑，避免写两份解析代码。
- `load` 失败时不要输出半截正文；成功时保证最后一个文件正文完整即可。
- setup 重复运行不要重复追加自己的 Hook，也不要覆盖用户其他配置。
- Node 不存在时直接给出可读错误，不需要建设复杂版本兼容矩阵。
- macOS、Linux、Windows 各跑一次真实 Hook 命令，路径带空格时能工作即可。
- validator 只检查实现真正依赖的格式，不要把 Markdown、YAML 或文件名限制得比实际需要更死。

## 最小验收

1. 单 Context 项目能得到 `docs/CONTEXT.md` 和所选 RULE。
2. 多 Context 项目能得到 Map、所选 Context 和所选 RULE。
3. RULE 场景、`references`、循环引用和去重能正常工作。
4. Codex 与 Claude Code 的三个 Hook 事件能注入选择提示。
5. 最大真实知识集合能被 Agent 完整取得。
6. setup 连续运行两次不会重复配置，用户原有配置保持不变。
7. 配置或知识损坏时给出清楚提醒，当前任务继续。

## 最终结论

PRD 已经可以直接进入实现。后续不要为了形式完整增加协议版本、全局 Hook 冲突检测、信任状态机、严格错误码、资源上限或大量防御性校验；只有真实测试暴露问题时再补。
