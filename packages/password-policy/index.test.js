const assert = require("node:assert/strict");
const { test } = require("node:test");
const { passwordPolicyError, passwordRules } = require("./index");

test("recognizes Unicode categories and does not count spaces as symbols", () => {
  assert.ok(passwordRules.every(({ validate }) => validate("Ñandú١#x")));
  assert.ok(passwordPolicyError("Ñandú١ x"));
});

test("accepts 64 ASCII characters and rejects truncated bcrypt inputs", () => {
  assert.equal(passwordPolicyError("Aa1!" + "x".repeat(60)), undefined);
  assert.equal(passwordPolicyError("Aa1!" + "á".repeat(34)), undefined);
  assert.match(passwordPolicyError("Aa1!" + "á".repeat(35)), /72 bytes/);
});
