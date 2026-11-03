import assert from "node:assert/strict";
import test from "node:test";
import { apply } from "../index.js";

const TZ = 28800;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function envelope(bizData, bizCode = 0, bizMsg = "") {
  return { code: 0, msg: "", data: { biz_code: bizCode, biz_msg: bizMsg, biz_data: bizData } };
}

function stubMonthlyModelData(url, enabled = true) {
  const year = Number(url.searchParams.get("year"));
  const month = String(Number(url.searchParams.get("month"))).padStart(2, "0");
  const date = `${year}-${month}-03`;
  return {
    amount: enabled
      ? envelope({
          days: [
            {
              date,
              data: [
                {
                  model: "deepseek-flash",
                  usage: [
                    { type: "PROMPT_CACHE_MISS_TOKEN", amount: "46" },
                    { type: "RESPONSE_TOKEN", amount: "295" },
                    { type: "REQUEST", amount: "1" }
                  ]
                }
              ]
            }
          ]
        })
      : envelope({ days: [] }),
    cost: enabled
      ? envelope({
          days: [
            {
              date: "2020-01-03",
              data: [{ model: "deepseek-flash", usage: [{ type: "PROMPT_CACHE_MISS_TOKEN", cost: "0.002452" }] }]
            }
          ]
        })
      : envelope({ days: [] })
  };
}

/** 构造工具数据：以请求里的 start 为第一天，避免测试依赖真实日期。 */
function toolAmountEnvelope(url, { fail = false, bizError = false } = {}) {
  if (fail) return null;
  if (bizError) return envelope(null, 1, "INVALID_PARAM");
  const start = Number(url.searchParams.get("start"));
  const bucket = (dayOffset) => start + dayOffset * 86400;
  return envelope({
    functions: ["tool-search", "tool-fetch"],
    function_series: [
      {
        model: "tool-fetch",
        buckets: [
          { time: bucket(0), usage: { FUNCTION_CALL: 0 } },
          { time: bucket(1), usage: { FUNCTION_CALL: 0 } },
          { time: bucket(2), usage: { FUNCTION_CALL: 19 } }
        ]
      },
      {
        model: "tool-search",
        buckets: [
          { time: bucket(0), usage: { FUNCTION_CALL: 0 } },
          { time: bucket(1), usage: { FUNCTION_CALL: 0 } },
          { time: bucket(2), usage: { FUNCTION_CALL: 249 } }
        ]
      }
    ]
  });
}

function toolCostEnvelope(url, { fail = false } = {}) {
  if (fail) return null;
  const start = Number(url.searchParams.get("start"));
  const bucket = (dayOffset) => start + dayOffset * 86400;
  return envelope({
    functions: ["tool-search", "tool-fetch"],
    data: [
      {
        currency: "CNY",
        function_series: [
          {
            model: "tool-fetch",
            buckets: [
              { time: bucket(0), cost: "0" },
              { time: bucket(1), cost: "0" },
              { time: bucket(2), cost: "0.0950000000000000" }
            ]
          },
          {
            model: "tool-search",
            buckets: [
              { time: bucket(0), cost: "0" },
              { time: bucket(1), cost: "0" },
              { time: bucket(2), cost: "1.2450000000000000" }
            ]
          }
        ]
      }
    ]
  });
}

function makeFetch({ toolAmountFail = false, toolCostFail = false, modelBizError = false } = {}) {
  const calls = [];
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const path = url.pathname;
    if (path.endsWith("/usage/amount")) {
      if (modelBizError) return jsonResponse(envelope(null, 1, "INVALID_PARAM"));
      return jsonResponse(stubMonthlyModelData(url).amount);
    }
    if (path.endsWith("/usage/cost")) return jsonResponse(stubMonthlyModelData(url).cost);
    if (path.endsWith("/usage/by_api_key/amount")) {
      const body = toolAmountEnvelope(url, { fail: toolAmountFail });
      if (body === null) return jsonResponse({ ok: false }, 500);
      return jsonResponse(body);
    }
    if (path.endsWith("/usage/by_api_key/cost")) {
      const body = toolCostEnvelope(url, { fail: toolCostFail });
      if (body === null) return jsonResponse({ ok: false }, 500);
      return jsonResponse(body);
    }
    return jsonResponse({ ok: false }, 404);
  };
  return { fetchImpl, calls };
}

