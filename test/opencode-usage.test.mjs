import assert from "node:assert/strict";
import test from "node:test";
import { apply } from "../index.js";

function opencodeRoute() {
  let handler;
  const ctx = {
    credentials: { resolve: async () => ({ value: "test-go-key" }) },
    effect: (register) => register(),
    webServer: {
      register({ path, handler: routeHandler }) {
        if (path === "/api/account-usage/opencode") handler = routeHandler;
        return () => {};
      }
    },
    logger: { warn() {} }
  };
  apply(ctx);
  assert.equal(typeof handler, "function");
  return handler;
}

async function callRoute(handler) {
  let status;
  let body;
  await handler({}, {
    writeHead(value) { status = value; },
    end(value) { body = JSON.parse(value); }
  });
  assert.equal(status, 200);
  return body;
}

test("OpenCode Go subscription 403 is explained instead of shown as a generic HTTP error", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, "Bearer test-go-key");
    return new Response(JSON.stringify({
      type: "error",
      error: { type: "EntitlementError", message: "OpenCode Go subscription required." }
    }), { status: 403, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await callRoute(opencodeRoute());
    assert.equal(result.ok, false);
    assert.equal(result.code, "go-subscription-required");
    assert.equal(result.keySource, "credentials");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("other 403 errors stay distinct from a missing Go subscription", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    type: "error",
    error: { type: "ForbiddenError", message: "Access denied." }
  }), { status: 403, headers: { "Content-Type": "application/json" } });
  try {
    const result = await callRoute(opencodeRoute());
    assert.equal(result.ok, false);
    assert.equal(result.code, "http-403");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("successful OpenCode Go usage still returns all three windows", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ usage: {
    rolling: { status: "ok", percent: 5, resetsAt: "2026-09-29T12:00:00.000Z" },
    weekly: { status: "ok", percent: 46, resetsAt: "2026-10-05T00:00:00.000Z" },
    monthly: { status: "ok", percent: 41, resetsAt: "2026-10-08T00:00:00.000Z" }
  } }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    const result = await callRoute(opencodeRoute());
    assert.equal(result.ok, true);
    assert.equal(result.keySource, "credentials");
    assert.deepEqual(Object.keys(result.usage), ["rolling", "weekly", "monthly"]);
    assert.equal(result.usage.rolling.percent, 5);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
