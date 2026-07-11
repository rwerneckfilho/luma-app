import { useMemo, useState } from "react";
import { Alert, Share, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  useDeleteMedication,
  useMedications,
} from "../../medications/hooks";
import type { Medication } from "../../medications/types";
import { buildMedicationShareText } from "../../medications/shareList";
import {
  useCancelRoutine,
  useRoutineHistory,
  useRoutines,
  useUpdateRoutineStatus,
} from "../../routines/hooks";
import {
  formatDateRange,
  formatDose,
  formatRoutineStatus,
  formatScheduleSummary,
  formatTreatmentType,
  isRoutineVisibleInPrimaryList,
} from "../../routines/routineUtils";
import type { Routine } from "../../routines/types";
import { useUserProfile } from "../../me/hooks";
import type { MedicationImportItem } from "../../medicationImports/types";
import { colors, spacing } from "../../design/theme";
import {
  Body,
  Button,
  Card,
  Field,
  Screen,
  Section,
  Sheet,
  StateMessage,
  nativeStyles,
} from "../shared/native";
import { MedicationImportSheet } from "../imports/MedicationImportSheet";
import { MedicationEditorSheet } from "./MedicationEditorSheet";
import { RoutineEditorSheet } from "../routines/RoutineEditorSheet";

type EditorState =
  | { kind: "create"; draft?: MedicationImportItem }
  | { kind: "edit"; medication: Medication }
  | { kind: "routine"; medication: Medication }
  | null;

