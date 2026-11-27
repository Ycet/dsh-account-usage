import assert from "node:assert/strict";
import test from "node:test";

import { apply } from "../index.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function envelope(bizData) {
  return { code: 0, msg: "", data: { biz_code: 0, biz_msg: "", biz_data: bizData } };
}

test("summary route prefers the official DSH balance snapshot", async () => {
  const routes = new Map();
  const warnings = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    assert.equal(path, "/api/v0/users/get_user_summary");
    return jsonResponse(
      envelope({
        normal_wallets: [{ currency: "CNY", balance: "4.589" }],
        bonus_wallets: [{ currency: "CNY", balance: "0" }],
        total_costs: [{ amount: "293.2" }]
      })
    );
  };
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
    },
    get(name) {
      if (name !== "deepseekAccount") return undefined;
      return {
        getBalance: async () => ({
          status: "ready",
          value: [{ currency: "CNY", balance: "4.589" }],
          bonusWallets: [{ currency: "CNY", balance: "0" }]
        })
      };
    }
  };
  try {
    apply(ctx);
    const handler = routes.get("/api/account-usage/deepseek-summary");
    assert.equal(typeof handler, "function");
    let status;
    let body;
    await handler(
      { url: "/api/account-usage/deepseek-summary" },
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
    assert.equal(body.ok, true);
    assert.equal(body.balanceSource, "official");
    assert.equal(body.balance.toppedUpText, "¥4.58");
    assert.equal(body.balance.grantedText, "¥0.00");
    assert.equal(body.balance.totalText, "¥4.58");
    assert.equal(body.cumulativeCost, 293.2);
    assert.deepEqual(warnings, []);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
