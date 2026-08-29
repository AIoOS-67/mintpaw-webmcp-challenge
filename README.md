# MintPaw WebMCP Compatibility Demo

MintPaw WebMCP tools help a shopper and an in-browser agent catch compatibility problems before a purchase path begins. This repository contains a small, read-only implementation and an English demo page for the WebMCP Challenge.

## What this demonstrates

- `check_pet_compatibility` checks species, size, weight, and use context.
- `check_hardware_compatibility` checks region, network band, voltage, and required hardware conditions.
- A mismatch returns `incompatible_blocked` and `BLOCK_PURCHASE`.
- Unknown or unverified information returns `needs_verification` and never becomes a passing result.
- A passing result still returns `ASK_EXPLICIT_USER_CONFIRMATION`; these tools never add to cart, check out, or place an order.
- All tool names, schemas, errors, status values, and demo copy are English.

## Local run

This demo has no backend and no secret dependency.

```bash
npm test
npm run scan
python -m http.server 4173 --directory public
```

Open `http://localhost:4173` in a browser. To test browser-native WebMCP registration, use a compatible browser with WebMCP enabled. In browsers without WebMCP, the page stays in local demo mode and the deterministic compatibility logic remains available.

## Repository layout

```text
README.md
LICENSE
package.json
.env.example
src/
  compatibility.js       # Pure compatibility decisions and schemas
  webmcp-tools.js        # registerTool definitions and registration adapter
public/
  index.html             # English demo page
  app.js                 # Demo interactions and WebMCP registration
  styles.css
 tests/
  compatibility.test.mjs # Deterministic behavior tests
  fixtures.json
  scan.mjs               # CJK, internal-data, URL, and secret scan
```

## WebMCP registration

The page registers exactly two read-only tools when the browser exposes `document.modelContext.registerTool`:

```js
await document.modelContext.registerTool({
  name: "check_hardware_compatibility",
  title: "Check hardware compatibility",
  description: "Check whether the current MintPaw product fits a shopper's region, network, voltage, and required hardware conditions before purchase.",
  inputSchema: hardwareSchema,
  annotations: { readOnlyHint: true },
  execute: async (input) => checkHardwareCompatibility(input)
});
```

Tool discovery is page-context based: an agent must open the deployed page in a WebMCP-capable browser. This is not a remote backend MCP endpoint. Cross-origin exposure is intentionally not configured in this demo.

## Safety boundary

The demo fixture is local and illustrative. It does not read Shopify data, write Metafields, expose supplier evidence, expose source URLs, or contain an order operation. Production data should be injected only through a separately authorized and verified data path. A `platform_listed`, `inferred`, pending, missing, or conflicting value must remain verification-required until independently confirmed.

## Challenge submission notes

The WebMCP Challenge requires a working live URL, an English project description, a public repository with an open-source license, and a public YouTube demo video under three minutes. The repository must include source, assets, instructions, and a visible license. This local package is a prepared submission repository; it has not been pushed to GitHub because no GitHub authorization was provided.

Official references:

- [WebMCP Challenge](https://webmcp.devpost.com/)
- [Official Rules](https://webmcp.devpost.com/rules)
- [WebMCP Resources and FAQ](https://webmcp.devpost.com/resources)
- [Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP Tool Security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [WebMCP Specification](https://webmachinelearning.github.io/webmcp/)

## License

Apache-2.0. See [LICENSE](./LICENSE).
