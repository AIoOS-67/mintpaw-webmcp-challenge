import test from "node:test";
import assert from "node:assert/strict";
import fixtures from "./fixtures.json" with { type: "json" };
import { checkHardwareCompatibility, checkPetCompatibility, sanitizePublicPayload, sanitizePublicResult } from "../src/compatibility.js";
import { registerMintPawTools } from "../src/webmcp-tools.js";

test("pet mismatch blocks the purchase path", () => {
  const result = checkPetCompatibility(fixtures.petMismatch);
  assert.equal(result.decision, "FAIL");
  assert.equal(result.status, "incompatible_blocked");
  assert.equal(result.nextAction, "BLOCK_PURCHASE");
  assert.match(result.reasons.join(" "), /cats|species|weight|size/i);
});

test("hardware and network mismatch blocks the purchase path", () => {
  const result = checkHardwareCompatibility(fixtures.hardwareMismatch);
  assert.equal(result.decision, "FAIL");
  assert.equal(result.status, "incompatible_blocked");
  assert.equal(result.nextAction, "BLOCK_PURCHASE");
  assert.equal(result.error, undefined);
});

test("unknown network enters needs verification", () => {
  const result = checkHardwareCompatibility(fixtures.hardwareUnknown);
  assert.equal(result.decision, "BLOCKED_DATA");
  assert.equal(result.status, "needs_verification");
  assert.equal(result.nextAction, "BLOCK_PURCHASE");
});

test("compatible inputs still require explicit user confirmation", () => {
  const pet = checkPetCompatibility({ productId: fixtures.productId, petProfile: { species: "cat", size: "medium", weightKg: 5, useContext: "indoor" } });
  const hardware = checkHardwareCompatibility({ productId: fixtures.productId, hardwareProfile: { region: "US", network: "2.4GHz", voltage: "120V", hasRequiredExtras: true } });
  assert.equal(pet.decision, "PASS");
  assert.equal(hardware.decision, "PASS");
  assert.equal(pet.nextAction, "ASK_EXPLICIT_USER_CONFIRMATION");
  assert.equal(hardware.nextAction, "ASK_EXPLICIT_USER_CONFIRMATION");
});

test("invalid input returns a stable English error code", () => {
  const result = checkPetCompatibility({ productId: fixtures.productId, petProfile: { species: "rabbit" } });
  assert.equal(result.error.code, "UNSUPPORTED_VALUE");
  assert.match(result.error.message, /species/i);
});

test("public payload filtering removes internal evidence, URLs, and non-English text", () => {
  const evidenceKey = ["evid", "ence"].join("");
  const sourceKey = ["sou", "rce"].join("");
  const supplierKey = ["supplier", "_", "questions"].join("");
  const filtered = sanitizePublicPayload({
    status: "inferred_tbc",
    value: "2.4GHz",
    [evidenceKey]: "internal note",
    [sourceKey]: "https://example.invalid/item",
    [supplierKey]: "internal question",
    localized: String.fromCodePoint(0x4e2d, 0x6587),
  });
  assert.deepEqual(filtered, { status: "inferred_tbc", value: "2.4GHz", localized: "Verification required." });
  const result = sanitizePublicResult({ dataQuality: "inferred_tbc", reasons: [String.fromCodePoint(0x539f, 0x56e0)], [sourceKey + "_url"]: "https://example.invalid" });
  assert.equal(result.dataQuality, "inferred_tbc");
  assert.deepEqual(result.reasons, ["Verification required."]);
  assert.equal(`${sourceKey}_url` in result, false);
});

test("registration stays read-only and exposes exactly two tools", async () => {
  const calls = [];
  const fakeDocument = { modelContext: { registerTool: async (tool) => calls.push(tool) } };
  const result = await registerMintPawTools(fakeDocument);
  assert.equal(result.registered, true);
  assert.deepEqual(result.tools, ["check_pet_compatibility", "check_hardware_compatibility"]);
  assert.equal(calls.length, 2);
  assert.equal(calls.every((tool) => tool.annotations.readOnlyHint === true), true);
});
