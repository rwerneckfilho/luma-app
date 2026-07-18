/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: form-utils
 * domain: shared-forms
 * purpose: Shared normalization helpers for form values before API payload mapping.
 * entrypoints:
 *   - emptyToNull
 * reads:
 *   - string form values
 * mutates:
 *   - none
 * used_by:
 *   - schema and modal payload mappers
 * read_first_when:
 *   - Changing how optional text fields are normalized for API payloads.
 * avoid_reading_when:
 *   - Only changing validation copy.
 * invariants:
 *   - Empty or whitespace-only optional strings must become null.
 */
export function emptyToNull(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
