import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { parseMedicationFile, parseMedicationText, type NativeUploadFile } from "./api";

export function useParseMedicationText() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (text: string) => parseMedicationText(accessToken, text),
  });
}

export function useParseMedicationFile() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (file: NativeUploadFile) => parseMedicationFile(accessToken, file),
  });
}
