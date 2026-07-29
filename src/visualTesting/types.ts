import type { AsNeededUsageLog } from "../asNeededUsageLogs/types";
import type { CareRelationshipsList } from "../care/types";
import type { DailyMedicationDashboard } from "../dailyMedications/types";
import type { AdherenceHistory } from "../history/types";
import type { Medication } from "../medications/types";
import type { NotificationPreferences, UserProfile, WhatsAppVerificationStartResponse } from "../me/types";
import type { Routine } from "../routines/types";

export type VisualScenarioName =
  | "auth"
  | "whatsapp"
  | "home-full"
  | "home-empty"
  | "home-prn"
  | "medications"
  | "history"
  | "care"
  | "profile";

export type VisualSession = Readonly<{
  accessToken: string;
  expiresAt: number;
  refreshToken: string;
  userId: string;
}>;

export type VisualFixture = Readonly<{
  asNeededUsageLogs: readonly AsNeededUsageLog[];
  care: CareRelationshipsList;
  dashboard: DailyMedicationDashboard;
  history: AdherenceHistory;
  medications: readonly Medication[];
  notificationPreferences: NotificationPreferences;
  profile: UserProfile | null;
  routines: readonly Routine[];
  session: VisualSession | null;
  whatsappChallenge: WhatsAppVerificationStartResponse | null;
}>;

export type VisualScenario = Readonly<{
  initialRoute: string;
  name: VisualScenarioName;
  fixture: VisualFixture;
}>;

