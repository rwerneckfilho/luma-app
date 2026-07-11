/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: api-client
 * domain: shared-api
 * purpose: Shared helpers for unwrapping luma-core response envelopes.
 * entrypoints:
 *   - unwrapItems
 *   - unwrapObject
 * reads:
 *   - response objects returned by apiRequest
 * mutates:
 *   - none
 * used_by:
 *   - domain API wrapper modules
 * read_first_when:
 *   - Changing API response envelope compatibility.
 * avoid_reading_when:
 *   - Only changing request construction.
 * invariants:
 *   - List wrappers must tolerate both raw arrays and { items } envelopes.
 */
export function unwrapItems<T>(response: unknown): T[] {
  if (Array.isArray(response)) {
    return response as T[];
  }

  if (
    response &&
    typeof response === "object" &&
    "items" in response &&
    Array.isArray((response as { items?: unknown }).items)
  ) {
    return (response as { items: T[] }).items;
  }

  return [];
}

export function unwrapObject<T>(response: unknown, keys: string[]): T {
  if (!response || typeof response !== "object") {
    return response as T;
  }

  for (const key of keys) {
    if (key in response) {
      const value = (response as Record<string, unknown>)[key];

      if (value && typeof value === "object") {
        return value as T;
      }
    }
  }

  return response as T;
}
