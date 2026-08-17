---
Status: ready-for-agent
Blocked by:
  - task: 01-实现项目知识范围与加载命令.md
    reason: Hook 需要复用已经稳定的 scope、load 和错误结果
---

## Parent

[项目知识按需加载 PRD](../PRD.md)

## What to build

让 Codex 与 Claude Code 在用户请求、上下文压缩和子 Agent 启动时，自动得到同一份自然语言选择提示与当前项目 scope；Agent 自己判断相关范围，并只调用一次 `load`。

本任务实现 Hook 运行时和配置模板，但不修改本仓库真实 `.codex/`、`.claude/` 配置。

## 现状

- 任务 01 已提供 `scope` 与 `load`，但 Agent 仍需知道何时调用、怎样选择和怎样处理大输出。
- Codex 与 Claude Code 的事件和响应结构不同，但范围生成、选择文案和失败语义相同。
- Hook 只是提示入口：配置或知识损坏时应提醒并继续任务，不需要建立强制状态机。

## 方案设计

### `project-knowledge.mjs hook` — 共享范围与动态提示

在同一脚本中增加 `hook` 子命令：读取宿主传入的当前目录、事件名和必要事件字段，复用 `scope` 结果，动态渲染单/多 Context 提示。

1. `UserPromptSubmit` 提醒 Agent 先判断是否是同一任务且已有范围足够；新任务或范围变化时重新完整选择并调用一次 `load`。
2. `SessionStart(compact)` 要求根据压缩后保留的任务重新选择；`SubagentStart` 要求子 Agent 按自身子任务选择。
3. 提示只包含选择原则、可执行 `load` 命令、宿主的大输出说明和紧凑 scope JSON，不替 Agent 选择，也不读取正文或保存加载状态。
4. 未采用知识结构时无输出；可识别的知识错误转换为可见提醒并继续，进程级异常交给宿主报告。

### 宿主适配与模板 — 只隔离真实差异

在 `skills/setup-agent-skills/hook-templates/` 增加 Codex 与 Claude Code 的项目级模板：

- Codex 为三个事件绑定同一 `hook` 子命令，命令从项目根定位 `docs/agents/project-knowledge.mjs`，同时提供 POSIX 与 Windows 命令，并提示调用 `load` 时给足命令输出预算；
- Claude Code 使用 `node` + `args` 和 `${CLAUDE_PROJECT_DIR}`，为三个事件返回匹配事件名的 `hookSpecificOutput.additionalContext`；大结果被宿主外置时，提示 Agent 完整读取宿主返回的文件且不要再次 `load`；
- 两种适配都调用同一个核心入口，不复制范围解析或选择逻辑。

路径测试覆盖空格及常见 shell 特殊字符；实现只保证命令参数不会被拆错，不建设额外的跨平台命令框架。

## 验收

- 向三个事件分别输入单/多 Context fixture → Codex 与 Claude Code 都返回合法响应，事件提示、scope 和 `load` 示例正确。
- 同一任务补充提示、主题切换、compact、子 Agent 四种场景走读 → 自然语言明确表达“不重复”或“重新完整加载”，脚本本身不维护会话状态。
- 损坏 scope → Hook 返回可见提醒且任务继续，不包含部分 scope；未采用知识结构 → 退出成功且无注入。
- 在 macOS、Linux、Windows 命令 fixture 中使用带空格和特殊字符的项目路径 → `node`、脚本路径和 `hook` 仍保持正确参数边界。
- 使用最大真实 scope → Codex 注入不被其配置预算截断，Claude Code 注入低于宿主限制；最大 `load` 在 Codex 完整返回，在 Claude Code 可从宿主外置文件完整取得且只执行一次。