export function MedicationsScreen() {
  const { i18n, t } = useTranslation();
  const medications = useMedications();
  const routines = useRoutines();
  const profile = useUserProfile();
  const archive = useDeleteMedication();
  const cancelRoutine = useCancelRoutine();
  const updateStatus = useUpdateRoutineStatus();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [historyRoutine, setHistoryRoutine] = useState<Routine | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return (medications.data ?? []).filter(
      (medication) => !medication.is_archived && (!query || medication.name.toLocaleLowerCase().includes(query)),
    );
  }, [medications.data, search]);

  const routinesFor = (medicationId: string) =>
    (routines.data ?? []).filter(
      (routine) => routine.medication_id === medicationId && isRoutineVisibleInPrimaryList(routine),
    );

  const refresh = () => {
    void medications.refetch();
    void routines.refetch();
  };

  const shareList = async () => {
    const message = buildMedicationShareText({
      generatedAt: new Date(),
      items: filtered.map((medication) => ({ medication, routines: routinesFor(medication.id) })),
      locale: i18n.resolvedLanguage ?? "pt-BR",
      patientName: profile.data?.full_name,
      t,
    });
    await Share.share({ message, title: t("medications.shareList") });
  };

  const confirmArchive = (medication: Medication) => {
    Alert.alert(t("medications.archiveMedication"), t("medications.archiveBody", { name: medication.name }), [
      { style: "cancel", text: t("common.cancel") },
      {
        onPress: () => void archive.mutateAsync(medication.id).catch((error) =>
          Alert.alert(t("medications.couldNotArchive"), error instanceof Error ? error.message : t("common.somethingWentWrong")),
        ),
        style: "destructive",
        text: t("medications.archiveCta"),
      },
    ]);
  };

  const changeRoutineStatus = async (routine: Routine, status: "active" | "paused") => {
    try {
      await updateStatus.mutateAsync({ active: status === "active", routineId: routine.id, status });
    } catch (error) {
      Alert.alert(t("routines.unableToUpdateRoutine"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  const confirmCancel = (routine: Routine) => {
    Alert.alert(t("routines.cancelRoutine"), t("routines.cancelRoutineBody"), [
      { style: "cancel", text: t("routines.keepRoutine") },
      {
        onPress: () => void cancelRoutine.mutateAsync(routine.id).catch((error) =>
          Alert.alert(t("routines.unableToCancelRoutine"), error instanceof Error ? error.message : t("common.somethingWentWrong")),
        ),
        style: "destructive",
        text: t("routines.cancelRoutine"),
      },
    ]);
  };

  return (
    <Screen onRefresh={refresh} refreshing={medications.isRefetching || routines.isRefetching} title={t("medications.title")}>
      <Field label={t("medications.searchLabel")} onChangeText={setSearch} placeholder={t("medications.searchPlaceholder")} value={search} />
      <View style={nativeStyles.actionRow}>
        <Button onPress={() => setEditor({ kind: "create" })}>{t("medications.addCta")}</Button>
        <Button onPress={() => setImportVisible(true)} secondary>{t("medicationAi.title")}</Button>
        <Button onPress={() => void shareList()} secondary>{t("medications.share.share")}</Button>
      </View>
      {medications.isLoading || routines.isLoading ? <StateMessage loading title={t("medications.loading")} /> : null}
      {medications.isError || routines.isError ? (
        <StateMessage action={<Button onPress={refresh}>{t("common.tryAgain")}</Button>} title={t("medications.couldNotLoad")} />
      ) : null}
      {!medications.isLoading && filtered.length === 0 ? (
        <StateMessage body={search ? t("medications.noSearchResults") : t("medications.emptyBody")} title={search ? t("common.noResultsFound") : t("medications.emptyTitle")} />
      ) : null}
      <Section>
        {filtered.map((medication) => (
          <MedicationCard
            key={medication.id}
            medication={medication}
            onAddRoutine={() => setEditor({ kind: "routine", medication })}
            onArchive={() => confirmArchive(medication)}
            onCancelRoutine={confirmCancel}
            onEdit={() => setEditor({ kind: "edit", medication })}
            onEditRoutine={setEditingRoutine}
            onHistory={setHistoryRoutine}
            onPause={(routine) => void changeRoutineStatus(routine, "paused")}
            onReactivate={(routine) => void changeRoutineStatus(routine, "active")}
            routines={routinesFor(medication.id)}
          />
        ))}
      </Section>
      <MedicationEditorSheet
        aiDraft={editor?.kind === "create" ? editor.draft : null}
        medication={editor?.kind === "edit" ? editor.medication : null}
        onClose={() => setEditor(null)}
        routineMedication={editor?.kind === "routine" ? editor.medication : null}
        visible={Boolean(editor)}
      />
      <MedicationImportSheet
        onClose={() => setImportVisible(false)}
        onSelect={(draft) => {
          setImportVisible(false);
          setEditor({ draft, kind: "create" });
        }}
        visible={importVisible}
      />
      <RoutineEditorSheet
        defaultDoseUnit={editingRoutine ? medications.data?.find((item) => item.id === editingRoutine.medication_id)?.form : null}
        onClose={() => setEditingRoutine(null)}
        routine={editingRoutine}
      />
      <RoutineHistorySheet onClose={() => setHistoryRoutine(null)} routine={historyRoutine} />
    </Screen>
  );
}

function MedicationCard({
  medication,
  onAddRoutine,
  onArchive,
  onCancelRoutine,
  onEdit,
  onEditRoutine,
  onHistory,
  onPause,
  onReactivate,
  routines,
}: {
  medication: Medication;
  onAddRoutine: () => void;
  onArchive: () => void;
  onCancelRoutine: (routine: Routine) => void;
  onEdit: () => void;
  onEditRoutine: (routine: Routine) => void;
  onHistory: (routine: Routine) => void;
  onPause: (routine: Routine) => void;
  onReactivate: (routine: Routine) => void;
  routines: Routine[];
}) {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "pt-BR";
  return (
    <Card>
      <View style={nativeStyles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.name}>{medication.name}</Text>
          {medication.dosage_text ? <Body muted>{medication.dosage_text}</Body> : null}
        </View>
        <Text style={nativeStyles.badge}>{t("medications.intakes", { count: routines.length })}</Text>
      </View>
      {medication.medication_reason ? <Body>{medication.medication_reason}</Body> : null}
      {medication.prescribing_doctor_name ? <Body muted>{medication.prescribing_doctor_name}</Body> : null}
      {routines.length ? routines.map((routine) => (
        <Card key={routine.id} style={styles.routineCard}>
          <View style={nativeStyles.rowBetween}>
            <Text style={styles.routineTitle}>{routine.title || t("routines.routine")}</Text>
            <Text style={nativeStyles.badge}>{formatRoutineStatus(t, routine)}</Text>
          </View>
          <Body>{formatTreatmentType(t, routine.treatment_type)}{formatDose(t, routine, medication.form) ? ` • ${formatDose(t, routine, medication.form)}` : ""}</Body>
          {(routine.schedules ?? []).map((schedule, index) => <Body key={schedule.id ?? index} muted>{formatScheduleSummary(t, schedule, medication.form)}</Body>)}
          {formatDateRange(t, locale, routine.start_date, routine.end_date) ? <Body muted>{formatDateRange(t, locale, routine.start_date, routine.end_date)}</Body> : null}
          <View style={nativeStyles.actionRow}>
            <Button onPress={() => onEditRoutine(routine)} secondary>{t("medications.editIntake")}</Button>
            <Button onPress={() => onHistory(routine)} secondary>{t("routines.viewHistory")}</Button>
            {routine.status === "paused" ? (
              <Button onPress={() => onReactivate(routine)} secondary>{t("medications.reactivateIntake")}</Button>
            ) : (
              <Button onPress={() => onPause(routine)} secondary>{t("medications.pauseIntake")}</Button>
            )}
            <Button danger onPress={() => onCancelRoutine(routine)}>{t("medications.cancelIntake")}</Button>
          </View>
        </Card>
      )) : <Body muted>{t("medications.noIntakesConfigured")}</Body>}
      <View style={nativeStyles.actionRow}>
        <Button onPress={onAddRoutine}>{t("medications.addIntake")}</Button>
        <Button onPress={onEdit} secondary>{t("medications.edit")}</Button>
        <Button danger onPress={onArchive}>{t("medications.archive")}</Button>
      </View>
    </Card>
  );
}

function RoutineHistorySheet({ onClose, routine }: { onClose: () => void; routine: Routine | null }) {
  const { t } = useTranslation();
  const history = useRoutineHistory(routine?.id, Boolean(routine));
  return (
    <Sheet onClose={onClose} title={t("routines.routineHistory")} visible={Boolean(routine)}>
      {history.isLoading ? <StateMessage loading title={t("routines.loading")} /> : null}
      {history.isError ? <StateMessage title={t("routines.couldNotLoad")} /> : null}
      {(history.data ?? []).map((version) => (
        <Card key={version.id}>
          <View style={nativeStyles.rowBetween}>
            <Text style={styles.routineTitle}>{t("routines.currentVersion", { version: version.version })}</Text>
            <Text style={nativeStyles.badge}>{formatRoutineStatus(t, version)}</Text>
          </View>
          <Body>{formatTreatmentType(t, version.treatment_type)}</Body>
          {version.updated_by_display_name ? <Body muted>{t("routines.updatedByName", { name: version.updated_by_display_name })}</Body> : null}
        </Card>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  name: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  routineCard: { backgroundColor: colors.background, marginTop: spacing.xs },
  routineTitle: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: "800" },
});
