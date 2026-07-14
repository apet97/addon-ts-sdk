import { readFile, readdir, realpath, stat } from "node:fs/promises";
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

function fenceLine(line) {
  let content = line.endsWith("\r") ? line.slice(0, -1) : line;
  let blockquoteDepth = 0;
  while (true) {
    const marker = content.match(/^ {0,3}>[ \t]?/);
    if (marker === null) return { content, blockquoteDepth };
    content = content.slice(marker[0].length);
    blockquoteDepth++;
  }
}

function stripFencedCode(source) {
  let fence;
  return source
    .split("\n")
    .map((line) => {
      const candidate = fenceLine(line);
      if (fence !== undefined) {
        if (
          fence.blockquoteDepth === 0 ||
          candidate.blockquoteDepth >= fence.blockquoteDepth
        ) {
          const closing = candidate.content.match(
            /^ {0,3}(`{3,}|~{3,})[ \t]*$/,
          );
          if (
            closing !== null &&
            candidate.blockquoteDepth === fence.blockquoteDepth &&
            closing[1][0] === fence.marker &&
            closing[1].length >= fence.length
          ) {
            fence = undefined;
          }
          return "";
        }
        fence = undefined;
      }

      const opening = candidate.content.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (opening === null) return line;
      const marker = opening[1][0];
      if (marker === "`" && opening[2].includes("`")) return line;
      fence = {
        marker,
        length: opening[1].length,
        blockquoteDepth: candidate.blockquoteDepth,
      };
      return "";
    })
    .join("\n");
}

function isEscaped(source, position) {
  let backslashes = 0;
  for (
    let cursor = position - 1;
    cursor >= 0 && source[cursor] === "\\";
    cursor--
  )
    backslashes++;
  return backslashes % 2 === 1;
}

function maskRange(output, source, start, end) {
  for (let cursor = start; cursor < end; cursor++) {
    if (source[cursor] !== "\n" && source[cursor] !== "\r")
      output[cursor] = " ";
  }
}

function maskHtmlComments(source) {
  const output = source.split("");
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("<!--", cursor);
    if (start === -1) break;
    if (isEscaped(source, start)) {
      cursor = start + 4;
      continue;
    }
    const closing = source.indexOf("-->", start + 4);
    const end = closing === -1 ? source.length : closing + 3;
    maskRange(output, source, start, end);
    cursor = end;
  }
  return output.join("");
}

function maskInlineCode(source) {
  const output = source.split("");
  for (let cursor = 0; cursor < source.length; cursor++) {
    if (source[cursor] !== "`" || isEscaped(source, cursor)) continue;
    let openingEnd = cursor + 1;
    while (source[openingEnd] === "`") openingEnd++;
    const delimiter = source.slice(cursor, openingEnd);
    let closing = openingEnd;
    while ((closing = source.indexOf(delimiter, closing)) !== -1) {
      if (
        source[closing - 1] !== "`" &&
        source[closing + delimiter.length] !== "`"
      ) {
        const end = closing + delimiter.length;
        maskRange(output, source, cursor, end);
        cursor = end - 1;
        break;
      }
      closing++;
    }
    if (closing === -1) cursor = openingEnd - 1;
  }
  return output.join("");
}

function stripNonRendered(source) {
  return maskInlineCode(maskHtmlComments(stripFencedCode(source)));
}

const MARKDOWN_ESCAPABLE = new Set("!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~");

function unescapeMarkdown(value) {
  return value.replace(/\\(.)/gs, (match, character) =>
    MARKDOWN_ESCAPABLE.has(character) ? character : match,
  );
}

function skipWhitespace(source, start) {
  let cursor = start;
  while (cursor < source.length && /[ \t\r\n]/.test(source[cursor])) cursor++;
  return cursor;
}

function bracket(source, start) {
  let depth = 0;
  for (let cursor = start; cursor < source.length; cursor++) {
    if (source[cursor] === "\\") {
      cursor++;
      continue;
    }
    if (source[cursor] === "[") {
      depth++;
      continue;
    }
    if (source[cursor] !== "]") continue;
    depth--;
    if (depth === 0) {
      return { value: source.slice(start + 1, cursor), end: cursor };
    }
  }
  return null;
}

function angleDestination(source, start) {
  for (let cursor = start + 1; cursor < source.length; cursor++) {
    if (source[cursor] === "\n" || source[cursor] === "\r") return null;
    if (source[cursor] === "\\") {
      cursor++;
      continue;
    }
    if (source[cursor] === ">") {
      return {
        href: unescapeMarkdown(source.slice(start + 1, cursor)),
        end: cursor + 1,
      };
    }
  }
  return null;
}

function bareInlineDestination(source, start) {
  let depth = 0;
  for (let cursor = start; cursor < source.length; cursor++) {
    const character = source[cursor];
    if (character === "\\") {
      cursor++;
      continue;
    }
    if (character === "(") {
      depth++;
      continue;
    }
    if (character === ")") {
      if (depth === 0) {
        return {
          href: unescapeMarkdown(source.slice(start, cursor)),
          end: cursor,
          closed: true,
        };
      }
      depth--;
      continue;
    }
    if (depth === 0 && /[ \t\r\n]/.test(character)) {
      return {
        href: unescapeMarkdown(source.slice(start, cursor)),
        end: cursor,
        closed: false,
      };
    }
  }
  return null;
}

function linkTitleEnd(source, start) {
  const opener = source[start];
  if (opener !== '"' && opener !== "'" && opener !== "(") return null;
  const closer = opener === "(" ? ")" : opener;
  let depth = 1;
  for (let cursor = start + 1; cursor < source.length; cursor++) {
    if (source[cursor] === "\\") {
      cursor++;
      continue;
    }
    if (opener === "(" && source[cursor] === "(") {
      depth++;
      continue;
    }
    if (source[cursor] !== closer) continue;
    depth--;
    if (depth === 0) return cursor + 1;
  }
  return null;
}

function inlineDestination(source, openingParenthesis) {
  let cursor = skipWhitespace(source, openingParenthesis + 1);
  const destination =
    source[cursor] === "<"
      ? angleDestination(source, cursor)
      : bareInlineDestination(source, cursor);
  if (destination === null) return null;
  if (destination.closed === true) {
    return { href: destination.href, end: destination.end };
  }

  cursor = skipWhitespace(source, destination.end);
  if (source[cursor] === ")") return { href: destination.href, end: cursor };
  const titleEnd = linkTitleEnd(source, cursor);
  if (titleEnd === null) return null;
  cursor = skipWhitespace(source, titleEnd);
  if (source[cursor] !== ")") return null;
  return { href: destination.href, end: cursor };
}

function definitionDestination(source) {
  const start = skipWhitespace(source, 0);
  if (source[start] === "<")
    return angleDestination(source, start)?.href ?? null;

  let depth = 0;
  for (let cursor = start; cursor <= source.length; cursor++) {
    const character = source[cursor];
    if (character === "\\") {
      cursor++;
      continue;
    }
    if (character === "(") {
      depth++;
      continue;
    }
    if (character === ")") {
      if (depth === 0) return null;
      depth--;
      continue;
    }
    if (
      cursor === source.length ||
      (depth === 0 && /[ \t\r]/.test(character))
    ) {
      if (depth !== 0 || cursor === start) return null;
      return unescapeMarkdown(source.slice(start, cursor));
    }
  }
  return null;
}

function normalizeReferenceLabel(value) {
  return unescapeMarkdown(value)
    .trim()
    .replace(/[ \t\r\n]+/g, " ")
    .toLowerCase();
}

function referenceDefinitions(source) {
  const definitions = new Map();
  let offset = 0;
  const content = source
    .split("\n")
    .map((line) => {
      const comparable = line.endsWith("\r") ? line.slice(0, -1) : line;
      const match = comparable.match(/^ {0,3}\[([^\]]+)\]:[ \t]*(.*)$/);
      if (match === null) {
        offset += line.length + 1;
        return line;
      }
      const href = definitionDestination(match[2]);
      if (href === null) {
        offset += line.length + 1;
        return line;
      }
      const label = normalizeReferenceLabel(match[1]);
      if (label !== "" && !definitions.has(label)) {
        definitions.set(label, { href, position: offset, used: false });
      }
      offset += line.length + 1;
      return " ".repeat(line.length);
    })
    .join("\n");
  return { content, definitions };
}

function linkDestination(parsed, label) {
  const following = label.end + 1;
  if (parsed.content[following] === "(") {
    const destination = inlineDestination(parsed.content, following);
    if (destination !== null && destination.href !== "") return destination;
  }

  let referenceLabel = label.value;
  let end = label.end;
  if (parsed.content[following] === "[") {
    const reference = bracket(parsed.content, following);
    if (reference === null) return null;
    referenceLabel = reference.value === "" ? label.value : reference.value;
    end = reference.end;
  }
  const definition = parsed.definitions.get(
    normalizeReferenceLabel(referenceLabel),
  );
  return definition === undefined
    ? null
    : { href: definition.href, end, definition };
}

function nestedImages(parsed, start, end) {
  const images = [];
  for (let cursor = start; cursor < end; cursor++) {
    if (
      parsed.content[cursor] !== "!" ||
      parsed.content[cursor + 1] !== "[" ||
      isEscaped(parsed.content, cursor)
    )
      continue;
    const label = bracket(parsed.content, cursor + 1);
    if (label === null || label.end >= end) continue;
    const destination = linkDestination(parsed, label);
    if (destination === null || destination.end >= end) continue;
    if (destination.definition !== undefined)
      destination.definition.used = true;
    images.push({
      href: destination.href,
      navigational: false,
      position: cursor,
    });
    images.push(...nestedImages(parsed, cursor + 2, label.end));
    cursor = destination.end;
  }
  return images;
}

function markdownLinks(source) {
  const parsed = referenceDefinitions(stripNonRendered(source));
  const links = [];
  for (let cursor = 0; cursor < parsed.content.length; cursor++) {
    const image =
      parsed.content[cursor] === "!" &&
      parsed.content[cursor + 1] === "[" &&
      !isEscaped(parsed.content, cursor);
    const bracketStart = image
      ? cursor + 1
      : parsed.content[cursor] === "["
        ? cursor
        : -1;
    if (bracketStart === -1) continue;
    const label = bracket(parsed.content, bracketStart);
    if (label === null) continue;

    const destination = linkDestination(parsed, label);
    if (destination === null) {
      cursor = label.end;
      continue;
    }
    if (destination.definition !== undefined)
      destination.definition.used = true;
    links.push({
      href: destination.href,
      navigational: !image,
      position: cursor,
    });
    links.push(...nestedImages(parsed, bracketStart + 1, label.end));
    cursor = destination.end;
  }

  for (const definition of parsed.definitions.values()) {
    if (!definition.used && definition.href !== "") {
      links.push({
        href: definition.href,
        navigational: false,
        position: definition.position,
      });
    }
  }
  return links.sort((left, right) => left.position - right.position);
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
  const add = (heading) => {
    const base = headingSlug(heading);
    let anchor = base;
    let suffix = 0;
    while (anchors.has(anchor)) {
      suffix++;
      anchor = `${base}-${suffix}`;
    }
    anchors.add(anchor);
  };
  const lines = stripFencedCode(source).split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].endsWith("\r")
      ? lines[index].slice(0, -1)
      : lines[index];
    const atx = line.match(/^ {0,3}#{1,6}(?:[ \t]+(.*)|[ \t]*)$/);
    if (atx !== null) {
      add((atx[1] ?? "").replace(/[ \t]+#+[ \t]*$/, ""));
      continue;
    }

    const next = lines[index + 1]?.replace(/\r$/, "") ?? "";
    if (
      line.trim() !== "" &&
      !/^ {4}/.test(line) &&
      /^ {0,3}(?:=+|-+)[ \t]*$/.test(next)
    ) {
      add(line.trim());
      index++;
    }
  }
  return anchors;
}

function localParts(href) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return null;
  const hash = href.indexOf("#");
  const rawPath = hash === -1 ? href : href.slice(0, hash);
  const rawFragment = hash === -1 ? "" : href.slice(hash + 1);
  try {
    return {
      path: decodeURIComponent(rawPath.split("?", 1)[0]),
      fragment: decodeURIComponent(rawFragment),
    };
  } catch {
    return { invalidEncoding: true };
  }
}

async function resolvedTarget(root, canonicalRoot, sourceFile, parts) {
  let absolute = parts.path
    ? path.resolve(root, path.dirname(sourceFile), parts.path)
    : path.resolve(root, sourceFile);
  let relative = posix(path.relative(root, absolute));
  if (relative === ".." || relative.startsWith("../")) return { escaped: true };
  try {
    if ((await stat(absolute)).isDirectory()) {
      absolute = path.join(absolute, "README.md");
      relative = posix(path.relative(root, absolute));
      if (!(await stat(absolute)).isFile()) return { missing: relative };
      await readFile(absolute);
    }
    const canonicalTarget = await realpath(absolute);
    const canonicalRelative = path.relative(canonicalRoot, canonicalTarget);
    if (
      canonicalRelative === ".." ||
      canonicalRelative.startsWith(`..${path.sep}`)
    )
      return { escaped: true };
  } catch {
    return { missing: relative };
  }
  return { absolute, relative };
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
  const canonicalRoot = await realpath(absoluteRoot);
  const files = documents ?? (await discoverActiveMarkdown(absoluteRoot));
  const contents = new Map();
  const directLinks = new Map();
  const errors = [];

  for (const file of files)
    contents.set(file, await requiredText(absoluteRoot, file));

  for (const [sourceFile, source] of contents) {
    const targets = new Set();
    for (const link of markdownLinks(source)) {
      const { href } = link;
      const parts = localParts(href);
      if (parts === null) continue;
      if (parts.invalidEncoding) {
        errors.push(
          `${sourceFile}: invalid percent-encoding in link target: ${href}`,
        );
        continue;
      }
      const target = await resolvedTarget(
        absoluteRoot,
        canonicalRoot,
        sourceFile,
        parts,
      );
      if (target.escaped) {
        errors.push(`${sourceFile}: link escapes the repository: ${href}`);
        continue;
      }
      if (target.missing) {
        errors.push(`${sourceFile}: missing link target: ${href}`);
        continue;
      }
      if (link.navigational) targets.add(target.relative);
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
