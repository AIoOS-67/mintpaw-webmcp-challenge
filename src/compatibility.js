export const TOOL_VERSION = "0.1.0";

export const STATUS = Object.freeze({
  COMPATIBLE_PENDING_CONFIRMATION: "compatible_pending_confirmation",
  INCOMPATIBLE_BLOCKED: "incompatible_blocked",
  NEEDS_VERIFICATION: "needs_verification",
});

export const DECISION = Object.freeze({
  PASS: "PASS",
  FAIL: "FAIL",
  BLOCKED_DATA: "BLOCKED_DATA",
});

export const ERROR_CODE = Object.freeze({
  INVALID_INPUT: "INVALID_INPUT",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  MISSING_REQUIRED_INPUT: "MISSING_REQUIRED_INPUT",
  UNSUPPORTED_VALUE: "UNSUPPORTED_VALUE",
  DATA_NOT_VERIFIED: "DATA_NOT_VERIFIED",
});

export const DATA_STATUS = Object.freeze({
  CONFIRMED: "confirmed",
  PLATFORM_LISTED: "platform_listed",
  INFERRED_TBC: "inferred_tbc",
  PENDING: "pending",
});

const FORBIDDEN_KEY_PARTS = ["evidence", "source", ["supplier", "questions"].join("_"), "raw", "metafield", "url", "json"];
const SAFE_TEXT_FALLBACK = "Verification required.";
const SAFE_STATUS_VALUES = new Set(Object.values(DATA_STATUS));

function isForbiddenKey(key) {
  const normalized = String(key).toLowerCase();
  return FORBIDDEN_KEY_PARTS.some((part) => normalized.includes(part));
}

function isSafeEnglishText(value) {
  return typeof value === "string" && /^[\x20-\x7E]*$/u.test(value) && !/https?:\/\//iu.test(value);
}

function sanitizePublicValue(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return undefined;
  if (typeof value === "string") return isSafeEnglishText(value) ? value : SAFE_TEXT_FALLBACK;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizePublicValue(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value === "object") {
    const output = {};
    for (const [key, child] of Object.entries(value)) {
      if (isForbiddenKey(key)) continue;
      const safeChild = sanitizePublicValue(child, depth + 1);
      if (safeChild !== undefined) output[key] = safeChild;
    }
    return output;
  }
  return undefined;
}

export function sanitizePublicPayload(value) {
  return sanitizePublicValue(value);
}

function safeIdentifier(value, fallback) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/u.test(value) ? value : fallback;
}

export function sanitizePublicResult(result) {
  const safe = sanitizePublicValue(result) || {};
  const allowedKeys = ["tool", "version", "productId", "requestId", "dataQuality", "checkedAt", "decision", "status", "error", "reasons", "nextAction", "matches", "requiredExtras"];
  const output = {};
  for (const key of allowedKeys) {
    if (safe[key] !== undefined) output[key] = safe[key];
  }
  output.productId = safeIdentifier(output.productId, "unknown");
  output.requestId = safeIdentifier(output.requestId, "anonymous-request");
  if (!SAFE_STATUS_VALUES.has(output.dataQuality)) output.dataQuality = DATA_STATUS.PENDING;
  if (!Array.isArray(output.reasons) || !output.reasons.length) output.reasons = [SAFE_TEXT_FALLBACK];
  return output;
}

export const productCatalog = Object.freeze({
  "mintpaw-litter-box-demo": Object.freeze({
    id: "mintpaw-litter-box-demo",
    name: "MintPaw Smart Self-Cleaning Cat Litter Box",
    petProfile: Object.freeze({
      species: ["cat"],
      weightKgRange: [2, 8],
      sizeRange: ["small", "medium"],
      useContexts: ["indoor"],
    }),
    hardware: Object.freeze({
      networkBands: ["2.4GHz"],
      regions: ["US", "CA"],
      voltage: "120V",
      requiredExtras: ["indoor_power_outlet"],
    }),
    dataStatus: "confirmed",
  }),
});

const SUPPORTED_SPECIES = new Set(["cat", "dog"]);
const SUPPORTED_SIZES = new Set(["small", "medium", "large"]);
const SUPPORTED_NETWORKS = new Set(["2.4GHz", "5GHz", "both", "unknown"]);

function resultBase(tool, productId, requestId) {
  return {
    tool,
    version: TOOL_VERSION,
    productId,
    requestId: requestId || "anonymous-request",
    dataQuality: "confirmed",
    checkedAt: new Date().toISOString(),
  };
}

