// Builder method- and class-name derivation, ported from the Clockify add-on Java SDK annotation
// processor (com.cake.clockify.annotationprocessor.Utils). The Java SDK is the law: a builder
// method named `onNewTimeEntry` / a class named `ClockifyScope` must come out byte-identical here.
//
// Two Java behaviours a naive port gets wrong (see tests/generator-naming.test.ts):
//   1. Java's String.split keeps a leading empty token when a zero-width `(?=\p{Upper})` match
//      occurs at index 0, so a leading capital is PRESERVED (PascalCase). JS's String.split drops
//      that index-0 empty match, silently camelCasing the word.
//   2. Java splits words on `\p{Upper}` (any Unicode uppercase letter), not ASCII `[A-Z]`.
// Neither case is exercised by schemas 1.2-1.5 (every property/enum value stays identical), but the
// port must still match the law for any value Clockify might add later.

export function capitalize(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Java Utils.normalizeUppercaseOnlyValue: an all-uppercase token is lowercased wholesale; any other
// token is left untouched so its internal casing survives to the word-splitting step.
function normalizeUppercaseOnlyValue(value: string): string {
  return value.toUpperCase() === value ? value.toLowerCase() : value;
}

export function toMethodName(value: string): string {
  const parts: string[] = [];
  for (const segment of value.split(/[.\-_]/)) {
    const normalized = normalizeUppercaseOnlyValue(segment);
    const words = normalized.split(/(?=\p{Lu})/u);
    // Mirror Java String.split: a `(?=\p{Lu})` match at index 0 yields a leading "" token.
    if (/^\p{Lu}/u.test(normalized)) words.unshift("");
    for (const word of words) parts.push(word.toLowerCase());
  }
  // Java: `if (parts.size() <= 1) return normalizeUppercaseOnlyValue(value);`
  if (parts.length <= 1) return normalizeUppercaseOnlyValue(value);
  let result = parts[0].toLowerCase();
  for (let i = 1; i < parts.length; i++) result += capitalize(parts[i]);
  return result;
}

export function toClassName(value: string): string {
  return capitalize(toMethodName(value));
}
