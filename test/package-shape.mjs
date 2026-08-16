/**
 * dsh-account-usage — 包声明形状测试。
 *
 * DSH 客户端模块加载器对 dsh.client 声明是 fail-loud 的（畸形声明 = 整包
 * FAILED fiber = dsh 启动失败），bundle 补丁层同样在启动时读取。本测试
 * 校验包声明与清单文件，防止未来改动触发加载器/启动失败。
 *
 * 运行：node test/package-shape.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

test("package name and version", () => {
  assert.equal(pkg.name, "dsh-account-usage");
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});

test("dsh.client declaration is loader-safe", () => {
  assert.equal(pkg.dsh?.client?.platform, "web");
  assert.ok(Array.isArray(pkg.dsh.client.inject), "inject must be a string array");
  for (const item of pkg.dsh.client.inject) assert.equal(typeof item, "string");
});

test("exports[./client] and bundle patch files exist", () => {
  const clientRel = pkg.exports?.["./client"]?.default ?? pkg.exports?.["./client"];
  assert.ok(typeof clientRel === "string" && existsSync(join(root, clientRel)), "exports ./client file exists");
  const patchRel = pkg.dsh?.bundle?.patch;
  assert.ok(typeof patchRel === "string" && existsSync(join(root, patchRel)), "dsh.bundle.patch file exists");
});

test("main entry and files list all exist", () => {
  assert.ok(existsSync(join(root, pkg.main)), "main entry exists");
  for (const f of pkg.files ?? []) {
    assert.ok(existsSync(join(root, f)), `files entry exists: ${f}`);
  }
});

test("cordis.patch.yml contains the loader insert row", () => {
  const patch = readFileSync(join(root, "cordis.patch.yml"), "utf8");
  assert.ok(patch.includes("- insert:"), "has an insert block");
  assert.ok(patch.includes("id: account-usage"), "has the row id");
  assert.ok(patch.includes("name: dsh-account-usage"), "has the package name");
});

test("no prepare script (git-hosted installs need no allowBuilds)", () => {
  assert.equal(pkg.scripts?.prepare, undefined);
});
