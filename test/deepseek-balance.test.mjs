import assert from "node:assert/strict";
import test from "node:test";

import { formatBalanceText, parseSummary, sumDecimalStrings } from "../lib/aggregate.js";

test("formatBalanceText follows the official account page truncation rules", () => {
  assert.equal(formatBalanceText("4.589", "CNY"), "¥4.58");
  assert.equal(formatBalanceText("4.589", "USD"), "$4.58");
  assert.equal(formatBalanceText("0.009", "CNY"), "<¥0.01");
  assert.equal(formatBalanceText("1234.567", "CNY"), "¥1,234.56");
  assert.equal(formatBalanceText("0", "CNY"), "¥0.00");
  assert.equal(formatBalanceText("0.00", "CNY"), "¥0.00");
  assert.equal(formatBalanceText(null, "CNY"), "—");
  assert.equal(formatBalanceText("not-a-number", "CNY"), "—");
  // 官方负数分支使用 toFixed(2)（四舍五入），与正数的截断不同
  assert.equal(formatBalanceText("-0.005", "CNY"), "-¥0.01");
  assert.equal(formatBalanceText("-1.239", "CNY"), "-¥1.24");
});

test("sumDecimalStrings adds raw wallet strings without floating point error", () => {
  assert.equal(sumDecimalStrings(["4.58", "0"]), "4.58");
  assert.equal(sumDecimalStrings(["0.1", "0.2"]), "0.3");
  assert.equal(sumDecimalStrings(["1.005", "2.01"]), "3.015");
  assert.equal(sumDecimalStrings(["1", ""]), "1");
  assert.equal(sumDecimalStrings([null]), null);
  assert.equal(sumDecimalStrings(["-1", "2"]), null);
  assert.equal(sumDecimalStrings([]), null);
});

test("parseSummary keeps raw wallet strings for official-style formatting", () => {
  const summary = parseSummary({
    normal_wallets: [{ currency: "CNY", balance: "4.589" }],
    bonus_wallets: [{ currency: "CNY", balance: "0" }],
    total_costs: [{ amount: "293.2" }]
  });
  assert.equal(summary.toppedUpRaw, "4.589");
  assert.equal(summary.grantedRaw, "0");
  assert.equal(summary.toppedUp, 4.589);
  assert.equal(summary.granted, 0);
  assert.equal(summary.currency, "CNY");
  assert.equal(summary.cumulativeCost, 293.2);
  assert.equal(formatBalanceText(summary.toppedUpRaw, summary.currency), "¥4.58");

  const empty = parseSummary({});
  assert.equal(empty.toppedUpRaw, null);
  assert.equal(empty.grantedRaw, null);
  assert.equal(empty.toppedUp, null);
  assert.equal(empty.granted, null);
});
