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
    const ReactStub = {
      createElement: (...args) => ({ type: args[0], props: args[1], children: args.slice(2) }),
      Fragment: Symbol("Fragment")
    };
    return descriptor.factory((name) => {
      if (name === "react") return ReactStub;
      if (name === "react-dom/client") return { createRoot: () => ({ render() {}, unmount() {} }) };
      if (name === "react-dom") return { render() {}, unmountComponentAtNode: () => true };
      throw new Error("unexpected require: " + name);
    });
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

/**
 * 模拟 settings.section 槽位登记：外部可增删条目并触发订阅回调；
 * 插件注册兜底分区时只记录、不主动通知（真实运行时通知按微任务批处理，
 * 避免同步重入）。
 */
function createSectionHarness(initialEntries) {
  let entries = initialEntries.map((entry) => ({ options: { ...entry } }));
  const listeners = new Set();
  const registrations = [];
  const notify = () => {
    for (const listener of Array.from(listeners)) listener();
  };
  const service = {
    inject(_name, callback) {
      const cleanup = callback();
      return typeof cleanup === "function" ? cleanup : () => {};
    },
    subscribe(_name, listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    entries(name) {
      return name === "settings.section" ? entries : [];
    },
    register(spec) {
      const record = { spec, disposed: false };
      registrations.push(record);
      if (spec.name === "settings.section") {
        entries.push({ options: { id: spec.id, order: spec.order } });
      }
      return () => {
        if (record.disposed) return;
        record.disposed = true;
        if (spec.name === "settings.section") {
          entries = entries.filter((entry) => entry.options.id !== spec.id);
          notify();
        }
      };
    },
    addEntry(id, order) {
      entries.push({ options: { id, order } });
      notify();
    },
    removeEntry(id) {
      entries = entries.filter((entry) => entry.options.id !== id);
      notify();
    },
    sectionRegistrations() {
      return registrations.filter((record) => record.spec.name === "settings.section");
    }
  };
  return service;
}

async function applyWithSections(client, slots) {
  client.apply({
    remote: undefined,
    effect(callback) {
      callback();
    },
    locale: {
      register() {},
      bind() {
        return (key) => key;
      },
      subscribe() {
        return () => {};
      }
    },
    slots
  });
  // 让真实运行时可能存在的微任务批处理完成
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("official account section present: no standalone account-usage section is registered", async () => {
  const client = await loadClientBundle();
  const slots = createSectionHarness([
    { id: "account", order: -10 },
    { id: "general", order: 0 }
  ]);
  await applyWithSections(client, slots);
  assert.equal(slots.sectionRegistrations().length, 0);
});

test("official account section absent: fallback account-usage section is registered", async () => {
  const client = await loadClientBundle();
  const slots = createSectionHarness([{ id: "general", order: 0 }]);
  await applyWithSections(client, slots);
  const registrations = slots.sectionRegistrations();
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0].spec.id, "account-usage");
  assert.equal(registrations[0].spec.order, 45);
});

test("fallback section follows official account registration and removal", async () => {
  const client = await loadClientBundle();
  const slots = createSectionHarness([{ id: "general", order: 0 }]);
  await applyWithSections(client, slots);
  const first = slots.sectionRegistrations()[0];
  assert.ok(first);

  slots.addEntry("account", -10);
  assert.equal(first.disposed, true, "fallback should unregister when official page appears");
  assert.equal(slots.sectionRegistrations().filter((record) => !record.disposed).length, 0);

  slots.removeEntry("account");
  const active = slots.sectionRegistrations().filter((record) => !record.disposed);
  assert.equal(active.length, 1, "fallback should register again when official page disappears");
  assert.equal(active[0].spec.id, "account-usage");
});