function errorResult(tool, productId, requestId, code, message, nextAction = "COLLECT_MISSING_CONSTRAINT") {
  return {
    ...resultBase(tool, productId || "unknown", requestId),
    decision: DECISION.BLOCKED_DATA,
    status: STATUS.NEEDS_VERIFICATION,
    error: { code, message },
    reasons: [message],
    nextAction,
  };
}

function requireObject(value, field, tool, productId, requestId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return errorResult(tool, productId, requestId, ERROR_CODE.INVALID_INPUT, `${field} must be an object.`);
  }
  return null;
}

function getProduct(productId, tool, requestId) {
  if (typeof productId !== "string" || !productId.trim()) {
    return { error: errorResult(tool, productId, requestId, ERROR_CODE.INVALID_INPUT, "productId is required.") };
  }
  const product = productCatalog[productId];
  if (!product) {
    return { error: errorResult(tool, productId, requestId, ERROR_CODE.PRODUCT_NOT_FOUND, "The requested product is not available for compatibility checking.") };
  }
  return { product };
}

function checkPetCompatibilityInternal(input = {}) {
  const tool = "check_pet_compatibility";
  const productId = input.productId;
  const requestId = input.requestId;
  const objectError = requireObject(input.petProfile, "petProfile", tool, productId, requestId);
  if (objectError) return objectError;

  const productResult = getProduct(productId, tool, requestId);
  if (productResult.error) return productResult.error;
  const { product } = productResult;
  const profile = input.petProfile;

  if (!SUPPORTED_SPECIES.has(profile.species)) {
    return errorResult(tool, productId, requestId, ERROR_CODE.UNSUPPORTED_VALUE, "species must be cat or dog.");
  }
  if (profile.size && !SUPPORTED_SIZES.has(profile.size)) {
    return errorResult(tool, productId, requestId, ERROR_CODE.UNSUPPORTED_VALUE, "size must be small, medium, or large.");
  }
  if (profile.weightKg !== undefined && (typeof profile.weightKg !== "number" || profile.weightKg <= 0)) {
    return errorResult(tool, productId, requestId, ERROR_CODE.INVALID_INPUT, "weightKg must be a positive number.");
  }

  const reasons = [];
  if (!profile.species) {
    return errorResult(tool, productId, requestId, ERROR_CODE.MISSING_REQUIRED_INPUT, "species is required for a pet profile check.");
  }

  const speciesMatch = product.petProfile.species.includes(profile.species);
  const sizeMatch = !profile.size || product.petProfile.sizeRange.includes(profile.size);
  const weightMatch = profile.weightKg === undefined || (profile.weightKg >= product.petProfile.weightKgRange[0] && profile.weightKg <= product.petProfile.weightKgRange[1]);
  const contextMatch = !profile.useContext || product.petProfile.useContexts.includes(profile.useContext);

  if (!speciesMatch) reasons.push("This product is listed for cats, not the stated pet species.");
  if (!sizeMatch) reasons.push("The stated pet size is outside the listed supported size range.");
  if (!weightMatch) reasons.push("The stated pet weight is outside the listed supported weight range.");
  if (!contextMatch) reasons.push("The stated use context is not listed as supported.");

  if (product.dataStatus !== "confirmed") {
    return {
      ...resultBase(tool, productId, requestId),
      decision: DECISION.BLOCKED_DATA,
      status: STATUS.NEEDS_VERIFICATION,
      dataQuality: product.dataStatus,
      reasons: ["The product pet-profile data is not verified."],
      nextAction: "BLOCK_PURCHASE",
    };
  }

  if (reasons.length) {
    return {
      ...resultBase(tool, productId, requestId),
      decision: DECISION.FAIL,
      status: STATUS.INCOMPATIBLE_BLOCKED,
      reasons,
      nextAction: "BLOCK_PURCHASE",
    };
  }

  return {
    ...resultBase(tool, productId, requestId),
    decision: DECISION.PASS,
    status: STATUS.COMPATIBLE_PENDING_CONFIRMATION,
    reasons: ["The stated pet profile matches the listed product range."],
    nextAction: "ASK_EXPLICIT_USER_CONFIRMATION",
  };
}

