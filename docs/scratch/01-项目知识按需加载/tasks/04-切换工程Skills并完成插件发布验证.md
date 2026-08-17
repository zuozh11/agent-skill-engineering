---
Status: ready-for-agent
Blocked by:
  - task: 03-升级setup-agent-skills安装与迁移流程.md
    reason: 全仓旧指针只能在 V2 安装与运行入口可用后统一切换
---

## Parent

[项目知识按需加载 PRD](../PRD.md)

## What to build

把仓库内所有工程 Skill 从“自行定位领域文档并全量读取 RULE”统一切换为“使用当前任务已由 Hook + 单次 `load` 提供的项目知识”，同步 Codex 插件镜像和用户文档，形成可发布且不存在双协议的完整版本。

## 现状

- `to-prd`、`to-task`、`impl`、`code-review`、`codebase-design`、`diagnosing-bugs`、`grill-with-docs`、`zoom-out` 仍包含旧的领域文档定位或全部 RULE 必读要求。
- 根 `skills/` 是唯一权威实现；`plugins/agent-skill-engineering/skills` 只能通过同步脚本生成。
- README 仍描述旧版 `setup-agent-skills` 能力，旧 `read-rules.py` 种子仍在发布内容中。

## 方案设计

### 工程 Skill 入口 — 只消费已加载知识

逐一修改受影响 Skill 的任务起点：使用当前任务已经加载的 Context 术语和 RULE，不再自行搜索 `docs/agents/domain.md`、运行 `read-rules.py` 或触发第二套加载流程。

- 保留各 Skill 原有职责、步骤和触发边界，只替换知识入口；
- 子 Agent 的知识由 `SubagentStart` Hook 自己注入，不要求主 Agent 复制全部正文；
- 项目未采用知识结构或 Hook 提醒知识不可用时，按已明确的提醒继续策略执行并如实披露，不增加新的阻断检查。

### 发布内容与验证 — 保持唯一真源

1. 从 `setup-agent-skills` 发布内容中移除旧 `read-rules.py`，确认 V2 MJS、文档和 Hook 模板齐全。
2. 更新 README 中的能力、项目产出物和使用说明，使其只描述 scope → 选择 → 单次 load 的主流程。
3. 运行 `scripts/sync-codex-plugin-skills.sh` 同步插件镜像；不得手工编辑镜像。
4. 使用仓库已有静态检查，并补充 V2 相关测试：脚本公开命令、两宿主 Hook fixture、重复安装走读和旧术语残留搜索。
5. 不在本任务修改任何真实用户 Agent 配置，不提交或推送下游仓库；发布、下游更新另行授权。

## 验收

- 搜索可执行指令 → 除历史 PRD/REVIEW/任务卡外，不再存在 `read-rules.py`、全量枚举 RULE、`RULE-NN` 或工程 Skill 自行定位领域文档的旧入口。
- 从用户请求走读到任一工程 Skill → Hook 提供 scope，Agent 一次 `load` 后使用已加载知识，Skill 不触发第二次读取流程。
- `skills/` 与 `plugins/agent-skill-engineering/skills` 内容一致，插件清单、README 和真实发布文件没有遗漏或死链。
- Node 测试、JSON 校验、`git diff --check`、Skill frontmatter/目录检查和源镜像 `diff -qr` 全部通过。
- 最终 diff 只包含本需求文件；用户原有暂存或未提交内容保持不变，未创建真实项目 Hook 配置，未自动提交或推送。
