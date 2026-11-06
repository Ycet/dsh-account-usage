/**
 * 凭证引用名语法的回归测试。
 *
 * 背景：本插件原先从 `@deepseek-ai/dsh-credentials` 引入 `credentialRef`，等于把该包
 * 及其自带的 `@deepseek-ai/cordis` 一起装进插件目录，在 DSH 0.2.2 运行时里形成第二份
 * cordis 模块实例。现在内联同一个纯函数（语法与官方 `REF_PATTERN` 一致），
 * 这里锁定语法，避免以后与官方口径悄悄分叉。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { credentialRef } from "../index.js";

test("credentialRef 接受合法环境变量名并原样返回", () => {
  assert.equal(credentialRef("DEEPSEEK_PLATFORM_TOKEN"), "DEEPSEEK_PLATFORM_TOKEN");
  assert.equal(credentialRef("OPENCODE_GO_API_KEY"), "OPENCODE_GO_API_KEY");
  assert.equal(credentialRef("_private"), "_private");
  assert.equal(credentialRef("A1"), "A1");
});

test("credentialRef 拒绝不符合官方 REF_PATTERN 的输入", () => {
  // 与官方一致：必须是 POSIX 标识符，不允许空串、数字开头、连字符、斜杠、空白
  for (const bad of ["", "1TOKEN", "MY-KEY", "A/B", "A B", "a.b", undefined, null, 42]) {
    assert.throws(() => credentialRef(bad), TypeError, `应当拒绝 ${String(bad)}`);
  }
});
