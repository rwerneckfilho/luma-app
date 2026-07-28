import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { downloadMedicationListPdf } from "./api";
import {
  MedicationPdfSharingUnavailableError,
  medicationPdfFilename,
  shareMedicationListPdf,
} from "./sharePdf";

jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation((directory: string, name: string) => ({ uri: `${directory}/${name}` })),
  Paths: { cache: "file://cache" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("./api", () => ({ downloadMedicationListPdf: jest.fn() }));

const mockedDownload = jest.mocked(downloadMedicationListPdf);
const mockedSharing = jest.mocked(Sharing);

describe("medication PDF sharing", () => {
  beforeEach(() => jest.clearAllMocks());

  it("uses a safe, date-stamped cache filename", () => {
    expect(medicationPdfFilename("LUMA / 123", new Date("2026-07-28T12:00:00Z")))
      .toBe("luma-medications-LUMA---123-2026-07-28.pdf");
  });

  it("downloads to cache and opens the native PDF share sheet", async () => {
    mockedDownload.mockResolvedValue("file://cache/luma-medications-LUMA-1-2026-07-28.pdf");
    mockedSharing.isAvailableAsync.mockResolvedValue(true);

    await shareMedicationListPdf({ accessToken: "token", dialogTitle: "Medication list", lumaId: "LUMA-1" });

    expect(File).toHaveBeenCalledWith("file://cache", expect.stringContaining("luma-medications-LUMA-1-"));
    expect(mockedDownload).toHaveBeenCalledWith("token", expect.stringContaining("luma-medications-LUMA-1-"));
    expect(mockedSharing.shareAsync).toHaveBeenCalledWith(
      "file://cache/luma-medications-LUMA-1-2026-07-28.pdf",
      expect.objectContaining({ mimeType: "application/pdf", UTI: "com.adobe.pdf" }),
    );
  });

  it("reports devices where native file sharing is unavailable", async () => {
    mockedDownload.mockResolvedValue("file://cache/list.pdf");
    mockedSharing.isAvailableAsync.mockResolvedValue(false);

    await expect(shareMedicationListPdf({ accessToken: "token", dialogTitle: "List", lumaId: "LUMA-1" }))
      .rejects.toBeInstanceOf(MedicationPdfSharingUnavailableError);
    expect(mockedSharing.shareAsync).not.toHaveBeenCalled();
  });
});
