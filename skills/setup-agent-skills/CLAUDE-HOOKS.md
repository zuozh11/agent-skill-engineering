# Claude Code 项目 Hook

安装或升级 Claude Code 项目 Hook 时读取；结构以 [claude-settings.json](./hook-templates/claude-settings.json) 为准。

- `.claude/settings.json` 不存在时创建，存在时只合并模板中自己的三个 matcher group 和 handler。
- handler 走模板的 `command` + `args`，不经过 shell。
- 重复运行时原位更新同事件、同 matcher、同项目脚本参数的自有 Hook。
- 其他设置、matcher group 和 Hook 保持原语义与顺序；JSON 损坏时停止该文件写入并提醒用户。
