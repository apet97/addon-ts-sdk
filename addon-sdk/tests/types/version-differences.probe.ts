// Compile-only probes for the per-version type differences. Compiled by tsconfig.typecheck.json,
// NOT run by vitest. These replace the former `types.test.ts`, whose `expectTypeOf` assertions were
// dead under `vitest run` (a runtime no-op) and were never type-checked. Here each fact is a tsc
// constraint: if the generated types stop reflecting a real schema difference, tsc fails.
import { generated } from "../../src";

// A type that is only inhabitable by `true` / `false`; assigning the wrong boolean is a compile error.
type IsTrue<T extends true> = T;
type IsFalse<T extends false> = T;
type Includes<Union, Member> = Member extends Union ? true : false;
type Optional<T> = undefined extends T ? true : false;

// --- component "type" enum: "invoices.action" exists only in 1.4+ (added that version). ---
type _v12NoInvoices = IsFalse<Includes<generated.v1_2.ClockifyComponent["type"], "invoices.action">>;
type _v13NoInvoices = IsFalse<Includes<generated.v1_3.ClockifyComponent["type"], "invoices.action">>;
type _v14HasInvoices = IsTrue<Includes<generated.v1_4.ClockifyComponent["type"], "invoices.action">>;
type _v15HasInvoices = IsTrue<Includes<generated.v1_5.ClockifyComponent["type"], "invoices.action">>;

// --- component "label": optional in 1.2 (not in `required`), required in 1.3+. ---
type _v12LabelOptional = IsTrue<Optional<generated.v1_2.ClockifyComponent["label"]>>;
type _v13LabelRequired = IsFalse<Optional<generated.v1_3.ClockifyComponent["label"]>>;
type _v14LabelRequired = IsFalse<Optional<generated.v1_4.ClockifyComponent["label"]>>;
type _v15LabelRequired = IsFalse<Optional<generated.v1_5.ClockifyComponent["label"]>>;

// --- manifest "scopes": required in 1.2, optional in 1.3+. ---
type _v12ScopesRequired = IsFalse<Optional<generated.v1_2.ClockifyManifest["scopes"]>>;
type _v13ScopesOptional = IsTrue<Optional<generated.v1_3.ClockifyManifest["scopes"]>>;
type _v14ScopesOptional = IsTrue<Optional<generated.v1_4.ClockifyManifest["scopes"]>>;
type _v15ScopesOptional = IsTrue<Optional<generated.v1_5.ClockifyManifest["scopes"]>>;

// Reference the aliases so `noUnusedLocals`-style tooling sees them as used (they are compile-time only).
export type _VersionDifferenceProbes = [
  _v12NoInvoices, _v13NoInvoices, _v14HasInvoices, _v15HasInvoices,
  _v12LabelOptional, _v13LabelRequired, _v14LabelRequired, _v15LabelRequired,
  _v12ScopesRequired, _v13ScopesOptional, _v14ScopesOptional, _v15ScopesOptional
];
