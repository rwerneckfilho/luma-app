import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Archive, ChevronDown, ChevronRight, CirclePause, CirclePlay, ClipboardCopy, History, Pencil, Plus, Share2, XCircle } from "lucide-react-native";
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
  const [expandedMedicationIds, setExpandedMedicationIds] = useState<Set<string>>(new Set());
  const [sharePreview, setSharePreview] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const activeMedications = useMemo(
    () => (medications.data ?? []).filter((medication) => !medication.is_archived),
    [medications.data],
  );

  const filtered = useMemo(() => {
    const query = normalizeSearchText(search);
    if (!query) return activeMedications;
    return activeMedications.filter((medication) => {
      const medicationRoutines = (routines.data ?? []).filter(
        (routine) => routine.medication_id === medication.id && isRoutineVisibleInPrimaryList(routine),
      );
      const searchable = [
        medication.name,
        medication.dosage_text,
        medication.form,
        medication.medication_reason,
        medication.prescribing_doctor_name,
        medication.notes,
        ...medicationRoutines.flatMap((routine) => [
          routine.title,
          routine.instructions,
          formatRoutineStatus(t, routine),
          formatTreatmentType(t, routine.treatment_type),
          formatDose(t, routine, medication.form),
          ...(routine.schedules ?? []).map((schedule) => formatScheduleSummary(t, schedule, medication.form)),
        ]),
      ];
      return normalizeSearchText(searchable.filter(Boolean).join(" ")).includes(query);
    });
  }, [activeMedications, routines.data, search, t]);

  const routinesFor = (medicationId: string) =>
    (routines.data ?? []).filter(
      (routine) => routine.medication_id === medicationId && isRoutineVisibleInPrimaryList(routine),
    );

  const queriesReady = medications.isSuccess && routines.isSuccess && profile.isSuccess;

  useEffect(() => {
    if (!filtered.length) return;
    setExpandedMedicationIds((current) => current.size ? current : new Set([filtered[0].id]));
  }, [filtered]);

  const refresh = () => {
    void medications.refetch();
    void routines.refetch();
  };

  const buildFullShareText = () => buildMedicationShareText({
      generatedAt: new Date(),
      items: activeMedications.map((medication) => ({ medication, routines: routinesFor(medication.id) })),
      locale: i18n.resolvedLanguage ?? "pt-BR",
      patientName: profile.data?.full_name,
      t,
    });

  const shareList = async () => {
    await Share.share({ message: sharePreview ?? buildFullShareText(), title: t("medications.shareList") });
    setShareFeedback(t("medications.share.shared"));
  };

  const copyList = async () => {
    try {
      await Clipboard.setStringAsync(sharePreview ?? buildFullShareText());
      setShareFeedback(t("medications.share.copied"));
    } catch {
      setShareFeedback(t("medications.share.copyFailed"));
    }
  };

  const toggleMedication = (medicationId: string) => {
    setExpandedMedicationIds((current) => {
      const next = new Set(current);
      if (next.has(medicationId)) next.delete(medicationId);
      else next.add(medicationId);
      return next;
    });
  };

  const confirmArchive = (medication: Medication) => {
    Alert.alert(t("medications.archiveMedication"), t("medications.archiveBody", { name: medication.name }), [
      { style: "cancel", text: t("common.cancel") },
      {
        onPress: () => void runAction(`archive:${medication.id}`, () => archive.mutateAsync(medication.id), t("medications.couldNotArchive")),
        style: "destructive",
        text: t("medications.archiveCta"),
      },
    ]);
  };

  const runAction = async (key: string, action: () => Promise<unknown>, errorTitle: string) => {
    setPendingAction(key);
    try {
      await action();
    } catch (error) {
      Alert.alert(errorTitle, error instanceof Error ? error.message : t("common.somethingWentWrong"));
    } finally {
      setPendingAction(null);
    }
  };

  const confirmStatus = (routine: Routine, status: "active" | "paused") => {
    const reactivating = status === "active";
    Alert.alert(
      reactivating ? t("medications.reactivateIntake") : t("medications.pauseIntake"),
      routine.title || t("routines.routine"),
      [
        { style: "cancel", text: t("common.cancel") },
        { text: reactivating ? t("medications.reactivateIntake") : t("medications.pauseIntake"), onPress: () => void runAction(`status:${routine.id}`, () => updateStatus.mutateAsync({ active: reactivating, routineId: routine.id, status }), t("routines.unableToUpdateRoutine")) },
      ],
    );
  };

  const confirmCancel = (routine: Routine) => {
    Alert.alert(t("routines.cancelRoutine"), t("routines.cancelRoutineBody"), [
      { style: "cancel", text: t("routines.keepRoutine") },
      {
        onPress: () => void runAction(`cancel:${routine.id}`, () => cancelRoutine.mutateAsync(routine.id), t("routines.unableToCancelRoutine")),
        style: "destructive",
        text: t("routines.cancelRoutine"),
      },
    ]);
  };

  return (
    <Screen onRefresh={refresh} refreshing={medications.isRefetching || routines.isRefetching} title={t("medications.title")}>
      <Field label={t("medications.searchLabel")} onChangeText={setSearch} placeholder={t("medications.searchPlaceholder")} value={search} />
      <View style={nativeStyles.actionRow}>
        <Button icon={Plus} onPress={() => setEditor({ kind: "create" })}>{t("medications.addCta")}</Button>
        <Button disabled={!queriesReady} icon={Share2} onPress={() => { setShareFeedback(null); setSharePreview(buildFullShareText()); }} secondary>{t("medications.share.share")}</Button>
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
            expanded={expandedMedicationIds.has(medication.id)}
            medication={medication}
            onAddRoutine={() => setEditor({ kind: "routine", medication })}
            onArchive={() => confirmArchive(medication)}
            onCancelRoutine={confirmCancel}
            onEdit={() => setEditor({ kind: "edit", medication })}
            onEditRoutine={setEditingRoutine}
            onHistory={setHistoryRoutine}
            onPause={(routine) => confirmStatus(routine, "paused")}
            onReactivate={(routine) => confirmStatus(routine, "active")}
            onToggle={() => toggleMedication(medication.id)}
            routines={routinesFor(medication.id)}
            pendingAction={pendingAction}
          />
        ))}
      </Section>
      <MedicationEditorSheet
        aiDraft={editor?.kind === "create" ? editor.draft : null}
        medication={editor?.kind === "edit" ? editor.medication : null}
        onClose={() => setEditor(null)}
        onRequestAi={() => setImportVisible(true)}
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
      <Sheet onClose={() => setSharePreview(null)} title={t("medications.share.title")} visible={Boolean(sharePreview)}>
        <Body muted>{t("medications.share.previewBody")}</Body>
        <View style={styles.sharePreview}>
          <Text selectable style={styles.sharePreviewText}>{sharePreview}</Text>
        </View>
        <View style={nativeStyles.actionRow}>
          <Button icon={ClipboardCopy} onPress={() => void copyList()} secondary>{t("medications.share.copy")}</Button>
          <Button icon={Share2} onPress={() => void shareList()}>{t("medications.share.share")}</Button>
        </View>
        {shareFeedback ? <Text accessibilityLiveRegion="polite" style={styles.feedback}>{shareFeedback}</Text> : null}
      </Sheet>
    </Screen>
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

