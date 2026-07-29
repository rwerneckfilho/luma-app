import type { DailyMedicationItem } from "../dailyMedications/types";
import type { Medication } from "../medications/types";
import type { Routine } from "../routines/types";
import { VISUAL_NOW_ISO, VISUAL_TIME_ZONE } from "./clock";
import type { VisualFixture, VisualScenario, VisualScenarioName } from "./types";

const userId = "00000000-0000-4000-8000-000000000001";
const medicationIds = {
  losartan: "00000000-0000-4000-8000-000000000101",
  metformin: "00000000-0000-4000-8000-000000000102",
  dipyrone: "00000000-0000-4000-8000-000000000103",
} as const;

const medications: Medication[] = [
  { id: medicationIds.losartan, user_id: userId, name: "Losartana", normalized_name: "losartana", dosage_text: "50 mg", form: "comprimido", medication_reason: "Pressão arterial", notes: "Tomar com água", prescribing_doctor_name: "Dra. Ana Lima", is_archived: false },
  { id: medicationIds.metformin, user_id: userId, name: "Metformina", normalized_name: "metformina", dosage_text: "850 mg", form: "comprimido", medication_reason: "Diabetes", notes: null, prescribing_doctor_name: "Dr. Caio Alves", is_archived: false },
  { id: medicationIds.dipyrone, user_id: userId, name: "Dipirona", normalized_name: "dipirona", dosage_text: "500 mg", form: "comprimido", medication_reason: "Dor ou febre", notes: "Usar se necessário", prescribing_doctor_name: null, is_archived: false },
];

const routines: Routine[] = medications.map((medication, index) => ({
  active: true,
  as_needed_limits: index === 2 ? { behavior: "warn", max_uses_per_period: 4, min_interval_minutes: 360, period_minutes: 1440 } : null,
  dose_quantity: 1,
  dose_unit: "comprimido",
  end_date: null,
  id: `00000000-0000-4000-8000-00000000020${index + 1}`,
  instructions: medication.notes,
  is_current: true,
  medication_id: medication.id,
  routine_group_id: `00000000-0000-4000-8000-00000000030${index + 1}`,
  schedules: index === 2 ? [] : [{ id: `schedule-${index + 1}`, is_active: true, schedule_type: "daily", time_of_day: index === 0 ? "08:00:00" : "13:00:00" }],
  start_date: "2026-01-01",
  status: "active",
  title: index === 2 ? "Quando sentir dor" : "Uso diário",
  treatment_type: index === 2 ? "as_needed" : "continuous",
  user_id: userId,
  version: 1,
}));

function dose(index: 0 | 1, status: DailyMedicationItem["status"]): DailyMedicationItem {
  const medication = medications[index];
  const routine = routines[index];
  const taken = status === "taken";
  return {
    allowed_taken_options: ["on_time", "now", "manual"], can_skip: true, can_mark_taken: !taken,
    dose_quantity: 1, dose_unit: "comprimido", dosage_text: medication.dosage_text,
    event_id: `visual-event-${index + 1}`, form: medication.form, medication_id: medication.id,
    medication_name: medication.name, routine_group_id: routine.routine_group_id, routine_id: routine.id,
    routine_version: 1, schedule_id: `schedule-${index + 1}`,
    scheduled_for: index === 0 ? "2026-06-18T08:00:00-03:00" : "2026-06-18T13:00:00-03:00",
    status, taken_at: taken ? "2026-06-18T08:03:00-03:00" : null,
    taken_mode: taken ? "on_time" : null, treatment_type: "continuous",
  };
}

const profile = {
  id: userId, email: "marina.visual@example.test", full_name: "Marina Oliveira", luma_id: "LUMA-2048",
  profile_photo_path: "", phone_e164: "+5511999999999", whatsapp_delivery_phone_e164: "+5511999999999",
  whatsapp_delivery_phone_verified_at: "2026-01-05T12:00:00-03:00", whatsapp_delivery_phone_verification_method: "with_9",
  locale: "pt-BR", timezone: VISUAL_TIME_ZONE, status: "active",
  onboarding: { completed: true, whatsapp_verification_required: true, whatsapp_verified: true, sample_reminder_sent_at: "2026-01-05T12:05:00-03:00" },
} as const;

const fullDashboard = {
  date: "2026-06-18", items: [dose(0, "taken"), dose(1, "upcoming")], next_scheduled_for: "2026-06-18T13:00:00-03:00",
  progress_percent: 50, server_now: VISUAL_NOW_ISO, timezone: VISUAL_TIME_ZONE, total_scheduled: 2, total_taken: 1,
};

