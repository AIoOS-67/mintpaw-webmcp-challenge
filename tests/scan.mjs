import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const bannedPatterns = [
  /[\u3400-\u9fff]/u,
  new RegExp(["supplier", "questions"].join("_"), "i"),
  /alibaba\.com/i,
  /BEGIN (RSA|OPENSSH|PRIVATE) KEY/i,
  /(?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*["'][^"']+["']/i,
];
const allowedExtensions = new Set([".js", ".mjs", ".json", ".html", ".css", ".md", ".example"]);
const ignored = new Set(["node_modules", ".git"]);
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if ([...allowedExtensions].some((extension) => entry.name.endsWith(extension))) files.push(path);
  }
}

await walk(root);
const failures = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const pattern of bannedPatterns) {
    if (pattern.test(content)) failures.push(`${file}: ${pattern}`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`English and secret scan passed for ${files.length} files.`);
