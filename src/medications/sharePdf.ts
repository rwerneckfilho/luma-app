import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { downloadMedicationListPdf } from "./api";

export class MedicationPdfSharingUnavailableError extends Error {}

export function medicationPdfFilename(lumaId: string, generatedAt = new Date()) {
  const safeLumaId = (lumaId || "luma").replace(/[^a-zA-Z0-9_-]/g, "-");
  return `luma-medications-${safeLumaId}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
}

export async function shareMedicationListPdf({
  accessToken,
  dialogTitle,
  lumaId,
}: {
  accessToken: string | null | undefined;
  dialogTitle: string;
  lumaId: string;
}) {
  const destination = new File(Paths.cache, medicationPdfFilename(lumaId));
  const uri = await downloadMedicationListPdf(accessToken, destination.uri);
  if (!await Sharing.isAvailableAsync()) throw new MedicationPdfSharingUnavailableError();
  await Sharing.shareAsync(uri, {
    dialogTitle,
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
  });
}
