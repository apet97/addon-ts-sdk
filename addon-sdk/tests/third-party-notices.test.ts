import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const noticePath = resolve(packageRoot, "THIRD_PARTY_NOTICES.md");

describe("third-party notices", () => {
  it("retains the complete jose, AJV, and fast-deep-equal MIT notices", () => {
    expect(existsSync(noticePath)).toBe(true);
    if (!existsSync(noticePath)) return;

    const notice = readFileSync(noticePath, "utf8");
    expect(notice).toContain("Copyright (c) 2018 Filip Skokan");
    expect(notice).toContain("Copyright (c) 2015-2021 Evgeny Poberezkin");
    expect(notice).toContain("Copyright (c) 2017 Evgeny Poberezkin");
    expect(notice.match(/Permission is hereby granted, free of charge/gu)).toHaveLength(3);
    expect(notice.match(/THE SOFTWARE IS PROVIDED "AS IS"/gu)).toHaveLength(3);
  });

  it("includes the notice in the published package file set", () => {
    const packageJson = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    expect(packageJson.files).toContain("THIRD_PARTY_NOTICES.md");

    const output = execFileSync("npm", ["pack", "--ignore-scripts", "--dry-run", "--json"], {
      cwd: packageRoot,
      encoding: "utf8",
    });
    const [{ files = [] } = {}] = JSON.parse(output);
    expect(files.map((file: { readonly path: string }) => file.path)).toContain(
      "THIRD_PARTY_NOTICES.md",
    );
  });
});