function checkHardwareCompatibilityInternal(input = {}) {
  const tool = "check_hardware_compatibility";
  const productId = input.productId;
  const requestId = input.requestId;
  const objectError = requireObject(input.hardwareProfile, "hardwareProfile", tool, productId, requestId);
  if (objectError) return objectError;

  const productResult = getProduct(productId, tool, requestId);
  if (productResult.error) return productResult.error;
  const { product } = productResult;
  const hardware = input.hardwareProfile;

  if (!hardware.region || typeof hardware.region !== "string") {
    return errorResult(tool, productId, requestId, ERROR_CODE.MISSING_REQUIRED_INPUT, "region is required for a hardware compatibility check.");
  }
  if (hardware.network && !SUPPORTED_NETWORKS.has(hardware.network)) {
    return errorResult(tool, productId, requestId, ERROR_CODE.UNSUPPORTED_VALUE, "network must be 2.4GHz, 5GHz, both, or unknown.");
  }

  const reasons = [];
  if (product.dataStatus !== "confirmed") {
    return {
      ...resultBase(tool, productId, requestId),
      decision: DECISION.BLOCKED_DATA,
      status: STATUS.NEEDS_VERIFICATION,
      dataQuality: product.dataStatus,
      reasons: ["The product hardware data is not verified."],
      nextAction: "BLOCK_PURCHASE",
    };
  }

  if (!product.hardware.regions.includes(hardware.region.toUpperCase())) {
    reasons.push("The product is not listed for the stated region.");
  }
  if (hardware.network && hardware.network !== "unknown") {
    const networkMatch = hardware.network === "both" || product.hardware.networkBands.includes(hardware.network);
    if (!networkMatch) reasons.push("The product network requirement does not match the stated network.");
  } else {
    reasons.push("Network compatibility is not confirmed for the stated environment.");
  }
  if (hardware.voltage && hardware.voltage !== product.hardware.voltage) {
    reasons.push("The stated household voltage does not match the listed product voltage.");
  }
  if (hardware.hasRequiredExtras === false) {
    reasons.push("A required hardware extra is not available.");
  }

  if (reasons.length) {
    return {
      ...resultBase(tool, productId, requestId),
      decision: reasons.some((reason) => reason.includes("not confirmed")) ? DECISION.BLOCKED_DATA : DECISION.FAIL,
      status: reasons.some((reason) => reason.includes("not confirmed")) ? STATUS.NEEDS_VERIFICATION : STATUS.INCOMPATIBLE_BLOCKED,
      reasons,
      nextAction: "BLOCK_PURCHASE",
    };
  }

  return {
    ...resultBase(tool, productId, requestId),
    decision: DECISION.PASS,
    status: STATUS.COMPATIBLE_PENDING_CONFIRMATION,
    reasons: ["The stated region, network, voltage, and required extras match the listed product requirements."],
    nextAction: "ASK_EXPLICIT_USER_CONFIRMATION",
  };
}

export function checkPetCompatibility(input = {}) {
  return sanitizePublicResult(checkPetCompatibilityInternal(input));
}

export function checkHardwareCompatibility(input = {}) {
  return sanitizePublicResult(checkHardwareCompatibilityInternal(input));
}

export const schemas = Object.freeze({
  pet: {
    type: "object",
    additionalProperties: false,
    properties: {
      productId: { type: "string", description: "The product identifier shown by the current page." },
      petProfile: {
        type: "object",
        additionalProperties: false,
        properties: {
          species: { type: "string", enum: ["cat", "dog"] },
          size: { type: "string", enum: ["small", "medium", "large"] },
          weightKg: { type: "number", minimum: 0 },
          useContext: { type: "string", enum: ["indoor", "outdoor", "indoor_alone"] },
        },
        required: ["species"],
      },
      requestId: { type: "string", description: "An optional non-identifying request label." },
    },
    required: ["productId", "petProfile"],
  },
  hardware: {
    type: "object",
    additionalProperties: false,
    properties: {
      productId: { type: "string", description: "The product identifier shown by the current page." },
      hardwareProfile: {
        type: "object",
        additionalProperties: false,
        properties: {
          region: { type: "string", description: "The shopper's country or region code." },
          network: { type: "string", enum: ["2.4GHz", "5GHz", "both", "unknown"] },
          voltage: { type: "string", description: "The household voltage available to the shopper." },
          hasRequiredExtras: { type: "boolean" },
        },
        required: ["region"],
      },
      requestId: { type: "string", description: "An optional non-identifying request label." },
    },
    required: ["productId", "hardwareProfile"],
  },
});
