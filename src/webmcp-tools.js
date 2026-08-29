import { checkHardwareCompatibility, checkPetCompatibility, schemas } from "./compatibility.js";

export const webmcpToolDefinitions = Object.freeze([
  {
    name: "check_pet_compatibility",
    title: "Check pet compatibility",
    description: "Check whether the current MintPaw product matches a stated pet profile. Return a blocked result when the profile is incompatible or product data is not verified.",
    inputSchema: schemas.pet,
    annotations: { readOnlyHint: true },
    execute: async (input) => checkPetCompatibility(input),
  },
  {
    name: "check_hardware_compatibility",
    title: "Check hardware compatibility",
    description: "Check whether the current MintPaw product fits a shopper's region, network, voltage, and required hardware conditions before purchase.",
    inputSchema: schemas.hardware,
    annotations: { readOnlyHint: true },
    execute: async (input) => checkHardwareCompatibility(input),
  },
]);

export async function registerMintPawTools(targetDocument = globalThis.document) {
  const modelContext = targetDocument?.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    return { registered: false, code: "WEBMCP_UNAVAILABLE", tools: [] };
  }

  const registered = [];
  for (const definition of webmcpToolDefinitions) {
    await modelContext.registerTool(definition);
    registered.push(definition.name);
  }
  return { registered: true, code: "TOOLS_REGISTERED", tools: registered };
}
