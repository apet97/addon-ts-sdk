import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectDocumentationErrors, discoverActiveMarkdown } from "../../scripts/verify-docs.mjs";

const temporaryRoots: string[] = [];

async function fixture(files: Readonly<Record<string, string>>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "clockify-docs-"));
  temporaryRoots.push(root);
  for (const [file, content] of Object.entries(files)) {
    const target = join(root, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("documentation verification", () => {
  it("accepts reachable relative files and anchors", async () => {
    const root = await fixture({
      "docs/README.md": "# Docs\n\n[Guide](guide.md#run-it)\n",
      "docs/guide.md": "# Guide\n\n## Run it\n",
    });
    await expect(
      collectDocumentationErrors(root, {
        documents: ["docs/README.md", "docs/guide.md"],
        requiredFromIndex: ["docs/guide.md"],
      }),
    ).resolves.toEqual([]);
  });

  it("accepts escaped parentheses and angle-bracketed reference destinations", async () => {
    const root = await fixture({
      "docs/README.md":
        "# Docs\n\n[Escaped](guide\\(one\\).md)\n[Spaced][spaced]\n\n[spaced]: <guide one.md>\n",
      "docs/guide(one).md": "# Parentheses\n",
      "docs/guide one.md": "# Space\n",
    });

    await expect(
      collectDocumentationErrors(root, {
        documents: ["docs/README.md", "docs/guide(one).md", "docs/guide one.md"],
        requiredFromIndex: ["docs/guide(one).md", "docs/guide one.md"],
      }),
    ).resolves.toEqual([]);
  });

  it("ignores tilde fences and long backtick fences containing shorter fences", async () => {
    const root = await fixture({
      "docs/README.md": [
        "# Docs",
        "",
        "~~~markdown",
        "[Tilde](missing-tilde.md)",
        "~~~",
        "",
        "````markdown",
        "[Long](missing-long.md)",
        "```",
        "[Still fenced](missing-after-short-close.md)",
        "````",
        "",
        "[Guide](guide.md)",
        "",
      ].join("\n"),
      "docs/guide.md": "# Guide\n",
    });

    await expect(
      collectDocumentationErrors(root, {
        documents: ["docs/README.md", "docs/guide.md"],
        requiredFromIndex: ["docs/guide.md"],
      }),
    ).resolves.toEqual([]);
  });

  it("decodes reserved path characters and aggregates malformed percent encodings", async () => {
    const root = await fixture({
      "docs/README.md": "# Docs\n\n[Encoded](guide%23one.md)\n[Malformed](guide%ZZ.md)\n",
      "docs/guide#one.md": "# Encoded name\n",
    });

    await expect(
      collectDocumentationErrors(root, {
        documents: ["docs/README.md", "docs/guide#one.md"],
        requiredFromIndex: ["docs/guide#one.md"],
      }),
    ).resolves.toEqual(["docs/README.md: invalid percent-encoding in link target: guide%ZZ.md"]);
  });

  it("reports directories without readable README files as missing targets", async () => {
    const root = await fixture({
      "docs/README.md": "# Docs\n\n[Directory](empty/)\n[Directory anchor](empty/#section)\n",
      "docs/empty/.keep": "",
    });

    await expect(
      collectDocumentationErrors(root, {
        documents: ["docs/README.md"],
        requiredFromIndex: [],
      }),
    ).resolves.toEqual([
      "docs/README.md: missing link target: empty/",
      "docs/README.md: missing link target: empty/#section",
    ]);
  });

  it("supports Setext headings and globally resolves colliding GFM anchors", async () => {
    const root = await fixture({
      "docs/README.md":
        "# Docs\n\n[One](guide.md#same)\n[Two](guide.md#same-1)\n[Three](guide.md#same-1-1)\n[Setext](guide.md#setext-heading)\n",
      "docs/guide.md": "# Same\n\n## Same\n\n### Same-1\n\nSetext heading\n--------------\n",
    });

    await expect(
      collectDocumentationErrors(root, {
        documents: ["docs/README.md", "docs/guide.md"],
        requiredFromIndex: ["docs/guide.md"],
      }),
    ).resolves.toEqual([]);
  });

  it("validates inline image targets without treating images as index navigation", async () => {
    const root = await fixture({
      "docs/README.md":
        "# Docs\n\n![Existing guide image](guide.md)\n![Missing image](missing.png)\n",
      "docs/guide.md": "# Guide\n",
    });

    await expect(
      collectDocumentationErrors(root, {
        documents: ["docs/README.md", "docs/guide.md"],
        requiredFromIndex: ["docs/guide.md"],
      }),
    ).resolves.toEqual([
      "docs/README.md: missing link target: missing.png",
      "docs/README.md: does not link required document docs/guide.md",
    ]);
  });

  it("counts referenced links but not referenced images as index navigation", async () => {
    const root = await fixture({
      "docs/README.md":
        "# Docs\n\n[Guide][guide]\n![Preview][preview]\n\n[guide]: <guide one.md>\n[preview]: preview.png\n",
      "docs/guide one.md": "# Guide\n",
      "docs/preview.png": "image",
    });

    await expect(
      collectDocumentationErrors(root, {
        documents: ["docs/README.md", "docs/guide one.md"],
        requiredFromIndex: ["docs/guide one.md", "docs/preview.png"],
      }),
    ).resolves.toEqual(["docs/README.md: does not link required document docs/preview.png"]);
  });

  it("reports broken files, anchors, and index reachability together", async () => {
    const root = await fixture({
      "docs/README.md": "# Docs\n\n[Broken](missing.md)\n[Anchor](guide.md#absent)\n",
      "docs/guide.md": "# Guide\n\n## Present\n",
      "docs/unlinked.md": "# Unlinked\n",
    });
    const errors = await collectDocumentationErrors(root, {
      documents: ["docs/README.md", "docs/guide.md", "docs/unlinked.md"],
      requiredFromIndex: ["docs/unlinked.md"],
    });
    expect(errors.join("\n")).toContain("missing.md");
    expect(errors.join("\n")).toContain("#absent");
    expect(errors.join("\n")).toContain("docs/unlinked.md");
  });

  it("excludes local execution metadata from active markdown discovery", async () => {
    const root = await fixture({
      ".superpowers/sdd/task-3-brief.md": "# Task\n\n[Local only](missing.md)\n",
      "docs/README.md": "# Docs\n",
      "docs/guide.md": "# Guide\n",
    });

    await expect(discoverActiveMarkdown(root)).resolves.toEqual([
      "docs/README.md",
      "docs/guide.md",
    ]);
  });
});
