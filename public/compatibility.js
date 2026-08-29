const product = {
  petProfile: { species: ["cat"], weightKgRange: [2, 8], sizeRange: ["small", "medium"] },
  hardware: { networkBands: ["2.4GHz"], regions: ["US", "CA"], voltage: "120V" },
};
const DATA_STATUS = new Set(["confirmed", "platform_listed", "inferred_tbc", "pending"]);
const FORBIDDEN_KEY_PARTS = ["evidence", "source", ["supplier", "questions"].join("_"), "raw", "metafield", "url", "json"];
const SAFE_TEXT_FALLBACK = "Verification required.";
const isForbiddenKey = (key) => FORBIDDEN_KEY_PARTS.some((part) => String(key).toLowerCase().includes(part));
const isSafeEnglishText = (value) => typeof value === "string" && /^[\x20-\x7E]*$/u.test(value) && !/https?:\/\//iu.test(value);
function sanitizeValue(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return undefined;
  if (typeof value === "string") return isSafeEnglishText(value) ? value : SAFE_TEXT_FALLBACK;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value === "object") {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (isForbiddenKey(key)) continue;
      const safeChild = sanitizeValue(child, depth + 1);
      if (safeChild !== undefined) output[key] = safeChild;
    }
    return output;
  }
  return undefined;
}
const base = (tool, requestId) => ({ tool, version: "0.1.0", productId: "mintpaw-litter-box-demo", requestId: /^[A-Za-z0-9._-]{1,128}$/u.test(requestId || "") ? requestId : "anonymous-request", dataQuality: "confirmed", checkedAt: new Date().toISOString() });
const safeResult = (value) => {
  const safe = sanitizeValue(value) || {};
  const output = {};
  for (const key of ["tool", "version", "productId", "requestId", "dataQuality", "checkedAt", "decision", "status", "error", "reasons", "nextAction"]) if (safe[key] !== undefined) output[key] = safe[key];
  if (!DATA_STATUS.has(output.dataQuality)) output.dataQuality = "pending";
  if (!Array.isArray(output.reasons) || !output.reasons.length) output.reasons = [SAFE_TEXT_FALLBACK];
  return output;
};
const blocked = (tool, requestId, message, code = "MISSING_REQUIRED_INPUT") => safeResult({ ...base(tool, requestId), decision: "BLOCKED_DATA", status: "needs_verification", error: { code, message }, reasons: [message], nextAction: "COLLECT_MISSING_CONSTRAINT" });
export function checkPetCompatibility(input = {}) {
  const profile = input.petProfile;
  if (!profile || typeof profile !== "object") return blocked("check_pet_compatibility", input.requestId, "petProfile must be an object.", "INVALID_INPUT");
  if (!["cat", "dog"].includes(profile.species)) return blocked("check_pet_compatibility", input.requestId, "species must be cat or dog.", "UNSUPPORTED_VALUE");
  const reasons = [];
  if (!product.petProfile.species.includes(profile.species)) reasons.push("This product is listed for cats, not the stated pet species.");
  if (profile.size && !product.petProfile.sizeRange.includes(profile.size)) reasons.push("The stated pet size is outside the listed supported size range.");
  if (profile.weightKg !== undefined && (profile.weightKg < 2 || profile.weightKg > 8)) reasons.push("The stated pet weight is outside the listed supported weight range.");
  if (reasons.length) return safeResult({ ...base("check_pet_compatibility", input.requestId), decision: "FAIL", status: "incompatible_blocked", reasons, nextAction: "BLOCK_PURCHASE" });
  return safeResult({ ...base("check_pet_compatibility", input.requestId), decision: "PASS", status: "compatible_pending_confirmation", reasons: ["The stated pet profile matches the listed product range."], nextAction: "ASK_EXPLICIT_USER_CONFIRMATION" });
}
export function checkHardwareCompatibility(input = {}) {
  const hardware = input.hardwareProfile;
  if (!hardware || typeof hardware !== "object") return blocked("check_hardware_compatibility", input.requestId, "hardwareProfile must be an object.", "INVALID_INPUT");
  if (!hardware.region) return blocked("check_hardware_compatibility", input.requestId, "region is required for a hardware compatibility check.");
  const reasons = [];
  if (!product.hardware.regions.includes(hardware.region.toUpperCase())) reasons.push("The product is not listed for the stated region.");
  if (hardware.network === "unknown") reasons.push("Network compatibility is not confirmed for the stated environment.");
  else if (hardware.network && !product.hardware.networkBands.includes(hardware.network) && hardware.network !== "both") reasons.push("The product network requirement does not match the stated network.");
  if (hardware.voltage && hardware.voltage !== product.hardware.voltage) reasons.push("The stated household voltage does not match the listed product voltage.");
  if (reasons.length) {
    const needsVerification = reasons.some((reason) => reason.includes("not confirmed"));
    return safeResult({ ...base("check_hardware_compatibility", input.requestId), decision: needsVerification ? "BLOCKED_DATA" : "FAIL", status: needsVerification ? "needs_verification" : "incompatible_blocked", reasons, nextAction: "BLOCK_PURCHASE" });
  }
  return safeResult({ ...base("check_hardware_compatibility", input.requestId), decision: "PASS", status: "compatible_pending_confirmation", reasons: ["The stated region, network, and voltage match the listed product requirements."], nextAction: "ASK_EXPLICIT_USER_CONFIRMATION" });
}
export const schemas = {
  pet: { type: "object", additionalProperties: false, properties: { productId: { type: "string", description: "The product identifier shown by the current page." }, petProfile: { type: "object", additionalProperties: false, properties: { species: { type: "string", enum: ["cat", "dog"] }, size: { type: "string", enum: ["small", "medium", "large"] }, weightKg: { type: "number", minimum: 0 }, useContext: { type: "string", enum: ["indoor", "outdoor", "indoor_alone"] } }, required: ["species"] }, requestId: { type: "string", description: "An optional non-identifying request label." } }, required: ["productId", "petProfile"] },
  hardware: { type: "object", additionalProperties: false, properties: { productId: { type: "string", description: "The product identifier shown by the current page." }, hardwareProfile: { type: "object", additionalProperties: false, properties: { region: { type: "string", description: "The shopper's country or region code." }, network: { type: "string", enum: ["2.4GHz", "5GHz", "both", "unknown"] }, voltage: { type: "string", description: "The household voltage available to the shopper." }, hasRequiredExtras: { type: "boolean" } }, required: ["region"] }, requestId: { type: "string", description: "An optional non-identifying request label." } }, required: ["productId", "hardwareProfile"] }
};
