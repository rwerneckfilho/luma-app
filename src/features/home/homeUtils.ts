import { getBulkMarkableMedicationItems } from "../../dailyMedications/dailyMedicationUtils";
import type { DailyMedicationItem } from "../../dailyMedications/types";

export function getHomeBulkMarkableItems(items: DailyMedicationItem[]) {
  return getBulkMarkableMedicationItems(items);
}

export function shouldShowBulkMarkTaken(items: DailyMedicationItem[]) {
  return getHomeBulkMarkableItems(items).length >= 2;
}
