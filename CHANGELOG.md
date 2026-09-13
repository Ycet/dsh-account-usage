# 变更记录 / Changelog

本文件记录 dsh-account-usage 的版本变更。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

- 本文件于 2026-09-11 依据本仓库 git 提交历史回填；版本号与日期取自本目录 `package.json` 的 `version` 与实际提交时间。
- 上游仓库：[Ycet/dsh-account-usage](https://github.com/Ycet/dsh-account-usage)。
- 本仓库中首次提交的版本号为 `0.1.11`，`0.1.12` 未出现在本目录的 `package.json` 中（上游插件仓库另有 `v0.1.12` 标签）。
- 条目末尾的短哈希（如 `c1182a4`）为对应提交，便于追溯。

## [0.1.23] - 2026-09-13

### 修复 / Fixed

- 消费金额柱状图的悬浮提示只列出当日**消费金额大于 0** 的模型，并按费用降序排列，避免零消费模型占用提示行（`e889c12`）。
- English: The daily cost chart tooltip now lists only models whose cost for that day is greater than zero, sorted by descending cost.

## [0.1.22] - 2026-09-07

### 变更 / Changed

- **兼容 DSH `0.1.2-rc.1` 的凭据服务**（`c1182a4`）：浏览器半区由 `connection.api.credentials` 迁到 **`remote.credentials`**（`inject` 由 `["slots", "locale", "connection"]` 改为 `["slots", "locale", "remote", "remote.credentials"]`）。
- 新增 `createCredentialApi(remote)` 适配层，恢复账户页原先消费的传输层契约：把 `remote.credentials` 直接返回的 `RemoteResult` 重新包成 `{ result }` 信封，并把 `describe` 的 `value`（按凭据引用索引的记录）再包一层 `{ credentials }`；令牌编辑与账户页因此不必各自处理新旧传输层差异。`remote.credentials` 缺少 `describe` / `set` / `unset` 时返回 `null`，按「凭据不可用」降级。
- 新增 `test/client-credentials.test.mjs`（113 行）覆盖凭据适配层与 `unwrapRpc` 信封解析。
- English: Migrated the browser half from `connection.api.credentials` to DSH `0.1.2-rc.1`'s `remote.credentials`, with a new `createCredentialApi()` adapter that re-wraps `RemoteResult` into the legacy `{ result }` envelope (and `describe`'s value into `{ credentials }`) so the settings page and token editor keep their existing contract.

## [0.1.21] - 2026-08-22

### 变更 / Changed

- 会话令牌模块折叠时隐藏标题栏底部横线（`390b785`）。

## [0.1.20] - 2026-08-22

### 新增 / Added

- 会话令牌模块支持折叠 / 展开，默认折叠；令牌未配置时自动展开（`8be1319`）。

## [0.1.19] - 2026-08-22

### 变更 / Changed

- 会话令牌模块去除内层边框卡片，消除「卡中卡」的视觉嵌套（`e637a9a`）。

## [0.1.18] - 2026-08-22

### 变更 / Changed

- 设置「账户」页的 DeepSeek 面板按四个模块分组为卡片展示（`a7bbaa1`）。

## [0.1.17] - 2026-08-22

### 修复 / Fixed

- 修复消费金额与 Token 柱状图的悬浮热区：热区扩展至柱宽、覆盖整个绘图区高度，并防止 tooltip 被容器截断（`cc69c55`）。

## [0.1.16] - 2026-08-21

### 修复 / Fixed

- 设置「账户」导航图标新增兜底注入，兼容新版壳层结构（`845c177`）。

## [0.1.15] - 2026-08-20

### 变更 / Changed

- 设置「账户」导航图标由默认的「设置」齿轮改为「我的」图标（`d6e6f1d`）。
- 双语 README 的安装命令统一为 `web` profile（`92f45a5`）。

## [0.1.14] - 2026-08-19

### 变更 / Changed

- 按 AGENTS 规范重构中英文 README，并新增界面截图（`254f7f0`）。

## [0.1.13] - 2026-08-18

### 新增 / Added

- OpenCode 额度进度条增加颜色阈值（按用量百分比切换配色）（`d70e110`）。

## [0.1.11] - 2026-08-16

### 新增 / Added

- 首个版本：DSH 设置面板新增「账户」页，包含 DeepSeek 平台余额 / 用量（概要、每日消费与 Token 柱状图、按模型明细、时间维度切换）与 OpenCode Go 配额（5 小时 / 每周 / 每月三窗口）两块面板（`8ab29af`）。
- 宿主半区注册同源 `GET /api/account-usage/*` 路由（`deepseek-summary` / `deepseek-usage` / `opencode`），经凭据服务解析密钥、固定白名单上游 URL，带超时与缓存；浏览器半区注册 `settings.section`（id `account`）。