async function callUsageRoute(fetchImpl, query) {
  const previous = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  const routes = new Map();
  const warnings = [];
  const ctx = {
    credentials: { resolve: async () => ({ value: "test-platform-token" }) },
    effect: (register) => register(),
    webServer: {
      register({ path, handler }) {
        routes.set(path, handler);
        return () => {};
      }
    },
    logger: {
      warn(...args) {
        warnings.push(args.map(String).join(" "));
      }
    }
  };
  try {
    apply(ctx);
    const handler = routes.get("/api/account-usage/deepseek-usage");
    assert.equal(typeof handler, "function");
    let status;
    let body;
    await handler(
      { url: `/api/account-usage/deepseek-usage?${query}` },
      {
        writeHead(value) {
          status = value;
        },
        end(value) {
          body = JSON.parse(value);
        }
      }
    );
    assert.equal(status, 200);
    return { body, warnings, calls: [] };
  } finally {
    globalThis.fetch = previous;
  }
}

test("usage route returns web search/fetch daily calls and costs", async () => {
  const { fetchImpl } = makeFetch();
  const { body } = await callUsageRoute(fetchImpl, "from=2020-01-01&to=2020-01-03");
  assert.equal(body.ok, true);
  assert.equal(body.totals.requests, 1);
  assert.equal(body.tools.ok, true);
  assert.equal(body.tools.currency, "CNY");
  assert.equal(body.tools.costAvailable, true);
  assert.equal(body.tools.range.windows, 1);
  assert.deepEqual(body.tools.functions.map((fn) => fn.id), ["tool-search", "tool-fetch"]);
  assert.equal(body.tools.functions[0].calls, 249);
  assert.equal(body.tools.functions[0].cost, 1.245);
  assert.equal(body.tools.functions[0].days.length, 3);
  assert.equal(body.tools.functions[1].calls, 19);
  assert.equal(body.tools.functions[1].cost, 0.095);
  assert.deepEqual(body.tools.totals, { calls: 268, cost: 1.34 });
});

test("usage route splits ranges longer than 31 days into windows", async () => {
  const { fetchImpl, calls } = makeFetch();
  const { body } = await callUsageRoute(fetchImpl, "from=2020-02-01&to=2020-04-05");
  assert.equal(body.tools.ok, true);
  assert.equal(body.tools.range.windows, 3);
  const amountCalls = calls.filter((url) => url.pathname.endsWith("/usage/by_api_key/amount"));
  assert.equal(amountCalls.length, 3);
  for (const url of amountCalls) {
    const days = (Number(url.searchParams.get("end")) - Number(url.searchParams.get("start"))) / 86400;
    assert.ok(days >= 1 && days <= 31, `window has ${days} days`);
  }
});

test("tool amount failure degrades only the tools module", async () => {
  const { fetchImpl } = makeFetch({ toolAmountFail: true });
  const { body } = await callUsageRoute(fetchImpl, "from=2020-05-01&to=2020-05-03");
  assert.equal(body.ok, true);
  assert.equal(body.tools.ok, false);
  assert.equal(body.tools.code, "http-500");
  assert.equal(body.days.length, 1);
  assert.equal(body.models.length, 1);
});

test("tool cost failure keeps call counts and marks costs unavailable", async () => {
  const { fetchImpl } = makeFetch({ toolCostFail: true });
  const { body, warnings } = await callUsageRoute(fetchImpl, "from=2020-06-01&to=2020-06-03");
  assert.equal(body.tools.ok, true);
  assert.equal(body.tools.costAvailable, false);
  assert.equal(body.tools.functions[0].calls, 249);
  assert.equal(body.tools.functions[0].cost, null);
  assert.equal(body.tools.totals.cost, null);
  assert.ok(warnings.some((line) => line.includes("工具费用查询降级")));
});

test("platform envelope business errors are not treated as success", async () => {
  const { fetchImpl } = makeFetch({ modelBizError: true });
  const { body } = await callUsageRoute(fetchImpl, "from=2020-07-01&to=2020-07-03");
  assert.equal(body.ok, false);
  assert.equal(body.code, "biz-error");
  assert.match(body.message, /INVALID_PARAM/);
});
