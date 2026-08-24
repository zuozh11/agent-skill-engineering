# Codex CLI 项目级插件支持调研

> **结论：截至 Codex CLI `0.147.0`，Codex 原生插件不能只安装到、也不能按仓库原生地只启用于 `/Users/zuozhi/workspace/Lanyou/YYC_SRM/yyc-srm-backend/`。** Repo marketplace 只把插件目录暴露为项目内的可发现 catalog；实际插件副本与启用状态仍写入当前 `CODEX_HOME`（默认 `~/.codex`）的用户级存储。若真实目标只是让本仓库的 workflows 仅在该后端仓库可用，官方原生机制是把它们作为 **repo-scoped standalone skills** 放到目标仓库的 `.agents/skills/`，而不是安装插件。

## 调研基线

- 本机当前 Codex CLI 为 `codex-cli 0.147.0`；官方源码 tag `rust-v0.147.0` 的 workspace version 同为 `0.147.0`。[官方源码：`codex-rs/Cargo.toml` 第 135–139 行](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/Cargo.toml#L135-L139)
- 本文查阅日期为 2026-08-18。动态官方文档可能随 Codex 发布继续变化，因此源码判断均固定到 `rust-v0.147.0`。
- 本文没有运行安装命令，没有读取或修改目标项目。

## 结论矩阵

| 问题 | 结论 | 依据 |
|---|---|---|
| `.codex-plugin/plugin.json` 是否是插件清单？ | **是。** 当前官方插件打包文档仍将它定义为每个插件的必需入口；`skills`、`mcpServers`、`hooks` 等路径从插件根解析。 | [官方文档：Package your plugin](https://developers.openai.com/plugins/build/plugins#plugin-structure)；[官方源码：legacy manifest fields](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/core-plugins/src/manifest.rs#L44-L75) |
| 仅把插件目录放入项目，Codex 是否自动安装/启用？ | **否。** 项目 marketplace 只是 catalog；仍需安装，安装后从用户 cache 加载。 | [官方文档：Install a local plugin manually](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually)、[How local marketplaces work](https://developers.openai.com/plugins/build/plugins#how-local-marketplaces-work) |
| `codex plugin add` 能否指定 project/repo scope？ | **否。** `0.147.0` 的 `add` 参数只有插件 selector、`--marketplace` 与 `--json`，没有 `--scope`、`--project` 或安装目录参数。 | [官方源码：`AddPluginArgs`](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/cli/src/plugin_cmd.rs#L56-L82) |
| Repo marketplace 是否意味着项目级安装？ | **否。** 它只影响从该 repo 发现哪些 marketplace 条目；安装副本在 `~/.codex/plugins/cache/...`，开关在 `~/.codex/config.toml`。 | [官方文档：repo marketplace](https://developers.openai.com/plugins/build/plugins#build-your-own-curated-plugin-list)、[官方文档：cache 与开关](https://developers.openai.com/plugins/build/plugins#how-local-marketplaces-work) |
| 项目 `.codex/config.toml` 能否把已安装插件只在本项目启用？ | **否（`0.147.0` 源码明确如此）。** 项目配置本身存在且仅在 trusted project 加载，但插件 loader 专门只读取合并后的 **User** layers，不读取 Project layer。 | [官方配置文档：项目配置与信任](https://developers.openai.com/codex/config-basic#configuration-precedence)；[官方源码：插件配置投影](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/core-plugins/src/marketplace_policy.rs#L205-L245)；[官方源码：`effective_user_config` 仅合并 User layer](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/config/src/state.rs#L299-L340) |
| skills 能否只在一个项目发现？ | **是。** Codex 从 CWD 向上直到 project/repo root 扫描每层 `.agents/skills`；仓库根的 `.agents/skills` 对该仓库及其子目录生效。 | [官方 Skills 文档：Where Codex loads local skills](https://developers.openai.com/codex/skills#where-codex-loads-local-skills)；[官方源码：repo skill roots](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/ext/skills/src/host_roots.rs#L135-L180) |

## 四种机制不能混为一谈

### 1. Codex 原生插件安装

插件是一个可安装 bundle，可以组合 skills、MCP servers/connectors、hooks 和展示元数据。当前官方打包入口为：

```text
<plugin-root>/
├── .codex-plugin/plugin.json
├── skills/
├── hooks/             # 可选
├── .mcp.json          # 可选
└── .app.json          # 可选
```

官方文档说明 `.codex-plugin/plugin.json` 是 required entry point，并要求清单内路径相对 plugin root、以 `./` 开头。[官方文档：Manifest fields 与 Path rules](https://developers.openai.com/plugins/build/plugins#manifest-fields)

本仓库的实际清单位于 [`plugins/agent-skill-engineering/.codex-plugin/plugin.json`](../../plugins/agent-skill-engineering/.codex-plugin/plugin.json)，版本为 `1.2.7`，并以 `"skills": "./skills/"` 声明 bundled skills。该文件是**包描述**，不是“放在任意项目里就自动启用”的项目配置。

`codex plugin add` 的实现先把 marketplace source materialize 到 plugin store，随后调用 `set_user_plugin_enabled(..., true)`；后者明确编辑 `CODEX_HOME/config.toml`。[官方源码：安装与写入用户开关](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/core-plugins/src/manager.rs#L1593-L1646)、[官方源码：`set_user_plugin_enabled`](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/config/src/plugin_edit.rs#L21-L43)

因此原生插件安装的 scope 是 **Codex home/user environment**，不是当前 CWD 或 Git repository。

### 2. Repo marketplace（项目目录中的插件 catalog）

官方支持在 `$REPO_ROOT/.agents/plugins/marketplace.json` 建立 repo-scoped marketplace，并让 `source.path` 指向仓库内插件目录。[官方文档：Build your own curated plugin list](https://developers.openai.com/plugins/build/plugins#build-your-own-curated-plugin-list)

本仓库已经有 [`/.agents/plugins/marketplace.json`](../../.agents/plugins/marketplace.json)，其本地条目指向 `./plugins/agent-skill-engineering`，安装策略为 `AVAILABLE`。这表示：

1. 当该仓库是当前项目时，Codex 可以发现这个 marketplace 条目；
2. 用户仍需安装该条目；
3. 安装后的副本进入 `~/.codex/plugins/cache/$MARKETPLACE_NAME/$PLUGIN_NAME/$VERSION/`；
4. on/off 状态写入 `~/.codex/config.toml`。

第 3、4 点由官方文档直接说明。[官方文档：How local marketplaces work](https://developers.openai.com/plugins/build/plugins#how-local-marketplaces-work)

所以 **repo-scoped marketplace ≠ repo-scoped installation/enablement**。它解决的是“在哪个 repo 能看到这份 catalog”，不是“插件能力只在哪个 repo 生效”。

### 3. 项目级 `.codex/config.toml`

Codex 确实支持项目配置：trusted project 中，从 repository root 到 CWD 的 `.codex/config.toml` 会按层叠优先级覆盖用户默认值。[官方配置文档：Config basics](https://developers.openai.com/codex/config-basic#configuration-precedence)

但不能据此推断所有 schema 字段都能项目化。对插件，`0.147.0` 的 loader 有专门逻辑：

1. `configured_plugins_from_stack` 调用 `project_effective_user_config`；
2. 后者最终从 `ConfigLayerStack::effective_user_config()` 取值；
3. `effective_user_config()` 的源码注释和实现都明确只迭代 `ConfigLayerSource::User`。

来源：[官方源码：`configured_plugins_from_stack`](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/core-plugins/src/marketplace_policy.rs#L284-L303)、[官方源码：User-only merge](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/config/src/state.rs#L323-L340)。官方集成测试还创建了 project `.codex/config.toml` 把插件设为 `false`，但断言列表状态仍采用 home config 的 `true`；测试名即 `plugin_list_uses_home_config_for_enabled_state`。[官方源码测试](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/app-server/tests/suite/v2/plugin_list.rs#L1325-L1407)

因此下面这种看似合理的配置**不能作为项目级插件开关方案**：

```toml
# /Users/zuozhi/workspace/Lanyou/YYC_SRM/yyc-srm-backend/.codex/config.toml
[plugins."agent-skill-engineering@agent-skill-engineering"]
enabled = true
```

> 这是当前官方文档没有直说、但 `0.147.0` 官方源码与测试可以确认的限制。

### 4. 项目级 skills 发现

Standalone skill 是独立于插件安装的官方机制。Codex 会扫描：

- `$CWD/.agents/skills`
- 从 CWD 向上的各层 `.agents/skills`
- `$REPO_ROOT/.agents/skills`
- 用户级 `$HOME/.agents/skills`
- admin/system locations

官方文档同时明确 local skill locations 用于 authoring/local discovery，而 plugin 用于跨 repo 分发。[官方 Skills 文档](https://developers.openai.com/codex/skills#where-codex-loads-local-skills)

源码中 `repo_agents_skill_roots` 先确定 project root，然后枚举 root 与 CWD 之间的目录，为存在的 `.agents/skills` 建立 `SkillScope::Repo` root。[官方源码](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/ext/skills/src/host_roots.rs#L135-L180)

这是真正满足“只在目标项目发现 workflows”的原生机制，但它只携带 skills，不等同于完整 plugin bundle。

## 针对目标路径的最小可执行方案

### 推荐：把 bundled skills 复制为目标仓库的 repo skills

以下只是建议命令，**本次调研未执行**：

```bash
SOURCE=/Users/zuozhi/workspace/zuozhi/agent-skill-engineering/plugins/agent-skill-engineering/skills
TARGET=/Users/zuozhi/workspace/Lanyou/YYC_SRM/yyc-srm-backend

mkdir -p "$TARGET/.agents/skills"
cp -R "$SOURCE/". "$TARGET/.agents/skills/"
```

之后从 `yyc-srm-backend` 根目录或其子目录启动新的 Codex CLI session。根据官方搜索规则，这些 skills 属于 `REPO` scope，不会因为用户切换到无关仓库而被扫描。[官方 Skills 文档](https://developers.openai.com/codex/skills#where-codex-loads-local-skills)

#### 限制

- 这不是插件安装；不会获得插件 identity、marketplace 更新流、plugin namespace、插件级 MCP servers、connectors 或 hooks。
- 本仓库当前清单只显式打包 `skills`，所以对当前需求，复制 bundled skills 保留了清单声明的主要能力；若未来清单新增 hooks/MCP/apps，不能假定上述方案自动覆盖它们。[本仓库清单](../../plugins/agent-skill-engineering/.codex-plugin/plugin.json)
- 复制会形成项目内快照，后续更新需再次同步。若改用 symlink，官方文档说明 Codex 支持 symlinked skill folders，但目标项目会依赖本机这个绝对源码路径。[官方 Skills 文档](https://developers.openai.com/codex/skills#where-codex-loads-local-skills)
- 如果目标项目不应提交这些文件，应由目标项目自行决定 `.gitignore` 或部署策略；本次不替它做决定。

### 有条件替代：为该项目使用独立 `CODEX_HOME`

如果必须保留完整 plugin bundle，可为特定启动方式使用独立 `CODEX_HOME`，再在那个 home 中执行 marketplace add/install。源码明确 `CODEX_HOME` 覆盖默认 `~/.codex`，且其值必须预先存在并是目录。[官方源码：`find_codex_home`](https://github.com/openai/codex/blob/rust-v0.147.0/codex-rs/core/src/config/mod.rs#L4644-L4653)

概念性命令如下，**本次未执行**：

```bash
PROJECT_CODEX_HOME="$HOME/.codex-projects/yyc-srm-backend"
mkdir -p "$PROJECT_CODEX_HOME"

CODEX_HOME="$PROJECT_CODEX_HOME" codex plugin marketplace add zuozh11/agent-skill-engineering
CODEX_HOME="$PROJECT_CODEX_HOME" codex plugin add agent-skill-engineering@agent-skill-engineering

cd /Users/zuozhi/workspace/Lanyou/YYC_SRM/yyc-srm-backend
CODEX_HOME="$PROJECT_CODEX_HOME" codex
```

这只能称为**隔离 home 的替代方案**，不能称为 Codex 原生 project scope：

- Codex 按 `CODEX_HOME` 隔离 state/cache/config，不会校验 CWD 是否等于该项目；在别的目录复用同一 `CODEX_HOME` 时插件仍会启用。
- 登录、会话、配置、cache 等 Codex 状态也随 home 隔离，运维成本高于 repo skills。
- 要保证“只用于该项目”，必须依赖 wrapper/direnv 等外部启动约束；Codex 自身没有 project binding。本文没有查到官方提供“将某个 `CODEX_HOME` 绑定某个 repository”的机制，故此点明确标记为 **不知道有任何原生绑定能力**。

## 最终判断

1. **Codex 原生插件仅安装到指定项目：No。** `codex plugin add` 没有项目 scope，安装副本和状态属于 `CODEX_HOME`。
2. **Codex 原生插件仅在指定项目启用：No。** Repo marketplace 只影响发现；项目 `.codex/config.toml` 的 plugin entry 在 `0.147.0` 插件状态投影中不参与合并。
3. **仅让该插件中的 skills 在指定项目可用：Yes。** 将 bundled skills 放入目标仓库 `.agents/skills/`，使用官方 repo skill discovery。
4. **保留完整插件但做环境隔离：有条件。** 独立 `CODEX_HOME` 可隔离安装和开关，但不是项目 scope，必须靠外部启动纪律保证不在其他 CWD 使用。

## 未知与版本风险

- 官方动态文档没有承诺未来是否会加入 `codex plugin add --scope project` 或 project-scoped plugin state；截至本文基线，只能确认 `0.147.0` 没有。
- 官方文档把 `.codex-plugin/plugin.json` 作为当前打包入口；`0.147.0` 源码还包含新的 Agent Plugins manifest 兼容路径。本文不推断 `.codex-plugin/plugin.json` 的未来废弃时间，因为官方一手来源没有给出该时间表。
- 没有对目标项目执行任何命令，因此没有验证其 Git root、trust 状态或已有 `.agents/skills` 冲突；最小方案以给定绝对路径本身为预期 repository root。
