# dsh-account-usage

DeepSeek Harness（DSH）网页界面插件：在**设置面板**新增独立「**账户**」页，一站式查看：

- **DeepSeek 开放平台**（platform.deepseek.com/usage 同源数据）
  - 充值余额 / 赠送余额
  - 累计消费金额、本月消费金额、本月 tokens
  - 每日**消费金额柱状图**
  - 所选时间维度内的**消费金额、API 请求次数、tokens** 汇总
  - 按模型明细表（deepseek-v4-flash / deepseek-v4-pro / 其他）：请求次数 + 输入/缓存/输出 tokens + 费用
  - 可切换**时间维度**（今天 / 近7天 / 近30天 / 近90天 / 本月 / 上月 / 自定义）
- **OpenCode Go** 套餐用量（opencode.ai 官方端点）
  - 5 小时滚动 / 每周 / 每月 三个窗口的**用量百分比**与**下次重置时间**

## 安装

需要 DSH CLI 与 pnpm（`dsh plugin` 内部转发到 pnpm）。

```sh
# 本地目录安装（开发）：
dsh plugin --profile web add "D:\AI Agent project\00 Long-term project\00 大型项目\05 dsh插件制作\dsh-account-usage"

# 或从 GitHub 安装（发布后）：
dsh plugin --profile web add github:<owner>/dsh-account-usage
```

包声明了 `dsh.bundle` 补丁层，`dsh plugin` 会自动把加载项合入 profile 的 bundle 层（无需手动编辑 cordis.patch.yml）。手动方式：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: account-usage
      name: dsh-account-usage
```

然后：

1. 重启网页应用：`dsh web`
2. 打开 http://127.0.0.1:3080 并刷新页面
3. 设置面板出现「账户」页

## 配置

### DeepSeek 平台令牌（必需，仅影响 DeepSeek 面板）

用量接口是平台控制台的私有接口，需要你的平台登录令牌：

1. 登录 https://platform.deepseek.com
2. 打开 DevTools → Console，执行：

   ```js
   JSON.parse(localStorage.getItem('userToken')).value
   ```

3. 两种写入方式任选：
   - 在插件「账户」页的令牌输入框直接粘贴并保存（写入 `~/.dsh/.credentials.yaml` 的 `DEEPSEEK_PLATFORM_TOKEN`）；
   - 或手动追加到 `~/.dsh/.credentials.yaml`：

     ```yaml
     DEEPSEEK_PLATFORM_TOKEN: <令牌>
     ```

令牌只存储在本机凭据库，浏览器与网络请求均不携带它往返上游以外的任何位置。

### OpenCode Go Key（通常无需配置）

插件按以下顺序自动查找：

1. DSH 凭据 `OPENCODE_GO_API_KEY`（`~/.dsh/.credentials.yaml`，在「设置 → 模型」配置 opencode-go 时通常已存在）；
2. OpenCode 自身的 `~/.local/share/opencode/auth.json`（`opencode-go` 条目，type 为 `api`）。

## 工作原理

双面插件（宿主 + 浏览器），数据通道为宿主注册的同源 HTTP 路由（与 `dsh-deepseek-quota` 同款模式，无需 Typert 清单）：

| 部分 | 文件 | 作用 |
|---|---|---|
| 宿主 | `index.js` | 注册三条 `GET /api/account-usage/*` 精确路由：平台概要、区间用量（按月拉取+聚合）、OpenCode 配额；经 `ctx.credentials` 解析密钥，固定白名单上游 URL，15s 超时 + 30s 缓存 |
| 解析聚合 | `lib/aggregate.js` | 纯函数：平台信封解包后的每日/每模型 token、费用、请求次数聚合（无依赖，可独立测试） |
| 浏览器 | `client.js` | 手写惰性 CJS 客户端包：注册 `settings.section`（id `account`），渲染账户页（SVG 柱状图、维度选择器、模型表、配额进度条），挂载期间每 60s 自动刷新 |
| 组合 | `cordis.patch.yml` | `dsh.bundle` 补丁层，安装时自动合入 |
| 测试 | `test/aggregate.mjs` | fixture 单测：`node test/aggregate.mjs` |

### 数据源

| 用途 | 端点 | 认证 |
|---|---|---|
| 账户概要 | `platform.deepseek.com/api/v0/users/get_user_summary`（+`/get_user_info`） | `Bearer <userToken>` |
| 每日 token 明细 | `platform.deepseek.com/api/v0/usage/amount?month=&year=` | `Bearer <userToken>` |
| 每日费用明细 | `platform.deepseek.com/api/v0/usage/cost?month=&year=` | `Bearer <userToken>` |
| OpenCode Go 配额 | `opencode.ai/zen/go/v1/usage`（官方） | `Bearer <sk-opencode-…>` |

## 环境变量（可选调优）

| 变量 | 默认 | 说明 |
|---|---|---|
| `DSH_ACCOUNT_USAGE_TIMEOUT_MS` | `15000` | 上游请求超时（毫秒） |
| `DSH_ACCOUNT_USAGE_CACHE_MS` | `30000` | 平台数据缓存 TTL（毫秒） |
| `DSH_ACCOUNT_USAGE_MAX_MONTHS` | `3` | 单次查询可覆盖的最大月份数（超出自动裁剪） |

## 已知限制

- DeepSeek 平台用量接口为**未公开的私有接口**，字段可能随平台升级变化；插件对响应做防御式解析，字段缺失时降级为「—」而非报错。若页面长期显示「—」，请重新抓包确认字段并反馈。
- 「累计消费金额」「API 请求次数」字段不在公开文档中：累计消费按命名启发式在概要响应中搜索（找不到则显示「—」），请求次数读取模型条目上的 `count/requests/request_count/req_count/calls` 字段。两者均在真实令牌实测后校准。
- OpenCode Go 的限额（$12/$30/$60）为套餐参考值，端点未返回限额；套餐调整时以 opencode.ai 页面为准。
- 服务绑定 `0.0.0.0` 时本插件路由对局域网可达（与 DSH 其他本地插件相同的既有限制，默认 `127.0.0.1` 无此问题）。

## 开发

```sh
node test/aggregate.mjs      # 聚合/解析单测
node test/routes.mjs         # 宿主路由冒烟测试（模拟 ctx + 模拟 fetch）
node test/client-render.mjs  # 客户端 bundle 预检（模拟加载器 + SSR 渲染页面）
node --check index.js        # 语法检查

# 本地安装（file: 协议按版本号缓存快照，改完代码需两选一）：
#   a) 提升 package.json 版本号后：dsh plugin --profile web add file:<路径>
#   b) 或先移除再重装：dsh plugin --profile web remove dsh-account-usage
#                     dsh plugin --profile web add file:<路径>
# 之后重启 dsh web 生效
```

修改 `client.js` 后需重启 `dsh web`（重新生成 boot-graph 哈希），再强制刷新页面。

> 提示：`dsh plugin` 在 Windows 下经 shell 转发 pnpm，安装路径不能含空格；工作区路径含空格时可先在无空格路径建目录联接（`mklink /J`）作为安装网关。

## License

MIT
