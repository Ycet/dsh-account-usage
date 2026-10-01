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
    url.searchParams.set("test", String(Date.now()));
    await import(url.href);
    assert.ok(descriptor, "client bundle should register with ModuleLoader");
    return descriptor.factory((name) => {
      assert.equal(name, "react");
      return { createElement: (...args) => ({ type: args[0], props: args[1], children: args.slice(2) }) };
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

function accountRegistration(client, remote, runtimeSlots) {
  const registrations = [];
  client.apply({
    remote,
    effect(callback) {
      return callback();
    },
    get(name) {
      assert.fail(`account client should not request legacy service: ${name}`);
    },
    locale: {
      register() {},
      bind() {
        return (key) => key;
      }
    },
    slots: {
      inject(name, callback) {
        return runtimeSlots ? runtimeSlots.inject(name, callback) : callback();
      },
      register(spec, component) {
        registrations.push(spec);
        return runtimeSlots ? runtimeSlots.register(spec, component) : () => {};
      }
    }
  });
  const registration = registrations.find((item) => item.name === "settings.section");
  assert.ok(registration, "account settings section should register");
  return registration;
}

test("rc.1 client credentials use remote.credentials instead of ConnectionHandle.api", async () => {
  const client = await loadClientBundle();
  const calls = [];
  const remote = {
    credentials: {
      async describe(refs) {
        calls.push(["describe", refs]);
        return { ok: true, value: { DEEPSEEK_PLATFORM_TOKEN: { configured: true, source: "stored" } } };
      },
      async set(ref, value) {
        calls.push(["set", ref, value]);
        return { ok: true, value: undefined };
      },
      async unset(ref) {
        calls.push(["unset", ref]);
        return { ok: true, value: undefined };
      }
    }
  };

  assert.deepEqual(client.inject, ["slots", "locale", "remote", "remote.credentials"]);
  const registration = accountRegistration(client, remote);
  const credApi = registration.inject().credApi;
  assert.ok(credApi, "rc.1 remote credentials should be injected into the account page");

  assert.deepEqual(await credApi.describe({ refs: ["DEEPSEEK_PLATFORM_TOKEN"] }), {
    result: {
      ok: true,
      value: {
        credentials: {
          DEEPSEEK_PLATFORM_TOKEN: { configured: true, source: "stored" }
        }
      }
    }
  });
  assert.deepEqual(await credApi.set({ ref: "DEEPSEEK_PLATFORM_TOKEN", value: "<REDACTED>" }), {
    result: { ok: true, value: undefined }
  });
  assert.deepEqual(await credApi.unset({ ref: "DEEPSEEK_PLATFORM_TOKEN" }), {
    result: { ok: true, value: undefined }
  });
  assert.deepEqual(calls, [
    ["describe", ["DEEPSEEK_PLATFORM_TOKEN"]],
    ["set", "DEEPSEEK_PLATFORM_TOKEN", "<REDACTED>"],
    ["unset", "DEEPSEEK_PLATFORM_TOKEN"]
  ]);
});

test("credential bridge remains unavailable when rc.1 remote.credentials is absent", async () => {
  const client = await loadClientBundle();
  const registration = accountRegistration(client, {});
  assert.equal(registration.inject().credApi, null);
});

// 使用真实桌面槽位注册器，验证两种加载顺序及卸载，不用宽松 mock 掩盖 ID 冲突。
for (const officialFirst of [true, false]) test(`desktop account sections coexist (officialFirst=${officialFirst})`, {
  skip: !process.env.DSH_TEST_INSTALL_ROOT
}, async (t) => {
  const base = process.env.DSH_TEST_INSTALL_ROOT + "/node_modules/@deepseek-ai/";
  const { SlotCore } = await import(base + "dsh-client-ui-slots/lib/index.js");
  const core = new SlotCore();
  const unregisterRoot = core.register({
    name: "root",
    children: { "settings.section": { kind: "list", scope: "root" } }
  }, () => null);
  t.after(unregisterRoot);

  // DSH 0.2.0-rc.2 官方账户页的注册契约：account，默认优先级，order=-10。
  const OfficialAccount = () => null;
  const registerOfficial = () => core.register({
    name: "settings.section", id: "account", order: -10, locale: "settings.account"
  }, OfficialAccount);
  if (officialFirst) t.after(registerOfficial());

  const disposers = [];
  const client = await loadClientBundle();
  const registration = accountRegistration(client, {}, {
    inject(name, callback) {
      assert.equal(name, "settings.section");
      const dispose = callback();
      disposers.push(dispose);
      t.after(dispose);
      return dispose;
    },
    register(spec, component) {
      return core.register(spec, component);
    }
  });
  if (!officialFirst) t.after(registerOfficial());

  assert.deepEqual(core.entriesOfSlot("settings.section").map((entry) => entry.options.id), ["account", "account-usage"]);
  assert.equal(core.entriesOfSlot("settings.section")[0].component, OfficialAccount);
  assert.equal(registration.id, "account-usage");
  assert.equal(registration.priority ?? 0, 0, "both pages should coexist at the default priority");

  for (const dispose of disposers) dispose();
  assert.deepEqual(core.entriesOfSlot("settings.section").map((entry) => entry.options.id), ["account"]);
  assert.equal(core.entriesOfSlot("settings.section")[0].component, OfficialAccount);
});
