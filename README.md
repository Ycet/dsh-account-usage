# dsh-account-usage

[![简体中文](https://img.shields.io/badge/简体中文-red?style=for-the-badge)](README.md)
[![English](https://img.shields.io/badge/English-blue?style=for-the-badge)](README_en.md)

<div align="center">

DeepSeek Harness（DSH）网页界面插件：在设置面板新增「账户」页，一站式查看 DeepSeek 平台余额/用量、OpenCode Go 配额，以及当前订阅周期的额度消耗趋势与期末预测。

> npm 包名：`@ycet/dsh-account-usage`。npm 上同名的 [`dsh-account-usage`](https://www.npmjs.com/package/dsh-account-usage) 是另一个作者的独立项目，与本插件无关，请勿混装。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg?style=for-the-badge)](package.json)
[![npm](https://img.shields.io/npm/v/%40ycet%2Fdsh-account-usage?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@ycet/dsh-account-usage)
[![DSH](https://img.shields.io/badge/DSH-0.1.0--rc.6%2B-purple.svg?style=for-the-badge)](https://github.com/deepseek-ai/deepseek-harness)

</div>

---

## 📑 目录

- [📸 界面预览](#-界面预览)
- [✨ 功能特性](#-功能特性)
- [🚀 快速开始](#-快速开始)
- [⚙️ 配置说明](#️-配置说明)
- [📖 使用说明](#-使用说明)
- [🔧 工作原理](#-工作原理)
- [🧰 环境变量](#-环境变量)
- [⚠️ 已知限制](#️-已知限制)
- [🛠️ 开发](#️-开发)
- [🤝 贡献](#-贡献)
- [📄 许可证](#-许可证)

---

## 📸 界面预览

**DeepSeek 平台内容**（默认嵌入官方「账号与余额」页底部；旧截图为独立兜底页布局）：余额概览、时间维度与官方样式双月区间日历、用量合计（模型 + 工具）、消费/Token 柱状图与模型明细表、网页搜索/抓取用量图表。

![DeepSeek 平台「账户」页界面截图](assets/images/account-usage-U--01.png)

**OpenCode Go 配额页**：5 小时滚动 / 每周 / 每月三个窗口的用量进度条、重置时间与限额参考，下方「用量趋势（当前订阅周期）」按天展示已用额度曲线、期末线性外推预测，鼠标悬浮任一天显示当日累计、当日增量与当日请求数。

![OpenCode Go 配额「账户」页界面截图](assets/images/account-usage-UI--02.png)

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| **DeepSeek 平台概览** | 充值余额、赠送余额、累计消费金额、本月消费金额、本月 Tokens |
| **用量卡片（模型 + 工具）** | 「消费金额」「API 请求次数」为模型消耗与网页搜索/抓取消耗的合计，下方小字标注「模型 ¥x + 工具 ¥x」拆分；工具接口不可用时如实降级提示 |
| **模型用量明细卡片** | 消费金额与 Token 消耗双柱状图（SVG，鼠标悬停看每日明细）+ 按模型明细表，均为模型口径 |
| **网页搜索 / 抓取用量** | 统计区先给出「工具消费总额」，再按日展示 tool-search / tool-fetch 的调用次数、调用类型费用与分工具面积图，随所选时间维度联动；超过 31 天自动分段查询 |
| **合并至官方账号与余额页** | 官方账户页存在时，插件内容嵌入其原生卡片下方，不再占用独立导航项；切分区时隐藏、切回恢复 |
| **账户菜单余额入口** | 在账户菜单「设置」上方显示「余额：¥x.xx」（充值余额 + 赠送余额），点击打开官方「账号与余额」页；官方页不可用时回退到兜底页 |
| **时间维度切换** | 今天 / 近 7 天 / 近 30 天 / 近 90 天 / 本月 / 上月 / 自定义区间（点开区间框在双月日历里选起止日，选满两端或关闭日历即按所选区间筛选） |
| **区间日历** | 官方开放平台样式的双月区间日历：周日起始、深色圆端点、浅灰区间带、今日标记、未来日期置灰、窄屏自动单月、完整键盘操作 |
| **OpenCode Go 配额** | 5 小时滚动 / 每周 / 每月三个窗口的用量百分比与下次重置时间 |
| **额度消耗趋势与预测** | 当前订阅周期内按天的累计已用额度折线 + 到重置日的线性外推虚线；悬浮显示日期、累计已用、当日增量、当日请求数；缺口如实标注、不插值 |
| **本周期模型用量（需 Cookie）** | 配置 OpenCode Console Cookie 后展示本周期最常用模型及占比、总请求数与总 Tokens（数据来自官方日榜） |
| **标签栏吸附** | deepseek / opencode go 标签栏在设置页向下滚动时吸附在内容区顶部，不随内容滑出 |
| **自动刷新** | 页面挂载期间每 60 秒自动轮询最新数据 |
| **双语言界面** | 完整的中英文切换支持 |
| **兜底独立账户页** | 未登录 DSH 官方账号或旧版没有官方账户页时，自动注册插件独立「账户」分区，保证令牌与用量仍可访问 |

> [!NOTE]
> `0.5.0` 把「自定义区间」的原生日期输入换成**官方开放平台样式的双月区间日历**（周日起始、深色圆端点、逐日浅灰区间带、今日浅灰圆/端点内白点、未来日期置灰、窄屏单月、方向键 + Enter/Esc 键盘操作），并把 DeepSeek 页拆成「用量 / 模型用量明细 / 网页搜索与抓取」三张卡片：用量卡片的消费金额与 API 请求次数改为**模型 + 工具合计**并给出拆分小字，模型用量明细卡片合并了原「模型明细」表，网页搜索与抓取卡片新增「工具消费总额」；标签栏改为滚动吸附；Token 柱状图改为「输入（命中缓存）/ 输入（未命中缓存）/ 输出」三段蓝色，悬浮提示改为「日期 + 当日总量」表头加三行明细；预设下拉改为自绘外观（原生 `<select>` 的边框在切换选项后偶尔不重绘）。纯客户端改动，宿主接口与令牌无需调整；升级后按上面的命令重装并刷新页面即可（本地 `link` 安装只需刷新）。

> [!NOTE]
> `0.4.1` 发布到 npm：包名改为 **`@ycet/dsh-account-usage`**（npm 上的 `dsh-account-usage` 已被他人占用，是另一个项目），同步更新 `cordis.patch.yml` 的加载项名与客户端模块 id，并补全 `repository` / `homepage` / `bugs` / `publishConfig` 等 npm 元数据。已安装旧名字副本的请先 `dsh plugin --profile web remove dsh-account-usage` 再按新版安装命令安装，然后完全退出重开 DSH。

> [!NOTE]
> `0.4.0` 在 opencode go 页签的三张额度卡下方新增「用量趋势（当前订阅周期）」：宿主每 15 分钟采样一次官方配额百分比并落盘（`~/.dsh/storages/dsh-account-usage/opencode-samples.v1.json`，保留 180 天），据此画出按天的累计已用额度曲线，并用「已用% ÷ 已过天数」线性外推到重置日。可选的 OpenCode Console Cookie 能解锁官方日榜（每日请求数、按模型占比、0.1% 精度），但不配置也能正常出图。**注意**：本地采样从插件开始记录那天起累积，首次安装后当前周期只有安装之后的数据；需要完整历史请配置 Console Cookie。升级后需完全退出并重开 DSH 桌面端。

> [!NOTE]
> `0.3.0` 将插件内容合并进官方「账号与余额」页：官方账户页存在时不再显示独立「账户」导航项，内容显示在官方原生卡片下方；嵌入模式保留完整的「充值余额 / 赠送余额 / 累计消费金额」展示，与官方余额卡并列（两者刷新时间可能略有差异）。账户菜单余额入口改为打开官方「账号与余额」页。未登录/旧版无官方页时仍保留独立兜底页。升级后需完全退出并重开 DSH 桌面端。

> `0.2.1` 修正与 DSH 0.2.2-rc.1 相关的两处兼容问题：① 去掉对 `@deepseek-ai/dsh-credentials` 的内置依赖——本插件只用该包的一个纯函数（凭证引用名语法校验），内联后插件目录不再携带第二份 `@deepseek-ai/cordis`，消除双实例隐患；② 设置导航图标改走官方 `settings.section.icon` 插槽，旧壳继续由 DOM 钩子兜底（两者靠 svg 标记互斥，不会重影）。同时补上 `engines.dsh: >=0.2.1-rc.2`，让 DSH 的插件兼容性门禁对本事生效。

> `0.2.0` 新增网页搜索/抓取用量图表与账户菜单余额入口。余额入口适配 DSH 桌面端 `0.2.1-rc.5` 的原生账户菜单结构：旧版本没有该菜单、或上游重做菜单时入口会静默不显示，不影响「账户」页。分工具用量接口单次最多 31 天，插件会自动分段合并。升级后需完全退出并重开 DSH 桌面端。

---

## 🚀 快速开始

### 前提条件

- 已安装 DSH CLI 与 pnpm（`dsh plugin` 内部转发到 pnpm）

### 安装

```sh
# 方式一：从 npm 安装（推荐，支持插件页一键更新）
dsh plugin --profile web add @ycet/dsh-account-usage@0.5.0

# 方式二：从本地源码安装（开发）
dsh plugin --profile web add <absolute-path-to-plugin>

# 方式三：从 GitHub 安装（锁定版本 tag，需本机有 git，无需 npm 账号）
dsh plugin --profile web add "github:Ycet/dsh-account-usage#v0.5.0"

# 方式四：从 Release 资产安装（tarball，无需 git、无需 npm 账号）
dsh plugin --profile web add "https://github.com/Ycet/dsh-account-usage/releases/download/v0.5.0/dsh-account-usage-0.5.0.tgz"
```

包声明了 `dsh.bundle` 补丁层，`dsh plugin` 会自动把加载项合入 profile 的 bundle 层，无需手动编辑 `cordis.patch.yml`。方式二～四均无需 npm 账号；桌面端把 `--profile web` 换成 `--profile desktop`（使用桌面端自带 CLI）。

> 从 npm 安装的副本可在「插件 → 已安装」里直接升级；从 GitHub tag 或 Release 压缩包安装的副本不支持页内更新，需要先卸载再重新安装。

<details>
<summary>手动合并补丁层（可选）</summary>

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: account-usage
      name: '@ycet/dsh-account-usage'
```
</details>

### 启动

1. 重启网页应用：`dsh web`
2. 打开 http://127.0.0.1:3080 并刷新页面
3. 登录 DSH 官方账号后打开「设置 → 账号与余额」，插件内容显示在官方卡片下方；未登录时设置面板出现插件兜底「账户」页

---

## ⚙️ 配置说明

### DeepSeek 平台令牌（必需，仅影响 DeepSeek 面板）

用量接口是平台控制台的私有接口，需要你的平台登录令牌：

1. 登录 https://platform.deepseek.com
2. 打开 DevTools → Console，执行：

   ```js
   JSON.parse(localStorage.getItem('userToken')).value
   ```

3. 在插件「账户」页的令牌输入框直接粘贴并保存（写入 `~/.dsh/.credentials.yaml` 的 `DEEPSEEK_PLATFORM_TOKEN`）

<details>
<summary>手动写入凭据文件（可选）</summary>

```yaml
# ~/.dsh/.credentials.yaml
DEEPSEEK_PLATFORM_TOKEN: <令牌>
```
</details>

令牌只存储在本机凭据库，浏览器与网络请求均不携带它往返上游以外的任何位置。

### OpenCode Go Key（通常无需配置）

插件按以下顺序自动查找：

1. DSH 凭据 `OPENCODE_GO_API_KEY`（`~/.dsh/.credentials.yaml`，在「设置 → 模型」配置 opencode-go 时通常已存在）；
2. OpenCode 自身的 `~/.local/share/opencode/auth.json`（`opencode-go` 条目，type 为 `api`）。

### OpenCode Console Cookie（可选，仅影响「用量趋势」的官方日榜）

官方 `GET /zen/go/v1/usage` 只返回当前三个窗口的百分比，**没有任何历史序列**；控制台日榜（每日请求数、按模型占比、0.1% 精度百分比）只认浏览器登录态。想让趋势图回推整个周期并显示每日请求数，需要配置一次 Console Cookie：

1. 浏览器登录 https://opencode.ai/console ；
2. 打开 DevTools → Network，刷新页面，任选一条发往 `console/api/...` 的请求；
3. 复制 Request Headers 里的 `cookie` 值（形如 `session=...; other=...`）；
4. 在插件「用量趋势」卡片点「配置 Console Cookie」，粘贴并保存（写入 DSH 凭据 `OPENCODE_CONSOLE_COOKIE`）。

安全约定：Cookie 只在 DSH 宿主进程内读取，只用于请求三个固定的白名单 URL（`/console/api/go/status`、`/console/api/activity/go`、`/console/api/v2/usage/export`）；它不会出现在浏览器界面、日志或任何接口响应里，诊断信息只回传状态码与 CSV 表头列名。会话过期后卡片会提示「已失效」，重新粘贴即可；也可以随时点「清除」。

不配置也能用：趋势图会退回本地采样数据（来源标注为「本地采样」）。

---

## 📖 使用说明

- 在设置面板打开「账号与余额」页，插件内容显示在官方身份/余额卡下方；未登录时则打开插件独立「账户」页；
- 在插件内容顶部切换 **deepseek / opencode go** 两个标签查看对应数据；
- DeepSeek 页可切换时间维度（今天 / 近 7 天 / 近 30 天 / 近 90 天 / 本月 / 上月），或点开「自定义区间」的只读区间框，在官方样式的双月日历里选起止日——**选满两端会自动关闭并按该区间筛选**，中途按 Esc / 点击面板外也会按已选好的区间筛选（只选了一端则视为放弃）；选完第一端后可用鼠标悬停预览区间；
- 「用量」卡片的消费金额与 API 请求次数是模型 + 工具（网页搜索/抓取）的合计，小字给出拆分；「模型用量明细」卡片里是消费/Token 柱状图与按模型明细表，支持鼠标悬停查看每日明细；
- 「网页搜索与抓取」模块先给出工具消费总额，再展示所选区间内 tool-search / tool-fetch 的调用次数、调用类型费用与每日面积图；超过 31 天的区间会自动分段查询后合并；
- 账户菜单（侧栏账户头像菜单）中「设置」上方新增「余额：¥x.xx」入口，数值为充值余额 + 赠送余额，点击后打开设置并定位到官方「账号与余额」页（无官方页时定位到插件兜底页）；
- OpenCode Go 页展示三个配额窗口的用量百分比、下次重置时间与限额参考，可一键「跳转」到 opencode.ai 或「刷新」；
- 三张额度卡下方是「用量趋势（当前订阅周期）」：横轴为本次订阅周期（由每月窗口的重置时间倒推一个自然月），绿线为已用额度累计、黄虚线为到期预测、灰虚线为 100% 上限；鼠标悬浮任意一天可看「日期 / 已用 / 当日 / 请求数」；
- 顶部摘要显示「当前已用 / 日均消耗 / 预计期末」；周期刚开始（不足 1 天）时只显示「周期刚开始」，不做预测；
- 配置了 Console Cookie 时，趋势卡下方会多出「本周期模型用量」卡（模型占比、请求数、Tokens）；
- 页面挂载期间每 60 秒自动刷新；「打开配置文件」按钮可直接定位本机 DSH 凭据文件。

---

## 🔧 工作原理

双面插件（宿主 + 浏览器），数据通道为宿主注册的同源 HTTP 路由：

| 部分 | 文件 | 作用 |
|------|------|------|
| 宿主 | `index.js` | 注册四条 `GET /api/account-usage/*` 精确路由（`deepseek-summary` / `deepseek-usage` / `opencode` / `opencode-history`）；经 `ctx.credentials` 解析密钥，固定白名单上游 URL，15s 超时 + 30s 缓存；`deepseek-usage` 同时合并模型用量与网页搜索/抓取用量；另有 15 分钟后台采样器写入本地样本库 |
| 解析聚合 | `lib/aggregate.js` | 纯函数：平台信封解包后的每日/每模型 token、费用、请求次数聚合；网页搜索/抓取的时间窗口切分、函数用量与费用合并；订阅周期推算、采样折叠、控制台 CSV/JSON 解析、按天序列与线性外推预测 |
| 浏览器 | `client.js` | 手写惰性 CJS 客户端包：官方账户页存在时用 `react-dom/client` 把内容根挂到官方 `settings.section` 的 `<section>` 末尾（切分区摘除 DOM、保留根；关闭设置卸载）；官方页不可用时注册兜底 `settings.section`（id `account-usage`）。同时负责 SVG 图表、60s 刷新、设置导航图标与账户菜单余额入口 |
| 组合 | `cordis.patch.yml` | `dsh.bundle` 补丁层，安装时自动合入 |

### 数据源

| 用途 | 端点 | 认证 |
|------|------|------|
| 账户概要 | `platform.deepseek.com/api/v0/users/get_user_summary`（+`/get_user_info`） | `Bearer <userToken>` |
| 每日 token 明细 | `platform.deepseek.com/api/v0/usage/amount?month=&year=` | `Bearer <userToken>` |
| 每日费用明细 | `platform.deepseek.com/api/v0/usage/cost?month=&year=` | `Bearer <userToken>` |
| 网页搜索/抓取调用次数 | `platform.deepseek.com/api/v0/usage/by_api_key/amount?start=&end=&tz=`（≤31 天/次） | `Bearer <userToken>` |
| 网页搜索/抓取费用 | `platform.deepseek.com/api/v0/usage/by_api_key/cost?start=&end=&tz=`（≤31 天/次） | `Bearer <userToken>` |
| OpenCode Go 配额 | `opencode.ai/zen/go/v1/usage`（官方） | `Bearer <sk-opencode-…>` |
| 控制台 Go 计量（可选） | `opencode.ai/console/api/go/status` | 浏览器会话 Cookie |
| 控制台每日活动（可选） | `opencode.ai/console/api/activity/go?range=30d` | 浏览器会话 Cookie |
| 控制台用量导出的 CSV（可选） | `opencode.ai/console/api/v2/usage/export?range=30d` | 浏览器会话 Cookie |

### 趋势图的数据口径

```
每 15 分钟采样 ──► 样本库(百分比+重置时间) ──┐
                                             ├─► buildDailySeries ──► 日序列 ──► forecastSeries ──► 曲线+预测
Console 日榜(可选) ──► 每日费用/请求数/Tokens ─┘        ▲
                                                       └── 官方实时百分比（锚定今天这一点）
```

- **周期**：由每月窗口的 `resetsAt` 倒推一个自然月（如 11/20 重置 → 10/20 起算）；
- **采样模式**：每天取当天最后一条样本作为「当天累计已用」；DSH 未运行的日期保持「未记录」，曲线断开、不插值；今天这一点永远用官方实时百分比锚定；
- **官方日榜模式**：把日榜的**累计费用占比**乘以**官方实时百分比**折算成每天的量级（形状来自日榜、量级来自官方口径，避免混合模型换算非线性带来的偏差）；
- **日增量**：只在相邻两天都有数据时计算，跨缺口留空；
- **预测**：`日均 = 已用% ÷ 已过天数`，`期末 = 已用% + 日均 × 剩余天数`，与截图口径一致；不足 1 天不做预测；
- **隐私**：样本库只存百分比与时间戳，不存任何会话内容、模型名或请求内容。

---

## 🧰 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `DSH_ACCOUNT_USAGE_TIMEOUT_MS` | `15000` | 上游请求超时（毫秒） |
| `DSH_ACCOUNT_USAGE_CACHE_MS` | `30000` | 平台数据缓存 TTL（毫秒） |
| `DSH_ACCOUNT_USAGE_MAX_MONTHS` | `3` | 单次查询可覆盖的最大月份数（超出自动裁剪） |
| `DSH_ACCOUNT_USAGE_OPENCODE_CACHE_MS` | `60000` | OpenCode 配额缓存 TTL（毫秒） |
| `DSH_ACCOUNT_USAGE_SAMPLE_INTERVAL_MS` | `900000` | 后台采样间隔（毫秒，默认 15 分钟） |
| `DSH_ACCOUNT_USAGE_SAMPLE_FIRST_DELAY_MS` | `30000` | 插件加载后首次采样延迟（毫秒） |
| `DSH_ACCOUNT_USAGE_SAMPLING` | 未设置 | 设为 `off` 可完全关闭后台采样 |
| `DSH_ACCOUNT_USAGE_DATA_DIR` | `~/.dsh/storages/dsh-account-usage` | 样本库目录 |
| `DSH_ACCOUNT_USAGE_CONSOLE_CACHE_MS` | `600000` | 控制台日榜缓存 TTL（毫秒，Cookie 变化时立即失效） |

---

## ⚠️ 已知限制

- DeepSeek 平台用量接口为**未公开的私有接口**，字段可能随平台升级变化；插件对响应做防御式解析，字段缺失时降级为「—」而非报错。若页面长期显示「—」，请重新抓包确认字段并反馈。
- 「累计消费金额」「API 请求次数」字段不在公开文档中：累计消费按命名启发式在概要响应中搜索（找不到则显示「—」），请求次数读取模型条目上的 `count/requests/request_count/req_count/calls` 字段。两者均在真实令牌实测后校准。
- 网页搜索/抓取用量接口单次最多查询 31 天；插件按 31 天窗口自动分段，区间过长时请求数会相应增加。工具名来自平台返回的 `functions` 数组（当前为 `tool-search` / `tool-fetch`），未知工具原样展示。
- 账户菜单余额入口依赖 DSH 0.2.x 的原生账户菜单 DOM；上游重做菜单结构时入口可能暂时不显示，但不影响账户页与其余功能。该入口只读取本插件已配置的平台令牌，不会额外保存余额数据。
- 合并内容依赖官方「账号与余额」页的 DOM（`[data-slot="settings.section"]` 内的 `<section>`）；上游重写账户页结构时嵌入内容可能不再显示，此时可等待插件适配或暂时依赖兜底页（官方页存在时兜底页不会显示）。
- 嵌入内容在同一设置会话内切换分区会保留 tab/时间维度；关闭设置再打开会重置为 deepseek / 本月。官方页仅登录 DSH 官方账号后存在，未登录时使用兜底页。
- OpenCode Go 的限额（$12/$30/$60）为套餐参考值，端点未返回限额；套餐调整时以 opencode.ai 页面为准。
- 趋势图在**未配置 Console Cookie** 时依赖本地采样：历史只能从插件开始记录那天起累积（首次安装后当前周期只有安装之后的数据），百分比精度受官方接口整数限制（1%）。需要完整周期与每日请求数请配置 Cookie。
- 控制台接口（`/console/api/*`）是**未公开的内部接口**，只认浏览器会话 Cookie，且可能随上游改版失效。插件对结构做别名容忍解析，失败时自动退回采样数据，并在响应里只回传状态码与 CSV 表头列名以便定位（不含 Cookie、不含业务数据）。Cookie 过期需重新粘贴。
- 官方日榜的日期口径为 UTC，插件按本地时区展示，跨零点附近可能差 1 天；日榜本身也有聚合延迟，刚完成的请求可能次日才计入。
- Console Cookie 是**账号级会话凭据**（权限高于 API Key）：只保存在本机 DSH 凭据库、仅宿主读取、只用于三个固定白名单 URL；请勿把它粘贴到任何第三方工具。
- 线性外推是「按当前速度」的粗略估计，不含周末/工作日差异；命中上限或额度调整时预测会偏。
- 服务绑定 `0.0.0.0` 时本插件路由对局域网可达（与 DSH 其他本地插件相同的既有限制，默认 `127.0.0.1` 无此问题）。

---

## 🛠️ 开发

```sh
npm run check  # 宿主、客户端和聚合模块语法检查
npm test       # 凭据、OpenCode Go、工具用量解析与路由回归测试

# 本地安装（开发迭代）：
dsh plugin --profile web add <absolute-path-to-plugin>
# 修改源码后需重新安装（先 remove 再 add，或提升版本号后重新 add），再重启 dsh web
```

修改 `client.js` 后需重启 `dsh web`（重新生成 boot-graph 哈希），再强制刷新页面。

桌面端需完全退出并重新打开应用。本地 `link:` 安装会直接加载修改后的源码。设置 `DSH_TEST_INSTALL_ROOT` 为包含 DSH `node_modules` 的运行时目录后，`npm test` 还会使用真实槽位注册器验证官方页与插件页的两种加载顺序，以及卸载插件页后官方页仍保留；未设置时跳过这两项集成测试。

> [!NOTE]
> `dsh plugin` 在 Windows 下经 shell 转发 pnpm，安装路径不能含空格；工作区路径含空格时可先在无空格路径建目录联接（`mklink /J`）作为安装网关。

---

## 🤝 贡献

欢迎提交 Issue 与 Pull Request：发现问题请携带界面截图与版本号到 [Issues](https://github.com/Ycet/dsh-account-usage/issues) 反馈；改进请按 Fork → 分支 → PR 流程提交。

---

## 📄 许可证

本项目使用 [MIT](LICENSE) 许可证。
