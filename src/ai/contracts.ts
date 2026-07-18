export const AI_PUBLIC_CONTRACT = {
  id: "C-AI-PUBLIC",
  version: "0.1.0",
} as const;

export type ChatStatus = "active" | "archived" | "deleted" | "access_changed";
export type RunStatus =
  | "awaiting_grant"
  | "queued"
  | "running"
  | "waiting_for_action"
  | "succeeded"
  | "failed"
  | "cancelled";
export type ActionStatus =
  | "prepared"
  | "awaiting_confirmation"
  | "executing"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

export type AuthContext = {
  accessToken: string;
  signal?: AbortSignal;
};

export type MutationContext = AuthContext & {
  idempotencyKey: string;
};

export type PatientSelection = {
  kind: "self" | "care";
  label: string;
};

export type Chat = {
  id: string;
  title: string | null;
  patient: PatientSelection;
  status: ChatStatus;
  created_at: string;
  updated_at: string;
  delete_after?: string | null;
};

export type ChatPage = {
  items: Chat[];
  next_cursor?: string | null;
};

export type Message = {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system_notice";
  channel: "app" | "web" | "whatsapp" | "system";
  content: string;
  created_at: string;
};

export type MessagePage = {
  items: Message[];
  next_cursor?: string | null;
};

export type Run = {
  id: string;
  chat_id: string;
  message_id: string;
  status: RunStatus;
  created_at: string;
  completed_at?: string | null;
  error_code?: string | null;
};

export type AcceptedMessage = {
  message: Message;
  run: Run;
};

export type ActionPreview = Record<string, unknown>;

export type PendingAction = {
  action_id: string;
  capability_id: string;
  preview: ActionPreview;
  expires_at: string;
};

type RunEventBase = {
  version: typeof AI_PUBLIC_CONTRACT.version;
  event_id: string;
  run_id: string;
  sequence: number;
  created_at: string;
};

export type RunEvent =
  | (RunEventBase & { type: "run.started" })
  | (RunEventBase & { type: "assistant.delta"; delta: string })
  | (RunEventBase & { type: "action.required"; action: PendingAction })
  | (RunEventBase & { type: "run.completed" })
  | (RunEventBase & { type: "run.failed"; error_code: string });

export type ActionDecisionRequest = {
  confirmation_ref: string;
  presented_preview_hash: string;
};

export type ChatAction = {
  id: string;
  chat_id: string;
  capability_id: string;
  status: ActionStatus;
  preview?: ActionPreview | null;
  expires_at: string;
};

export type LinkChallenge = {
  challenge_id: string;
  link_code: string;
  expires_at: string;
};

export type ChannelLink = {
  id: string;
  channel: "whatsapp";
  status: "active" | "revoking" | "revoked";
  display_hint?: string | null;
  created_at: string;
};

export type ChannelLinkPage = {
  items: ChannelLink[];
};

export type ChatExport = {
  mediaType: "application/x-ndjson";
  chunks: AsyncIterable<string>;
};

export interface AiPublicClient {
  createChat(
    context: MutationContext,
    request: { patient_selection_ref: string; title?: string },
  ): Promise<Chat>;
  listChats(context: AuthContext, status?: ChatStatus): Promise<ChatPage>;
  getChat(context: AuthContext, chatId: string): Promise<Chat>;
  listMessages(context: AuthContext, chatId: string, cursor?: string): Promise<MessagePage>;
  createMessage(
    context: AuthContext,
    chatId: string,
    request: { client_message_id: string; content: string; attachment_refs?: string[] },
  ): Promise<AcceptedMessage>;
  getRun(context: AuthContext, runId: string): Promise<Run>;
  streamRunEvents(
    context: AuthContext,
    runId: string,
    lastEventId?: number,
  ): AsyncIterable<RunEvent>;
  decideAction(
    context: MutationContext,
    chatId: string,
    actionId: string,
    decision: "confirm" | "cancel",
    request: ActionDecisionRequest,
  ): Promise<ChatAction>;
  createWhatsAppLinkChallenge(
    context: MutationContext,
    request: {
      locale: "pt-BR" | "en" | "es";
      relink_policy?: "reject" | "replace_after_confirmation";
    },
  ): Promise<LinkChallenge>;
  listChannelLinks(context: AuthContext): Promise<ChannelLinkPage>;
  revokeChannelLink(context: MutationContext, linkId: string): Promise<ChannelLink>;
  exportChat(context: AuthContext, chatId: string): Promise<ChatExport>;
}
