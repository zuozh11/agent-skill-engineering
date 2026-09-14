# Codex 项目 Hook

安装或升级 Codex 项目 Hook 时读取；结构以 [codex-hooks.json](./hook-templates/codex-hooks.json) 为准。

- 项目已有 `.codex/hooks.json` 时，解析 JSON，只合并或更新自己的三个 Hook。
- 项目只使用 `.codex/config.toml` 内联 Hook 时，在文件末尾维护 `# project-knowledge:start` / `# project-knowledge:end` 标记段，把模板中的三个 Hook 等价写入段内；已有完整标记段时原位更新段内内容，不解析或重写标记段外 TOML。
- 两种 Codex Hook 表示同时存在时，只更新已经包含自有 Hook 的那一种；尚未安装时优先写入 `.codex/hooks.json`，并提醒用户 Codex 会合并同层两个来源。
- Hook 命令从当前项目 Git 根定位 `docs/agents/project-knowledge.mjs`，不把安装时绝对路径作为身份。
- 其他 Hook 和配置保持不变；发现相似但无法确认归属的条目时提醒用户，不自动删除。
