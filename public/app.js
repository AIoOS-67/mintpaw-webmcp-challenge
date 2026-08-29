import { checkHardwareCompatibility, checkPetCompatibility } from "./compatibility.js";
import { registerMintPawTools } from "./webmcp-tools.js";

const PRODUCT_ID = "mintpaw-litter-box-demo";
const webmcpStatus = document.querySelector("#webmcp-status");

const registration = await registerMintPawTools(document);
webmcpStatus.textContent = registration.registered
  ? "WebMCP tools registered on this page"
  : "Local demo mode: WebMCP is not enabled in this browser";

function renderResult(element, response) {
  element.className = "result";
  if (response.decision === "PASS") element.classList.add("pass");
  if (response.decision === "FAIL") element.classList.add("fail");
  if (response.decision === "BLOCKED_DATA") element.classList.add("verify");
  const title = response.status.replaceAll("_", " ");
  const reasons = response.reasons.map((reason) => `<li>${reason}</li>`).join("");
  element.innerHTML = `<strong>${title}</strong><div>Next step: ${response.nextAction.replaceAll("_", " ")}</div><ul>${reasons}</ul>`;
}

document.querySelector("#pet-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const response = checkPetCompatibility({
    productId: PRODUCT_ID,
    requestId: "demo-pet-check",
    petProfile: {
      species: document.querySelector("#pet-species").value,
      size: document.querySelector("#pet-size").value,
      weightKg: Number(document.querySelector("#pet-weight").value),
      useContext: "indoor",
    },
  });
  renderResult(document.querySelector("#pet-result"), response);
});

document.querySelector("#hardware-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const response = checkHardwareCompatibility({
    productId: PRODUCT_ID,
    requestId: "demo-hardware-check",
    hardwareProfile: {
      region: document.querySelector("#hardware-region").value,
      network: document.querySelector("#hardware-network").value,
      voltage: document.querySelector("#hardware-voltage").value,
      hasRequiredExtras: true,
    },
  });
  renderResult(document.querySelector("#hardware-result"), response);
});
