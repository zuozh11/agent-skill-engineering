# 任务追踪：本地 Markdown

本仓库的 PRD 和实施任务以 markdown 文件形式存放在 `docs/scratch/` 目录下。

## 约定

- 每个功能一个目录：`docs/scratch/<feature-slug>/`
- PRD 文件：`docs/scratch/<feature-slug>/PRD.md`
- 实施任务：`docs/scratch/<feature-slug>/tasks/<NN>-<slug>.md`，从 `01` 开始编号
- 状态记录在每个 task 文件顶部的 `Status:` 行（状态值参见 `triage-labels.md`）
- 评论和对话历史追加在文件底部 `## 评论` 标题下

## 当 skill 说"发布到 task tracker"时

在 `docs/scratch/<feature-slug>/` 下创建新文件（如目录不存在则先创建）。

## 当 skill 说"获取相关 task"时

读取引用路径对应的文件。用户通常会直接传入路径或 task 编号。
