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

function accountRegistration(client, remote) {
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
      inject(_name, callback) {
        return callback();
      },
      register(spec) {
        registrations.push(spec);
        return () => {};
      }
    }
  });
  const registration = registrations.find((item) => item.name === "settings.section" && item.id === "account");
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
