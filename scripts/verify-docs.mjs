import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const BUILDER_DOCS = Object.freeze([
  "docs/getting-started.md",
  "docs/how-an-addon-works.md",
  "docs/guides/manifest-and-registration.md",
  "docs/guides/installation-and-storage.md",
  "docs/guides/components-and-ui.md",
  "docs/guides/webhooks-and-idempotency.md",
  "docs/guides/calling-clockify.md",
  "docs/guides/deployment-and-operations.md",
  "docs/guides/troubleshooting.md",
]);

const SKIP_DIRECTORIES = new Set([
  ".git",
  ".superpowers",
  "node_modules",
  "dist",
  "coverage",
]);

function posix(value) {
  return value.split(path.sep).join("/");
}

function excluded(relative) {
  return (
    relative === "GOAL.md" ||
    relative === "verification_report.md" ||
    relative === "addon-sdk/public-api.snapshot.md" ||
    relative.startsWith("docs/superpowers/") ||
    relative.startsWith("docs/archive/") ||
    /^MARKETPLACE_DOCS\/\d{2}-.*\.md$/.test(relative)
  );
}

async function walk(root, directory, output) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(root, absolute, output);
      continue;
    }
    const relative = posix(path.relative(root, absolute));
    if (entry.isFile() && relative.endsWith(".md") && !excluded(relative))
      output.push(relative);
  }
}

export async function discoverActiveMarkdown(root) {
  const output = [];
  await walk(path.resolve(root), path.resolve(root), output);
  return output.sort();
}

function stripFencedCode(source) {
  return source.replace(/```[\s\S]*?```/g, "");
}

function linkTarget(raw) {
  const value = raw.trim();
  if (value.startsWith("<")) {
    const end = value.indexOf(">");
    return end === -1 ? value : value.slice(1, end);
  }
  return value.split(/\s+/u, 1)[0] ?? "";
}

function markdownLinks(source) {
  const content = stripFencedCode(source);
  const links = [];
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)\n]+)\)/g)) {
    links.push(linkTarget(match[1]));
  }
  for (const match of content.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm)) {
    links.push(linkTarget(match[1]));
  }
  return links.filter(Boolean);
}

function headingSlug(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-");
}

function headingAnchors(source) {
  const anchors = new Set();
  const seen = new Map();
  for (const match of stripFencedCode(source).matchAll(
    /^#{1,6}\s+(.+?)\s*#*\s*$/gm,
  )) {
    const base = headingSlug(match[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

function localParts(href) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return null;
  const hash = href.indexOf("#");
  const rawPath = hash === -1 ? href : href.slice(0, hash);
  const rawFragment = hash === -1 ? "" : href.slice(hash + 1);
  return {
    path: decodeURI(rawPath.split("?", 1)[0]),
    fragment: decodeURIComponent(rawFragment),
  };
}

async function resolvedTarget(root, sourceFile, parts) {
  let absolute = parts.path
    ? path.resolve(root, path.dirname(sourceFile), parts.path)
    : path.resolve(root, sourceFile);
  const relative = posix(path.relative(root, absolute));
  if (relative === ".." || relative.startsWith("../")) return { escaped: true };
  try {
    if ((await stat(absolute)).isDirectory())
      absolute = path.join(absolute, "README.md");
  } catch {
    return { missing: relative };
  }
  return { absolute, relative: posix(path.relative(root, absolute)) };
}

async function requiredText(root, file) {
  return readFile(path.resolve(root, file), "utf8");
}

export async function collectDocumentationErrors(
  root,
  {
    documents,
    index = "docs/README.md",
    requiredFromIndex = BUILDER_DOCS,
    repositoryContracts = false,
  } = {},
) {
  const absoluteRoot = path.resolve(root);
  const files = documents ?? (await discoverActiveMarkdown(absoluteRoot));
  const contents = new Map();
  const directLinks = new Map();
  const errors = [];

  for (const file of files)
    contents.set(file, await requiredText(absoluteRoot, file));

  for (const [sourceFile, source] of contents) {
    const targets = new Set();
    for (const href of markdownLinks(source)) {
      const parts = localParts(href);
      if (parts === null) continue;
      const target = await resolvedTarget(absoluteRoot, sourceFile, parts);
      if (target.escaped) {
        errors.push(`${sourceFile}: link escapes the repository: ${href}`);
        continue;
      }
      if (target.missing) {
        errors.push(`${sourceFile}: missing link target: ${href}`);
        continue;
      }
      targets.add(target.relative);
      if (parts.fragment && target.relative.endsWith(".md")) {
        const targetSource =
          contents.get(target.relative) ??
          (await readFile(target.absolute, "utf8"));
        if (!headingAnchors(targetSource).has(headingSlug(parts.fragment))) {
          errors.push(
            `${sourceFile}: missing anchor in ${target.relative}: #${parts.fragment}`,
          );
        }
      }
    }
    directLinks.set(sourceFile, targets);
  }

  const indexLinks = directLinks.get(index) ?? new Set();
  for (const file of requiredFromIndex) {
    if (!indexLinks.has(file))
      errors.push(`${index}: does not link required document ${file}`);
  }

  if (repositoryContracts) {
    const rootReadme = await requiredText(absoluteRoot, "README.md");
    const indexSource = await requiredText(absoluteRoot, index);
    const lifecycle = await requiredText(
      absoluteRoot,
      "docs/how-an-addon-works.md",
    );
    for (const value of ["Clockify", "SDK", "Add-on application", "1.5"]) {
      if (!lifecycle.includes(value))
        errors.push(`docs/how-an-addon-works.md: missing ${value}`);
    }
    if (!rootReadme.includes("docs/getting-started.md")) {
      errors.push("README.md: missing getting-started link");
    }
    for (const label of [
      "Maintainers",
      "Upstream",
      "generated",
      "historical",
    ]) {
      if (!indexSource.includes(label))
        errors.push(`${index}: missing classification ${label}`);
    }
    const agents = (await requiredText(absoluteRoot, "AGENTS.md"))
      .split("\n")
      .slice(4);
    const claude = (await requiredText(absoluteRoot, "CLAUDE.md"))
      .split("\n")
      .slice(4);
    if (agents.join("\n") !== claude.join("\n")) {
      errors.push("AGENTS.md and CLAUDE.md differ after their introductions");
    }
    for (const boundary of [
      "MARKETPLACE_DOCS/provenance.json",
      "addon-sdk/public-api.snapshot.md",
    ]) {
      try {
        await stat(path.resolve(absoluteRoot, boundary));
      } catch {
        errors.push(`missing generated/upstream boundary file: ${boundary}`);
      }
    }
  }

  return errors;
}

async function main() {
  const root = process.cwd();
  const documents = await discoverActiveMarkdown(root);
  const errors = await collectDocumentationErrors(root, {
    documents,
    repositoryContracts: true,
  });
  if (errors.length > 0) {
    console.error("Documentation verification failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Documentation verification passed (${documents.length} active files).`,
  );
}

const direct =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (direct) await main();