function MedicationCard({
  expanded,
  medication,
  onAddRoutine,
  onArchive,
  onCancelRoutine,
  onEdit,
  onEditRoutine,
  onHistory,
  onPause,
  onReactivate,
  onToggle,
  routines,
  pendingAction,
}: {
  expanded: boolean;
  medication: Medication;
  onAddRoutine: () => void;
  onArchive: () => void;
  onCancelRoutine: (routine: Routine) => void;
  onEdit: () => void;
  onEditRoutine: (routine: Routine) => void;
  onHistory: (routine: Routine) => void;
  onPause: (routine: Routine) => void;
  onReactivate: (routine: Routine) => void;
  onToggle: () => void;
  routines: Routine[];
  pendingAction: string | null;
}) {
  const { i18n, t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "pt-BR";
  const [expandedRoutineIds, setExpandedRoutineIds] = useState<Set<string>>(new Set());
  const toggleRoutine = (id: string) => setExpandedRoutineIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.accordionHeader}
      >
        <View style={styles.flex}>
          <Text style={styles.name}>{medication.name}</Text>
          {medication.dosage_text ? <Body muted>{medication.dosage_text}</Body> : null}
        </View>
        <Text style={nativeStyles.badge}>{t("medications.intakes", { count: routines.length })}</Text>
        {expanded ? <ChevronDown color={colors.ink} size={22} /> : <ChevronRight color={colors.ink} size={22} />}
      </Pressable>
      {expanded ? <>
        {medication.medication_reason ? <Body>{medication.medication_reason}</Body> : null}
        {medication.prescribing_doctor_name ? <Body muted>{medication.prescribing_doctor_name}</Body> : null}
        {routines.length ? routines.map((routine) => {
        const routineExpanded = expandedRoutineIds.has(routine.id);
        const routineBusy = pendingAction?.endsWith(`:${routine.id}`) ?? false;
        return (
        <Card key={routine.id} style={styles.routineCard}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: routineExpanded }} onPress={() => toggleRoutine(routine.id)} style={nativeStyles.rowBetween}>
            <Text style={styles.routineTitle}>{routine.title || t("routines.routine")}</Text>
            <Text style={nativeStyles.badge}>{formatRoutineStatus(t, routine)}</Text>
            {routineExpanded ? <ChevronDown color={colors.ink} size={20} /> : <ChevronRight color={colors.ink} size={20} />}
          </Pressable>
          <Body>{formatTreatmentType(t, routine.treatment_type)}{formatDose(t, routine, medication.form) ? ` • ${formatDose(t, routine, medication.form)}` : ""}</Body>
          {routineExpanded ? <>
          {(routine.schedules ?? []).map((schedule, index) => <Body key={schedule.id ?? index} muted>{formatScheduleSummary(t, schedule, medication.form)}</Body>)}
          {routine.instructions ? <Body muted>{routine.instructions}</Body> : null}
          {formatDateRange(t, locale, routine.start_date, routine.end_date) ? <Body muted>{formatDateRange(t, locale, routine.start_date, routine.end_date)}</Body> : null}
          <View style={nativeStyles.actionRow}>
            <Button disabled={routineBusy} icon={Pencil} onPress={() => onEditRoutine(routine)} secondary>{t("medications.editIntake")}</Button>
            <Button disabled={routineBusy} icon={History} onPress={() => onHistory(routine)} secondary>{t("routines.viewHistory")}</Button>
            {routine.status === "paused" ? (
              <Button icon={CirclePlay} loading={pendingAction === `status:${routine.id}`} onPress={() => onReactivate(routine)} secondary>{t("medications.reactivateIntake")}</Button>
            ) : (
              <Button icon={CirclePause} loading={pendingAction === `status:${routine.id}`} onPress={() => onPause(routine)} secondary>{t("medications.pauseIntake")}</Button>
            )}
            <Button danger icon={XCircle} loading={pendingAction === `cancel:${routine.id}`} onPress={() => onCancelRoutine(routine)}>{t("medications.cancelIntake")}</Button>
          </View>
          </> : null}
        </Card>
        );}) : <Body muted>{t("medications.noIntakesConfigured")}</Body>}
        <View style={nativeStyles.actionRow}>
          <Button onPress={onAddRoutine}>{t("medications.addIntake")}</Button>
          <Button onPress={onEdit} secondary>{t("medications.edit")}</Button>
          <Button danger icon={Archive} loading={pendingAction === `archive:${medication.id}`} onPress={onArchive}>{t("medications.archive")}</Button>
        </View>
      </> : null}
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
  accordionHeader: { alignItems: "center", flexDirection: "row", gap: spacing.sm, minHeight: 48 },
  flex: { flex: 1 },
  feedback: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  name: { color: colors.ink, fontSize: 21, fontWeight: "800" },
  routineCard: { backgroundColor: colors.background, marginTop: spacing.xs },
  routineTitle: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: "800" },
  sharePreview: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, padding: spacing.md },
  sharePreviewText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
});