const base: VisualFixture = {
  session: { accessToken: "visual-access-token", refreshToken: "visual-refresh-token", expiresAt: 1781809200, userId },
  profile,
  dashboard: fullDashboard,
  medications,
  routines,
  history: {
    date_from: "2026-06-12", date_to: "2026-06-18", server_now: VISUAL_NOW_ISO, timezone: VISUAL_TIME_ZONE,
    summary: { adherence_percent: 80, total_overdue: 1, total_scheduled: 5, total_skipped: 0, total_taken: 4, total_taken_late: 1 },
    items: [
      { ...dose(0, "taken"), prescribing_doctor_name: "Dra. Ana Lima", taken_source: "app" },
      { ...dose(1, "overdue"), event_id: "visual-history-overdue", scheduled_for: "2026-06-17T13:00:00-03:00", prescribing_doctor_name: "Dr. Caio Alves" },
    ],
  },
  asNeededUsageLogs: [{ id: "visual-prn-log-1", medication_id: medicationIds.dipyrone, medication_name: "Dipirona", routine_id: routines[2].id, dose_quantity: 1, dose_unit: "comprimido", note: "Dor de cabeça", used_at: "2026-06-17T19:30:00-03:00", created_at: "2026-06-17T19:30:10-03:00" }],
  care: {
    sent: [{ id: "visual-care-1", patient_user_id: userId, caregiver_user_id: "00000000-0000-4000-8000-000000000002", patient_luma_id: "LUMA-2048", caregiver_luma_id: "LUMA-4096", patient_display_name: "Marina Oliveira", caregiver_display_name: "Paulo Oliveira", relationship_type: "spouse", status: "accepted", invite_expires_at: "2026-12-31T23:59:59-03:00", duration_type: "indefinite", invited_by_user_id: userId, invited_at: "2026-01-10T10:00:00-03:00", accepted_at: "2026-01-10T10:10:00-03:00", created_at: "2026-01-10T10:00:00-03:00", updated_at: "2026-01-10T10:10:00-03:00", allow_receive_together: true, allow_receive_overdue: true, allow_mark_patient_taken: true, allow_skip_patient_dose: false, allow_manage_routines: false, allow_view_timeline: true, caregiver_notification_mode: "overdue_only", medication_scope: "all_medications", scoped_medications: [], is_active: true }],
    received: [],
  },
  notificationPreferences: { app_notifications_enabled: true, whatsapp_notifications_enabled: true, notification_mode: "both", app_ready: true, whatsapp_ready: true, whatsapp_verified: true, active_push_subscriptions: 1, active_native_push_subscriptions: 1, effective_channels: ["app_push", "whatsapp"] },
  whatsappChallenge: null,
};

const scenarios: Record<VisualScenarioName, VisualScenario> = {
  auth: { name: "auth", initialRoute: "/(auth)/login", fixture: { ...base, session: null, profile: null } },
  whatsapp: { name: "whatsapp", initialRoute: "/whatsapp-verification", fixture: { ...base, profile: { ...profile, whatsapp_delivery_phone_verified_at: null, onboarding: { ...profile.onboarding, whatsapp_verified: false } }, whatsappChallenge: { verification_id: "visual-whatsapp-1", status: "pending", expires_at: "2026-06-18T12:10:00-03:00", cooldown_seconds: 30, resend_available_at: "2026-06-18T12:00:30-03:00", fallback_available_at: "2026-06-18T12:02:00-03:00", candidates_sent: ["with_9", "without_9"], fallback_url: "https://wa.me/5511999999999" } } },
  "home-full": { name: "home-full", initialRoute: "/(app)/home", fixture: base },
  "home-empty": { name: "home-empty", initialRoute: "/(app)/home", fixture: { ...base, dashboard: { ...fullDashboard, items: [], next_scheduled_for: null, progress_percent: 0, total_scheduled: 0, total_taken: 0 }, routines: [], medications: [] } },
  "home-prn": { name: "home-prn", initialRoute: "/(app)/home", fixture: { ...base, dashboard: { ...fullDashboard, items: [], next_scheduled_for: null, progress_percent: 0, total_scheduled: 0, total_taken: 0 }, routines: [routines[2]], medications: [medications[2]] } },
  medications: { name: "medications", initialRoute: "/(app)/medications", fixture: base },
  history: { name: "history", initialRoute: "/(app)/history", fixture: base },
  care: { name: "care", initialRoute: "/(app)/caregivers", fixture: base },
  profile: { name: "profile", initialRoute: "/(app)/profile", fixture: base },
};

export const visualScenarios = Object.freeze(scenarios);

export function getVisualScenario(name: string): VisualScenario {
  const scenario = visualScenarios[name as VisualScenarioName];
  if (!scenario) throw new Error(`Unknown visual scenario: ${name}`);
  return scenario;
}

