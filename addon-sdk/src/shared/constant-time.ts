/**
 * Compares two strings without leaking their contents through comparison
 * timing. A plain `===`/`!==` short-circuits on the first mismatched
 * character, so its running time correlates with how many leading
 * characters two strings share — an attacker who can measure response
 * latency across many requests can exploit that to recover a secret one
 * character at a time.
 *
 * Length is compared last (not first) so a length mismatch does not exit
 * early: the loop always walks the longer string, folding in a fixed `0`
 * for the shorter string's missing characters, before the length check is
 * combined into the same accumulator.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const maxLength = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLength; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
