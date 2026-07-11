export type CareRelationshipType =
  | "child"
  | "parent"
  | "spouse"
  | "family"
  | "caregiver"
  | "legal_guardian"
  | "health_professional"
  | "other";

export type CareRelationshipStatus = "pending" | "accepted" | "declined" | "expired" | "revoked";

export type CareDurationType = "indefinite" | "until_date";

export type CareInviteBlockReason = "self" | "pending_invite" | "active_caregiver";

export type CarePublicUser = {
  luma_id: string;
  display_name: string;
  invite_block_reason?: CareInviteBlockReason | null;
};

export type ScopedMedication = {
  id: string;
  name: string;
  dosage?: string | null;
};

export type CareRoutineMedication = {
  dosage_text?: string | null;
  form?: string | null;
  id: string;
  name: string;
};

export type CareRelationship = {
  id: string;
  patient_user_id: string;
  caregiver_user_id: string;
  patient_luma_id: string;
  caregiver_luma_id: string;
  patient_display_name: string;
  caregiver_display_name: string;
  patient_profile_photo_path?: string | null;
  caregiver_profile_photo_path?: string | null;
  relationship_type: CareRelationshipType;
  status: CareRelationshipStatus;
  invite_expires_at: string;
  valid_from?: string | null;
  valid_until?: string | null;
  duration_type: CareDurationType;
  invited_by_user_id: string;
  invited_at: string;
  accepted_at?: string | null;
  declined_at?: string | null;
  expired_at?: string | null;
  revoked_at?: string | null;
  revoked_by_user_id?: string | null;
  revoked_by_role?: "patient" | "caregiver" | null;
  revoked_reason?: string | null;
  created_at: string;
  updated_at: string;
  allow_receive_together: boolean;
  allow_receive_overdue: boolean;
  allow_mark_patient_taken: boolean;
  allow_skip_patient_dose: boolean;
  allow_manage_routines: boolean;
  allow_view_timeline: boolean;
  caregiver_notification_mode: "none" | "together" | "overdue_only";
  permissions_updated_at?: string | null;
  permissions_updated_by_user_id?: string | null;
  preferences_updated_at?: string | null;
  preferences_updated_by_user_id?: string | null;

  // Scoping and Validity (P1.5 Phase 3)
  medication_scope: "all_medications" | "selected_medications";
  scoped_medications: ScopedMedication[];
  is_active: boolean;
  inactive_reason?: "not_accepted" | "not_started" | "expired" | "revoked" | "declined" | null;
};

export type CarePermissionsPayload = {
  allow_receive_together: boolean;
  allow_receive_overdue: boolean;
  allow_mark_patient_taken: boolean;
  allow_skip_patient_dose: boolean;
  allow_manage_routines: boolean;
  allow_view_timeline: boolean;
};

export type CarePreferencesPayload = {
  notification_mode: "none" | "together" | "overdue_only";
};

export type CareScopePayload = {
  medication_scope: "all_medications" | "selected_medications";
  medication_ids: string[];
};

export type CareRelationshipCreatePayload = {
  caregiver_luma_id: string;
  relationship_type: CareRelationshipType;
  duration_type: CareDurationType;
  valid_until?: string | null;
  permissions: CarePermissionsPayload;
  scope: CareScopePayload;
};

export type CareRelationshipCreateResult = CareRelationship & {
  whatsapp_invitation?: {
    status: "skipped" | "sent" | "failed";
    provider_message_id?: string | null;
    dry_run: boolean;
    reason?: string | null;
  } | null;
};

export type CareRelationshipRevokePayload = {
  reason?: string | null;
};

export type CareRelationshipsList = {
  sent: CareRelationship[];
  received: CareRelationship[];
};

export type CareInvitationsList = {
  invitations: CareRelationship[];
};

export type CareRelationshipRoutines = {
  medications: CareRoutineMedication[];
  patient_display_name: string;
  patient_user_id: string;
  relationship_id: string;
  routines: import("../routines/types").Routine[];
};

export const careRelationshipTypes: CareRelationshipType[] = [
  "child",
  "parent",
  "spouse",
  "family",
  "caregiver",
  "legal_guardian",
  "health_professional",
  "other",
];
