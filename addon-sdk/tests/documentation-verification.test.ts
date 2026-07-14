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
