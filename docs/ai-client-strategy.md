# APP-FND-01 — AI client strategy

## Contract lock

The native client targets `C-AI-PUBLIC` **0.1.0**. `src/ai/contracts.ts` mirrors the reviewed public
shapes for chats, messages, durable runs, replayable events, confirmation decisions, WhatsApp
linking and authenticated NDJSON export. Actor and patient identifiers are never accepted from the
model-facing UI; the Supabase access token is supplied only as an in-memory request context.

`AiPublicClient` is the consumer seam. `FakeAiClient` implements it with owner-scoped, synthetic,
in-memory state so native chat work can progress before the backend is available. The fake covers
the required `202 + run_id`, event replay, confirmation, linking and export paths. It does not call
Supabase, OpenRouter or a real patient API.

## Ephemeral chat state

`EphemeralChatState` is a UI state machine, not a repository. It models:

| State | Meaning |
| --- | --- |
| `idle`, `loading`, `empty`, `ready` | Initial and transcript loading states |
| `submitting`, `streaming` | Durable message acceptance followed by run events |
| `waiting_confirmation` | An action preview is visible; the model cannot commit it |
| `reconnecting` | Resume the same run using the last monotonic event sequence |
| `handoff` | A tier-3 operation is opening or waiting to return from an authenticated surface |
| `access_changed` | Fresh authorization invalidated the selected patient/chat |
| `error` | Safe error code with retry or recovery UX |

Completed runs set `needsTranscriptRefresh`; the canonical assistant message is then fetched from
the backend instead of being reconstructed from deltas.

## Streaming strategy

The native runtime will use an injected transport that supports an authorization header, abort and
`Last-Event-ID`. The app must reconnect to the same `run_id`, ignore sequences already reduced and
fetch the canonical transcript after terminal events. The transport implementation remains behind
`AiPublicClient` until it has been validated on physical iOS and Android builds; APP-FND-01 uses the
deterministic fake and does not pretend browser `EventSource` is a native transport guarantee.

## Privacy and persistence boundary

The transcript and run events remain in component/query memory only. AI query keys must be excluded
from AsyncStorage dehydration, and no transcript, assistant delta, preview, link code, bearer token
or handoff payload may be written to AsyncStorage, SecureStore, notification routing state or logs.
Only non-sensitive UI preferences may use the app's existing local stores. Logging records safe
error codes and correlation IDs, never chat content.

## Integration sequence

1. Use `FakeAiClient` for navigation and accessibility work.
2. Add the authenticated HTTP/native stream adapter against the same interface.
3. Run contract fixtures for replay, 401/410, action expiry and idempotency conflict.
4. Validate suspend/resume, abort on logout and reconnect on physical devices.
5. Enable the real adapter behind a feature flag; keep the fake available only in development and
   tests.

Visual chat screens, navigation wiring and production transport activation belong to APP-V1-01,
not this foundation commit.
