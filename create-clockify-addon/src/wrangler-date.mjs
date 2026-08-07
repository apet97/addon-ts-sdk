// Single source for the Worker scaffold's Wrangler compatibility date, shared by the template
// (src/index.mjs's wranglerToml) and the packed-execution proof (scripts/verify-scaffolds.mjs),
// so the generated wrangler.toml and the `wrangler dev` dry-run always test the same date instead
// of two literals silently drifting apart. Kept hard-coded — not derived from the clock at
// generation time — and bumped deliberately alongside a real Wrangler/workerd upgrade.
export const WRANGLER_COMPATIBILITY_DATE = "2026-07-12";
