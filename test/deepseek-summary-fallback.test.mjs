import assert from "node:assert/strict";
import test from "node:test";

import { apply } from "../index.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("summary route still truncates platform wallet strings when official service is absent", async () => {
  const routes = new Map();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    jsonResponse({
      code: 0,
      msg: "",
      data: {
        biz_code: 0,
        biz_msg: "",
        biz_data: {
          normal_wallets: [{ currency: "CNY", balance: "4.589" }],
          bonus_wallets: [{ currency: "CNY", balance: "0" }],
          total_costs: [{ amount: "293.2" }]
        }
      }
    });
  const ctx = {
    credentials: { resolve: async () => ({ value: "test-platform-token" }) },
    effect: (register) => register(),
    webServer: {
      register({ path, handler }) {
        routes.set(path, handler);
        return () => {};
      }
    },
    logger: { warn() {} },
    get() {
      return undefined;
    }
  };
  try {
    apply(ctx);
    const handler = routes.get("/api/account-usage/deepseek-summary");
    let body;
    await handler(
      { url: "/api/account-usage/deepseek-summary" },
      { writeHead() {}, end(value) { body = JSON.parse(value); } }
    );
    assert.equal(body.ok, true);
    assert.equal(body.balanceSource, "platform");
    assert.equal(body.balance.toppedUpText, "¥4.58");
    assert.equal(body.balance.totalText, "¥4.58");
  } finally {
    globalThis.fetch = previousFetch;
  }
});
