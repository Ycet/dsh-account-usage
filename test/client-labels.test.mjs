import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// 0.6.2 起 opencode go 三张额度卡只保留窗口名，不再展示固定限额参考。
test("opencode quota cards no longer carry fixed reference limits", () => {
  const source = readFileSync(new URL("../client.js", import.meta.url), "utf8");
  assert.equal(source.includes("OPENCODE_LIMITS"), false);
  assert.equal(source.includes("Limit (ref.)"), false);
  assert.equal(source.includes("限额参考"), false);
});
