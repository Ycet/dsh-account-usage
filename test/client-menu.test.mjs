import assert from "node:assert/strict";
import test from "node:test";

async function loadClientBundle() {
  const previousWindow = globalThis.window;
  let descriptor;
  globalThis.window = {
    __ModuleLoader__: {
      load(next) {
        descriptor = next;
      }
    }
  };
  try {
    const url = new URL("../client.js", import.meta.url);
    url.searchParams.set("test", String(Date.now()) + Math.random());
    await import(url.href);
    assert.ok(descriptor, "client bundle should register with ModuleLoader");
    return descriptor.factory(() => ({
      createElement: (...args) => ({ type: args[0], props: args[1], children: args.slice(2) }),
      Fragment: Symbol("Fragment")
    }));
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

const t = (key) =>
  ({
    menuBalance: "余额：",
    menuOpenAccount: "打开账户设置",
    menuBalanceTitle: "DeepSeek 平台余额",
    toolsSearch: "网页搜索",
    toolsFetch: "网页抓取"
  })[key] ?? key;

test("balanceTextOf sums topped-up and granted balances", async () => {
  const client = await loadClientBundle();
  assert.equal(
    client.balanceTextOf({ ok: true, balance: { toppedUp: 3.29125, granted: 0, currency: "CNY" } }, t),
    "余额：¥3.29"
  );
  assert.equal(
    client.balanceTextOf({ ok: true, balance: { toppedUp: 2, granted: 1, currency: "CNY" } }, t),
    "余额：¥3.00"
  );
  assert.equal(
    client.balanceTextOf({ ok: true, balance: { toppedUp: null, granted: 0.5, currency: "USD" } }, t),
    "余额：$0.50"
  );
  assert.equal(client.balanceTextOf({ ok: true, balance: { toppedUp: null, granted: null } }, t), "余额：—");
  assert.equal(client.balanceTextOf({ ok: false, balance: { toppedUp: 9 } }, t), "余额：—");
  assert.equal(client.balanceTextOf(null, t), "余额：—");
});

test("toolLabelOf localizes known tools and preserves unknown ids", async () => {
  const client = await loadClientBundle();
  assert.equal(client.toolLabelOf("tool-search", t), "网页搜索");
  assert.equal(client.toolLabelOf("tool-fetch", t), "网页抓取");
  assert.equal(client.toolLabelOf("tool-other", t), "tool-other");
});

test("apply still registers the account section without a DOM", async () => {
  const client = await loadClientBundle();
  const registrations = [];
  const injectedSlots = [];
  client.apply({
    remote: undefined,
    effect(callback) {
      callback();
    },
    locale: {
      register() {},
      bind() {
        return (key) => key;
      }
    },
    slots: {
      inject(name, callback) {
        injectedSlots.push(name);
        return callback();
      },
      register(spec) {
        registrations.push(spec);
        return () => {};
      }
    }
  });
  assert.ok(injectedSlots.includes("settings.section"));
  const section = registrations.find((registration) => registration.name === "settings.section");
  assert.ok(section);
  assert.equal(section.id, "account-usage");
  assert.equal(section.order, 45);
});
