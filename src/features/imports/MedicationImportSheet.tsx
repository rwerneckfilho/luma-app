import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useTranslation } from "react-i18next";
import { useParseMedicationFile, useParseMedicationText } from "../../medicationImports/hooks";
import type { MedicationImportItem } from "../../medicationImports/types";
import { colors, spacing } from "../../design/theme";
import { Body, Button, Card, Field, Sheet, StateMessage, nativeStyles } from "../shared/native";

const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const mimeTypeByExtension: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
  png: "image/png",
  webp: "image/webp",
};

export function medicationImportMimeType(name: string, provided?: string | null) {
  const normalized = provided?.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  if (normalized && acceptedTypes.includes(normalized)) return normalized;
  const extension = name.trim().toLowerCase().split(".").pop() ?? "";
  return mimeTypeByExtension[extension] ?? "application/octet-stream";
}

export function MedicationImportSheet({
  onClose,
  onSelect,
  visible,
}: {
  onClose: () => void;
  onSelect: (item: MedicationImportItem) => void;
  visible: boolean;
}) {
  const { t } = useTranslation();
  const parseText = useParseMedicationText();
  const parseFile = useParseMedicationFile();
  const [text, setText] = useState("");
  const draft = parseText.data ?? parseFile.data;

  const reset = () => {
    parseText.reset();
    parseFile.reset();
    setText("");
  };

  const chooseFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: acceptedTypes,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      parseText.reset();
      parseFile.reset();
      await parseFile.mutateAsync({
        name: asset.name,
        type: medicationImportMimeType(asset.name, asset.mimeType),
        uri: asset.uri,
      });
    } catch (error) {
      Alert.alert(t("medicationAi.analysisFailed"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  const submitText = async () => {
    if (!text.trim()) return;
    try {
      parseText.reset();
      parseFile.reset();
      await parseText.mutateAsync(text.trim());
    } catch (error) {
      Alert.alert(t("medicationAi.analysisFailed"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  const select = (item: MedicationImportItem) => {
    reset();
    onSelect(item);
  };

  return (
    <Sheet onClose={close} title={t("medicationAi.title")} visible={visible}>
      <Body muted>{t("medicationAi.description")}</Body>
      <Field
        label={t("medicationAi.textLabel")}
        multiline
        onChangeText={setText}
        placeholder={t("medicationAi.textPlaceholder")}
        value={text}
      />
      <View style={nativeStyles.actionRow}>
        <Button loading={parseText.isPending} onPress={() => void submitText()}>
          {t("medicationAi.analyze")}
        </Button>
        <Button loading={parseFile.isPending} onPress={() => void chooseFile()} secondary>
          {t("medicationAi.fileLabel")}
        </Button>
      </View>
      {parseText.isPending || parseFile.isPending ? (
        <StateMessage loading title={t("common.loading")} />
      ) : null}
      {draft ? (
        draft.items.length ? (
          draft.items.map((item) => (
            <Card key={item.temporary_id}>
              <View style={nativeStyles.rowBetween}>
                <Text style={styles.name}>{item.medication.display_name}</Text>
                <Text style={nativeStyles.badge}>{t(`medicationAi.confidence.${item.confidence}`)}</Text>
              </View>
              {item.medication.strength_text ? <Body>{item.medication.strength_text}</Body> : null}
              {item.usage.detected_pattern ? <Body muted>{item.usage.detected_pattern}</Body> : null}
              {item.missing_fields.length ? (
                <Body muted>{t("medicationAi.missing", { fields: item.missing_fields.join(", ") })}</Body>
              ) : null}
              {item.warnings.map((warning) => (
                <Text key={`${item.temporary_id}-${warning.code}`} style={styles.warning}>
                  {warning.message}
                </Text>
              ))}
              <Button onPress={() => select(item)}>{t("medicationAi.review")}</Button>
            </Card>
          ))
        ) : (
          <StateMessage title={t("medicationAi.found", { count: 0 })} />
        )
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: "800" },
  warning: { color: colors.warning, fontSize: 14, lineHeight: 20, marginTop: spacing.xs },
});
