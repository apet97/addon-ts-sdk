import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const provenance = JSON.parse(await readFile(new URL("MARKETPLACE_DOCS/provenance.json", root), "utf8"));
for (const [name, expected] of Object.entries(provenance.documents)) {
  const content = await readFile(new URL(`MARKETPLACE_DOCS/${name}`, root));
  const actual = createHash("sha256").update(content).digest("hex");
  if (actual !== expected) throw new Error(`${name} changed without a reviewed provenance update.`);
  const text = content.toString("utf8");
  if (!/^Source: https:\/\/dev-docs\.marketplace\.cake\.com\//m.test(text)) {
    throw new Error(`${name} is missing its official Marketplace source URL.`);
  }
}
console.log(`Marketplace docs provenance OK: ${Object.keys(provenance.documents).length} documents.`);
