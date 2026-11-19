# dsh-account-usage

[![简体中文](https://img.shields.io/badge/简体中文-red?style=for-the-badge)](README.md)
[![English](https://img.shields.io/badge/English-blue?style=for-the-badge)](README_en.md)

<div align="center">

A DeepSeek Harness (DSH) web-GUI plugin: adds an "Account" page to the settings panel for a one-stop view of DeepSeek platform balance/usage, OpenCode Go quotas, and the current subscription period's quota-consumption trend with an end-of-period forecast.

> npm package: `@ycet/dsh-account-usage`. The unscoped [`dsh-account-usage`](https://www.npmjs.com/package/dsh-account-usage) on npm is an unrelated project by another author — do not mix the two.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg?style=for-the-badge)](package.json)
[![npm](https://img.shields.io/npm/v/%40ycet%2Fdsh-account-usage?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/@ycet/dsh-account-usage)
[![DSH](https://img.shields.io/badge/DSH-0.1.0--rc.6%2B-purple.svg?style=for-the-badge)](https://github.com/deepseek-ai/deepseek-harness)

</div>

---

## 📑 Table of Contents

- [📸 Preview](#-preview)
  - [Overview](#overview) · [DeepSeek platform](#deepseek-platform) · [OpenCode Go](#opencode-go) · [What each tab shows](#what-each-tab-shows)
- [✨ Features](#-features)
  - [Overview capabilities](#overview-capabilities) · [DeepSeek platform capabilities](#deepseek-platform-capabilities) · [OpenCode Go capabilities](#opencode-go-capabilities) · [General capabilities](#general-capabilities)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Configuration](#️-configuration)
- [📖 Usage](#-usage)
- [🔧 How It Works](#-how-it-works)
- [🧰 Environment Variables](#-environment-variables)
- [⚠️ Known Limitations](#️-known-limitations)
- [🛠️ Development](#️-development)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 📸 Preview

The plugin embeds into the official "Account & balance" page and is split into three tabs: **Overview / deepseek / opencode go**. All screenshots below are taken from the real running UI.

### Overview

The default tab: five per-year usage stats (total tokens, peak day, longest task, longest/current streak) plus the yearly token activity heatmap.

<img src="assets/images/overview.png" alt="Overview tab: five per-year stats and the token activity heatmap" width="860">

### DeepSeek platform

Session token, account balance, usage totals (model + tools), model usage details, and web search/fetch usage.

<img src="assets/images/deepseek-01-overview.png" alt="DeepSeek tab: session token, account balance and the usage card" width="860">

<img src="assets/images/deepseek-02-model-usage.png" alt="DeepSeek tab: model usage details with cost/token bar charts and the per-model table" width="860">

<img src="assets/images/deepseek-03-tools.png" alt="DeepSeek tab: web search and fetch usage summary" width="860">

<img src="assets/images/deepseek-04-tool-trends.png" alt="DeepSeek tab: per-tool area charts for web search and fetch" width="860">

### OpenCode Go

Quota progress bars, reset times and reference limits for the three windows, plus the current period's usage trend and extrapolated forecast.

<img src="assets/images/opencode-go-01-quota.png" alt="OpenCode Go tab: 5-hour rolling / weekly / monthly quotas and the usage trend summary" width="860">

<img src="assets/images/opencode-go-02-trend.png" alt="OpenCode Go tab: quota usage trend line, forecast and models used this period" width="860">

### What each tab shows

| Tab | Main content | Data source |
|-----|--------------|-------------|
| **Overview** | Five per-year stats and the yearly token activity heatmap (daily / weekly / cumulative, Monday-first) | Local session logs (scanned and cached by the host) |
| **deepseek** | Session token, account balance, usage totals, model usage details, web search & fetch | Private endpoints of the DeepSeek platform |
| **opencode go** | Quota window progress, usage trend and forecast, models used this period | Official OpenCode usage endpoint + optional Console cookie |

---

## ✨ Features

### Overview capabilities

| Feature | Description |
|---------|-------------|
| **Yearly usage stats** | Total tokens, peak day (with date), longest task, longest streak and current streak, switched by a year dropdown |
| **Append-only ledger** | Stats come from local session logs; archived or deleted sessions still keep and contribute their historical usage |
| **Token activity heatmap** | Year grid with `Daily` / `Weekly` / `Cumulative` modes |
| **Monday-first weeks + bottom-up fill** | One column is one week, with **Monday as the first day** (top = Monday, bottom = Sunday); weekly and cumulative both fill each column from the bottom, so the number of colored cells equals the days used that week, one shade per column |
| **Four log-scale levels** | Bucketed on a log scale (P25/P50/P75 boundaries); only 0-token days stay empty and any day with usage gets at least the first level |
| **Hover detail** | Shows the date / week / cumulative caption plus the token count with unit (万/亿 in Chinese, K/M/B in English) |

### DeepSeek platform capabilities

| Feature | Description |
|---------|-------------|
| **Account overview** | Recharge balance, bonus balance, cumulative spending, current-month spending and tokens |
| **Time-range switching** | Today / last 7 days / last 30 days / last 90 days / this month / last month / custom range |
| **Range calendar** | Open-platform-style two-month calendar: Sunday-first, dark circular endpoints, per-day light range fill, today marker, future dates disabled, single month on narrow screens, full keyboard support; applies as soon as both ends are picked or the calendar closes |
| **Usage card (model + tools)** | "Spend" and "API requests" combine model usage with web search/fetch usage, with a small breakdown line ("model ¥x + tools ¥x"); degraded honestly when the tool endpoint is unavailable |
| **Model usage details card** | Cost and token bar charts (SVG, hover for per-day detail) plus the per-model table, all on the model-only basis |
| **Three-shade token chart** | The token chart stacks input (cache hit) / input (cache miss) / output in three shades of blue, and the tooltip lists the daily total plus the three rows |
| **Web search / fetch usage** | The stats area starts with the total tool cost, then daily call counts and cost by call type (`tool-search` / `tool-fetch`) with per-tool area charts; ranges over 31 days are queried in windows and merged |

### OpenCode Go capabilities

| Feature | Description |
|---------|-------------|
| **Quota windows** | Usage percentage, next reset time and reference limit for the 5-hour rolling / weekly / monthly windows |
| **Quota trend & forecast** | Per-day cumulative quota line for the current subscription period plus a linear forecast to the reset date; hover shows date, cumulative used, that day's increment and that day's requests; gaps are labelled, never interpolated |
| **Models this period (cookie only)** | With an OpenCode Console cookie: the period's most-used models with shares, total requests and total tokens (from the official daily report) |

### General capabilities

| Feature | Description |
|---------|-------------|
| **Merge into the official Account & balance page** | When the official page exists, plugin content is embedded below its native cards and no separate nav entry is added; switching sections hides it and switching back restores it |
| **Fallback standalone page** | When DSH is signed out or the official account page does not exist, the plugin registers its own "Account" section so the token and usage stay reachable |
| **Account-menu balance entry** | Shows "Balance: ¥x.xx" (top-up + granted) above "Settings" in the account menu; click to open the official Account & balance page, falling back to the plugin's own page when the official one is unavailable |
| **Sticky tabs** | The tab bar sticks to the top of the settings content area while scrolling |
| **Auto refresh** | Polls for fresh data every 60 seconds while the page is mounted |
| **Bilingual UI** | Full Chinese/English switching |

> [!NOTE]
> `0.5.0` replaces the native date inputs with an **open-platform-style two-month range calendar** (Sunday-first, dark circular endpoints, per-day light range fill, light circle for today / white dot when today is an endpoint, future dates disabled, single month on narrow screens, arrow-key + Enter/Esc support) and splits the DeepSeek page into three cards — Usage, Model usage details, and Web search & fetch. The Usage card now reports spend and API requests as **model + tools totals** with a breakdown line, the model table moved into Model usage details, the tool card gained a total tool cost stat, the tab bar sticks to the top while scrolling, a new leftmost default **Overview** tab adds five per-year usage stats plus a yearly token heatmap (from local session logs; the ledger only grows, so archived or deleted sessions still count), the token chart uses a three-step blue ramp for input (cache hit) / input (cache miss) / output with a "date + daily total" tooltip header plus three detail rows, and the preset dropdown is now custom-skinned (the native `<select>` border occasionally failed to repaint after switching options). Client-side only: host routes and credentials are unchanged, so reinstall with the command above and refresh the page (a local `link` install only needs a refresh).

> [!NOTE]
> `0.4.1` publishes to npm under the scoped name **`@ycet/dsh-account-usage`** (the unscoped `dsh-account-usage` is taken by another project). The `cordis.patch.yml` loader entry name and the client module id follow the package name, and the manifest now carries `repository` / `homepage` / `bugs` / `publishConfig`. If you installed an older copy under the previous name, run `dsh plugin --profile web remove dsh-account-usage` first, then install with the command above and fully quit and reopen DSH.

> [!NOTE]
> `0.4.0` adds a "Usage trend (current period)" card below the three quota cards in the opencode go tab: the host samples the official quota percentage every 15 minutes and persists it (`~/.dsh/storages/dsh-account-usage/opencode-samples.v1.json`, kept for 180 days), which drives the per-day cumulative line and a linear forecast (`used% ÷ elapsed days × remaining days`). An optional OpenCode Console cookie unlocks the official daily report (daily requests, per-model shares, 0.1% precision); the chart works without it. **Note**: local sampling only accumulates from the day the plugin starts recording, so right after installing the current period only holds post-install data — configure the Console cookie for the full period. Fully quit and reopen DSH desktop after upgrading.

> [!NOTE]
> `0.3.0` merges the plugin content into the official "Account & balance" page: when that page exists, no separate "Account" nav entry is shown and the content appears below the native cards; embedded mode keeps the full "top-up / granted / cumulative spend" balance display alongside the official balance card (the two may refresh at slightly different times). The account-menu balance entry now opens the official page. The standalone fallback page remains for signed-out users / older DSH. Fully quit and reopen DSH desktop after upgrading.

> `0.2.0` adds web search/fetch usage charts and an account-menu balance entry. The entry targets the native account menu structure of DSH desktop `0.2.1-rc.5`: on older versions without that menu, or if upstream redesigns it, the entry stays hidden without affecting the Account page. The tool-usage API is limited to 31 days per request; the plugin splits and merges longer ranges automatically. Fully quit and reopen DSH desktop after upgrading.

---

## 🚀 Quick Start

### Prerequisites

- DSH CLI and pnpm installed (`dsh plugin` forwards to pnpm internally)

### Install

```sh
# Option 1: install from npm (recommended; can be updated from the plugin page)
dsh plugin --profile web add @ycet/dsh-account-usage@0.5.0

# Option 2: install from a local source directory (development)
dsh plugin --profile web add <absolute-path-to-plugin>

# Option 3: install from GitHub (pinned to a release tag; requires git, no npm account)
dsh plugin --profile web add "github:Ycet/dsh-account-usage#v0.5.0"

# Option 4: install from a Release asset (tarball; no git, no npm account)
dsh plugin --profile web add "https://github.com/Ycet/dsh-account-usage/releases/download/v0.5.0/dsh-account-usage-0.5.0.tgz"
```

The package declares a `dsh.bundle` patch layer; `dsh plugin` merges the loader entry into the profile's bundle layer automatically — no manual editing of `cordis.patch.yml` required. Options 2–4 need no npm account; for the desktop app replace `--profile web` with `--profile desktop` (using the desktop-bundled CLI).

> Copies installed from npm can be updated from "Plugins → Installed"; copies installed from a GitHub tag or a Release tarball cannot be updated in place — uninstall and reinstall instead.

<details>
<summary>Manual patch-layer merge (optional)</summary>

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: account-usage
      name: '@ycet/dsh-account-usage'
```
</details>

### Launch

1. Restart the web app: `dsh web`
2. Open http://127.0.0.1:3080 and refresh the page
3. After signing in to a DSH official account, open "Settings → Account & balance"; the plugin content appears below the native cards. When signed out, the plugin's fallback "Account" page appears instead

---

## ⚙️ Configuration

### DeepSeek platform token (required; only affects the DeepSeek tab)

The usage endpoints are private APIs of the platform console and need your login token:

1. Sign in at https://platform.deepseek.com
2. Open DevTools → Console and run:

   ```js
   JSON.parse(localStorage.getItem('userToken')).value
   ```

3. Paste the token into the input on the plugin's "Account" page and save it (stored as `DEEPSEEK_PLATFORM_TOKEN` in `~/.dsh/.credentials.yaml`)

<details>
<summary>Write the credentials file manually (optional)</summary>

```yaml
# ~/.dsh/.credentials.yaml
DEEPSEEK_PLATFORM_TOKEN: <token>
```
</details>

The token stays in your local credential store; the browser and network requests never carry it anywhere beyond the upstream.

### OpenCode Go key (usually no configuration needed)

The plugin looks it up automatically in this order:

1. DSH credential `OPENCODE_GO_API_KEY` (`~/.dsh/.credentials.yaml`; usually already present when opencode-go is configured in Settings → Models);
2. OpenCode's own `~/.local/share/opencode/auth.json` (the `opencode-go` entry with `type: api`).

### OpenCode Console cookie (optional; only affects the official daily report in the usage trend)

The public `GET /zen/go/v1/usage` endpoint returns only the current three windows' percentages and **no history at all**; the Console daily report (daily requests, per-model shares, 0.1%-precision percentages) only accepts a browser session. To let the trend chart cover the whole period and show daily requests, configure the Console cookie once:

1. Sign in at https://opencode.ai/console in a browser;
2. Open DevTools → Network, reload the page and pick any request to `console/api/...`;
3. Copy the `cookie` request-header value (e.g. `session=...; other=...`);
4. In the plugin's "Usage trend" card click "Configure Console cookie", paste it and save (stored as `OPENCODE_CONSOLE_COOKIE` in the DSH credential store).

Security contract: the cookie is read only inside the DSH host process and is used only for three fixed whitelisted URLs (`/console/api/go/status`, `/console/api/activity/go`, `/console/api/v2/usage/export`). It never appears in the browser UI, logs, or any response body; diagnostics expose only status codes and the CSV header row. When the session expires the card says so — paste a fresh value, or use "Clear" at any time.

It is optional: without it the trend falls back to local sampling (labelled "local sampling").

---

## 📖 Usage

### Opening it

- Open the official "Account & balance" page in settings; the plugin content appears below the native identity/balance cards. When signed out, the plugin's standalone "Account" page is shown instead;
- Switch between the **Overview / deepseek / opencode go** tabs at the top of the embedded plugin content (Overview is the default);
- The account menu (sidebar account avatar) gets a "Balance: ¥x.xx" entry above "Settings" (top-up + granted balance); clicking it opens Settings on the official "Account & balance" page (or the fallback page when the official one is unavailable);
- Data auto-refreshes every 60 seconds while the page is mounted; "Open config file" locates your local DSH credentials file.

### On the Overview tab

- The year dropdown drives both the five stats and the heatmap;
- The heatmap is laid out by calendar year with **Monday as the first day of each week** (top = Monday, bottom = Sunday); three modes are available:
  - `Daily` — shades by that day's usage;
  - `Weekly` — one shade per column, filled bottom-up with as many cells as days used that week;
  - `Cumulative` — shaded by the running total at that week's last day, with the same bottom-up fill and future dates left empty;
- Four levels are bucketed on a log scale (P25/P50/P75 boundaries) so only 0-token days remain empty;
- The host scans local session logs in the background on first visit (shows "Scanning…") and the numbers refresh automatically when it finishes; the refresh button forces a rescan.

### On the DeepSeek tab

- Pick a time range (Today / last 7 days / last 30 days / last 90 days / this month / last month), or open the read-only range box and pick start/end in the open-platform-style two-month calendar — **picking both ends closes the calendar and applies the range**, and closing it by Esc or an outside click also applies whatever range is staged (an unfinished single-end pick is discarded); hovering previews the range after the first click;
- The Usage card's spend and API requests are the model + tools (web search/fetch) total, with a small breakdown line;
- Hover over the bar charts for daily details; the token chart stacks input (cache hit) / input (cache miss) / output; the per-model table shows requests, tokens and cost for the selected range;
- The "Web Search & Fetch" module starts with the total tool cost, then shows daily `tool-search` / `tool-fetch` call counts, call-type cost and per-tool area charts for the selected range; ranges over 31 days are split and merged automatically.

### On the OpenCode Go tab

- View usage percentage, next reset time and reference limit for each quota window, with one-click "Go to opencode.ai" and "Refresh" buttons;
- Below the three quota cards, "Usage trend (current period)" uses the current subscription period as its x-axis (derived by stepping one calendar month back from the monthly reset time): the green line is cumulative quota used, the dashed amber line is the forecast to the reset date, and the dashed grey line is the 100% limit; hover any day for date / used / that day / requests;
- The summary row shows current used, daily pace and the projected end value; when the period just started (under one day) it says "Period just started" and makes no forecast;
- With a Console cookie configured, a "Models this period" card (model shares, requests, tokens) appears below the trend card.

---

## 🔧 How It Works

A dual-half plugin (host + browser) with data flowing through same-origin HTTP routes registered by the host:

| Part | File | Role |
|------|------|------|
| Host | `index.js` | Registers five precise `GET /api/account-usage/*` routes (`deepseek-summary` / `deepseek-usage` / `opencode` / `opencode-history` / `insights`); resolves keys via `ctx.credentials`, uses fixed allow-listed upstream URLs, 15s timeout + 30s cache; `deepseek-usage` merges model usage with web search/fetch usage; a 15-minute background sampler writes the local sample store |
| Parsing/aggregation | `lib/aggregate.js` | Pure functions: daily/per-model token, cost and request-count aggregation; time-window splitting and function-usage merge for web search/fetch; subscription-period derivation, sample compaction, Console CSV/JSON parsing, daily-series building and linear forecasting |
| Usage ledger | `lib/insights.js` | Pure functions: folds `assistant/message.usage` and turn durations out of session logs and merges them into the ledger incrementally by revision; sessions missing from the list are marked `retained` and keep counting, so the ledger only grows |
| Browser | `client.js` | Hand-written lazy CJS client bundle: when the official account page exists, mounts its content root below the native cards of its `settings.section` `<section>` using `react-dom/client` (detaches DOM but keeps the root on section switches; unmounts when settings closes); otherwise registers the fallback `settings.section` (id `account-usage`). Also renders the SVG charts, 60s refresh, settings nav icon and account-menu balance entry |
| Composition | `cordis.patch.yml` | `dsh.bundle` patch layer, merged automatically on install |

### Data sources

| Purpose | Endpoint | Auth |
|---------|----------|------|
| Account summary | `platform.deepseek.com/api/v0/users/get_user_summary` (+`/get_user_info`) | `Bearer <userToken>` |
| Daily token details | `platform.deepseek.com/api/v0/usage/amount?month=&year=` | `Bearer <userToken>` |
| Daily cost details | `platform.deepseek.com/api/v0/usage/cost?month=&year=` | `Bearer <userToken>` |
| Web search/fetch call counts | `platform.deepseek.com/api/v0/usage/by_api_key/amount?start=&end=&tz=` (≤31 days per request) | `Bearer <userToken>` |
| Web search/fetch cost | `platform.deepseek.com/api/v0/usage/by_api_key/cost?start=&end=&tz=` (≤31 days per request) | `Bearer <userToken>` |
| OpenCode Go quota | `opencode.ai/zen/go/v1/usage` (official) | `Bearer <sk-opencode-…>` |
| Console Go meters (optional) | `opencode.ai/console/api/go/status` | browser session cookie |
| Console daily activity (optional) | `opencode.ai/console/api/activity/go?range=30d` | browser session cookie |
| Console usage export CSV (optional) | `opencode.ai/console/api/v2/usage/export?range=30d` | browser session cookie |

The Overview tab touches no external endpoint: the host reads local session logs (`ctx.sessionPersistence`), folds them and persists the result to `~/.dsh/storages/dsh-account-usage/usage-ledger.v1.json`.

### How the trend numbers are derived

```mermaid
flowchart LR
  A["Sample every 15 min"] --> B["Sample store<br/>percent + resetsAt"]
  C["Console daily report (optional)<br/>daily cost / requests / tokens"] --> D["buildDailySeries"]
  B --> D
  D --> E["Daily series"]
  E --> F["forecastSeries"]
  F --> G["Cumulative line + end-of-period forecast"]
  H["Official live percentage"] --> D
```

- **Period**: one calendar month stepped back from the monthly `resetsAt` (reset on 11/20 → period starts 10/20);
- **Sampling mode**: each day's last sample becomes that day's cumulative value; days when DSH was not running stay "not recorded" and the line breaks — no interpolation; today's point is always anchored to the official live percentage;
- **Official daily-report mode**: the daily report's **cumulative cost share** is multiplied by the **official live percentage** (shape from the report, magnitude from the official meter), which avoids the non-linear per-model conversion;
- **Daily increment**: computed only between two adjacent recorded days, left empty across gaps;
- **Forecast**: `pace = used% ÷ elapsed days`, `end = used% + pace × remaining days`; no forecast while the period is under one day old;
- **Privacy**: the sample store holds percentages and timestamps only — no session content, model names or request content.

---

## 🧰 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DSH_ACCOUNT_USAGE_TIMEOUT_MS` | `15000` | Upstream request timeout (ms) |
| `DSH_ACCOUNT_USAGE_CACHE_MS` | `30000` | Platform data cache TTL (ms) |
| `DSH_ACCOUNT_USAGE_MAX_MONTHS` | `3` | Max months a single query may span (truncated automatically) |
| `DSH_ACCOUNT_USAGE_OPENCODE_CACHE_MS` | `60000` | OpenCode quota cache TTL (ms) |
| `DSH_ACCOUNT_USAGE_SAMPLE_INTERVAL_MS` | `900000` | Background sampling interval (ms; 15 minutes by default) |
| `DSH_ACCOUNT_USAGE_SAMPLE_FIRST_DELAY_MS` | `30000` | Delay before the first sample after the plugin loads (ms) |
| `DSH_ACCOUNT_USAGE_SAMPLING` | unset | Set to `off` to disable background sampling entirely |
| `DSH_ACCOUNT_USAGE_DATA_DIR` | `~/.dsh/storages/dsh-account-usage` | Sample store directory |
| `DSH_ACCOUNT_USAGE_CONSOLE_CACHE_MS` | `600000` | Console report cache TTL (ms; invalidated immediately when the cookie changes) |

---

## ⚠️ Known Limitations

- The Overview tab relies on DSH's `sessionPersistence` service to read local session logs: on first use (or on a new machine) the ledger is empty until the background scan finishes, and the page shows "Scanning…" meanwhile. The ledger lives at `~/.dsh/storages/dsh-account-usage/usage-ledger.v1.json`; deleting it **loses the historical totals of already-deleted sessions** (their logs are no longer on disk), so clean it up carefully. On older DSH versions without that service the tab reports that session-log statistics are unsupported.
- Sessions started from a worktree and sessions from subagents both count; the longest-task stat only measures main-session turns, not subagent time.
- The DeepSeek usage APIs are **undocumented private endpoints**; fields may change as the platform evolves. The plugin parses responses defensively and degrades missing fields to "—" instead of failing. If "—" persists, re-capture the API and report back.
- "Cumulative spending" and "API request count" are not in public docs: cumulative spending is located by a naming heuristic in the summary response (shows "—" if not found), and request count reads `count/requests/request_count/req_count/calls` fields on model entries. Both were calibrated against a real token.
- The web search/fetch usage API accepts at most 31 days per request; the plugin splits longer ranges into 31-day windows, so very long ranges make more requests. Tool names come from the platform's `functions` array (`tool-search` / `tool-fetch` today); unknown tools are shown as-is.
- The account-menu balance entry relies on the native DSH 0.2.x account menu DOM. If upstream redesigns that menu, the entry may be temporarily hidden, without affecting the account page or other features. It only reads the platform token already configured for this plugin and stores no balance data.
- The merged content relies on the official "Account & balance" page DOM (the `<section>` inside `[data-slot="settings.section"]`). If upstream rewrites that page, the embedded content may stop appearing; the fallback page is not shown while the official page exists.
- Within one settings session, switching sections preserves the embedded tab/time range; closing and reopening settings resets them to Overview / this month. The official page only exists when signed in to a DSH official account; signed-out users get the fallback page.
- OpenCode Go limits ($12/$30/$60) are reference values for the plans; the endpoint does not return limits. Check opencode.ai when plans change.
- Without a Console cookie the trend relies on local sampling: history only accumulates from the day the plugin starts recording (right after install, the current period only holds post-install data), and the percentage precision is limited to the official endpoint's whole percents (1%). Configure the cookie for the full period and daily request counts.
- The Console API (`/console/api/*`) is an **undocumented internal API** that only accepts a browser session cookie and may break when upstream changes it. The plugin parses fields by alias, falls back to sampled data on failure, and exposes only status codes and the CSV header row in diagnostics (never the cookie or business data). Expired cookies must be re-pasted.
- The official daily report buckets days in UTC while the plugin renders local dates, so a day may differ by one around midnight; the report also lags, so a just-finished request may only appear the next day.
- The Console cookie is an **account-level session credential** (more powerful than the API key): it stays in the local DSH credential store, is read only by the host, and is only sent to the three fixed whitelisted URLs. Never paste it into any third-party tool.
- Linear extrapolation is a rough "current pace" estimate that ignores weekday/weekend differences; a limit hit or a plan change will skew it.
- When bound to `0.0.0.0`, this plugin's routes are reachable on the LAN (the same pre-existing limitation as other local DSH plugins; the default `127.0.0.1` is unaffected).

---

## 🛠️ Development

```sh
npm run check  # host, client and aggregation syntax checks
npm test       # credential and OpenCode Go response regression tests

# Local install (development iteration):
dsh plugin --profile web add <absolute-path-to-plugin>
# After changing the source, reinstall (remove then add, or bump the version and add again), then restart dsh web
```

After modifying `client.js`, restart `dsh web` (the boot-graph hash is regenerated) and hard-refresh the page.

For the desktop app, quit it completely and reopen it. A local `link:` installation loads the updated source directly. Set `DSH_TEST_INSTALL_ROOT` to a DSH runtime directory containing `node_modules` to also test both loading orders of the built-in and plugin pages using the real slot registry, plus removal of the plugin page while retaining the built-in page. Without this variable, these two integration tests are skipped.

> [!NOTE]
> On Windows, `dsh plugin` forwards to pnpm through the shell, so the install path must not contain spaces; if your workspace path has spaces, create a junction (`mklink /J`) in a space-free path as an install gateway.

---

## 🤝 Contributing

Issues and pull requests are welcome: report problems with a screenshot and the plugin version at [Issues](https://github.com/Ycet/dsh-account-usage/issues); for improvements, follow Fork → branch → PR.

---

## 📄 License

This project is licensed under the [MIT](LICENSE) license.
