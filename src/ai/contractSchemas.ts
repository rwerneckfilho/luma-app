import { z } from "zod";
import { AI_PUBLIC_CONTRACT } from "./contracts";

const uuid = z.string().uuid();
const dateTime = z.string().datetime({ offset: true });
const jsonObject = z.record(z.string(), z.unknown());

const patientSelectionSchema = z
  .object({
    kind: z.enum(["self", "care"]),
    label: z.string().min(1).max(120),
  })
  .strict();

export const chatSchema = z
  .object({
    id: uuid,
    title: z.string().max(120).nullable(),
    patient: patientSelectionSchema,
    status: z.enum(["active", "archived", "deleted", "access_changed"]),
    created_at: dateTime,
    updated_at: dateTime,
    delete_after: dateTime.nullable().optional(),
  })
  .strict();

export const chatPageSchema = z
  .object({
    items: z.array(chatSchema).max(50),
    next_cursor: z.string().min(1).max(256).nullable().optional(),
  })
  .strict();

export const messageSchema = z
  .object({
    id: uuid,
    chat_id: uuid,
    role: z.enum(["user", "assistant", "system_notice"]),
    channel: z.enum(["app", "web", "whatsapp", "system"]),
    content: z.string().max(32_000),
    created_at: dateTime,
  })
  .strict();

export const messagePageSchema = z
  .object({
    items: z.array(messageSchema).max(100),
    next_cursor: z.string().min(1).max(256).nullable().optional(),
  })
  .strict();

export const runSchema = z
  .object({
    id: uuid,
    chat_id: uuid,
    message_id: uuid,
    status: z.enum([
      "awaiting_grant",
      "queued",
      "running",
      "waiting_for_action",
      "succeeded",
      "failed",
      "cancelled",
    ]),
    created_at: dateTime,
    completed_at: dateTime.nullable().optional(),
    error_code: z.string().max(128).nullable().optional(),
  })
  .strict();

export const acceptedMessageSchema = z
  .object({ message: messageSchema, run: runSchema })
  .strict();

const pendingActionSchema = z
  .object({
    action_id: uuid,
    capability_id: z.string().min(1).max(128),
    preview: jsonObject,
    confirmation_ref: z.string().min(16).max(512),
    presented_preview_hash: z.string().regex(/^[a-f0-9]{64}$/),
    expires_at: dateTime,
  })
  .strict();

const runEventBase = {
  version: z.literal(AI_PUBLIC_CONTRACT.version),
  event_id: uuid,
  run_id: uuid,
  sequence: z.number().int().min(1),
  created_at: dateTime,
};

export const runEventSchema = z.discriminatedUnion("type", [
  z.object({ ...runEventBase, type: z.literal("run.started") }).strict(),
  z
    .object({
      ...runEventBase,
      type: z.literal("assistant.delta"),
      delta: z.string().max(4_096),
    })
    .strict(),
  z
    .object({
      ...runEventBase,
      type: z.literal("action.required"),
      action: pendingActionSchema,
    })
    .strict(),
  z.object({ ...runEventBase, type: z.literal("run.completed") }).strict(),
  z
    .object({
      ...runEventBase,
      type: z.literal("run.failed"),
      error_code: z.string().min(1).max(128),
    })
    .strict(),
]);

export const actionSchema = z
  .object({
    id: uuid,
    chat_id: uuid,
    capability_id: z.string().min(1).max(128),
    status: z.enum([
      "prepared",
      "awaiting_confirmation",
      "executing",
      "succeeded",
      "failed",
      "cancelled",
      "expired",
    ]),
    preview: jsonObject.nullable().optional(),
    confirmation_ref: z.string().min(16).max(512),
    presented_preview_hash: z.string().regex(/^[a-f0-9]{64}$/),
    expires_at: dateTime,
  })
  .strict();

export const linkChallengeSchema = z
  .object({
    challenge_id: uuid,
    link_code: z.string().min(8).max(128),
    expires_at: dateTime,
  })
  .strict();

const channelLinkSchema = z
  .object({
    id: uuid,
    channel: z.literal("whatsapp"),
    status: z.enum(["active", "revoking", "revoked"]),
    display_hint: z.string().max(32).nullable().optional(),
    created_at: dateTime,
  })
  .strict();

export const channelLinkPageSchema = z
  .object({ items: z.array(channelLinkSchema).max(20) })
  .strict();

export const errorEnvelopeSchema = z
  .object({
    error: z
      .object({
        code: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
        message: z.string().min(1).max(512),
        correlation_id: z.string().min(1).max(128),
        details: jsonObject.nullable().optional(),
      })
      .strict(),
  })
  .strict();

export const chatExportRecordSchema = z
  .object({ type: z.literal("chat"), chat: chatSchema })
  .strict();

export const messageExportRecordSchema = z
  .object({ type: z.literal("message"), message: messageSchema })
  .strict();

export const completeExportRecordSchema = z
  .object({
    type: z.literal("complete"),
    message_count: z.number().int().min(0),
    content_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
