import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/useAuth";
import {
  useAcceptCareInvitation,
  useCareInvitations,
  useCareRelationshipRoutines,
  useCareRelationships,
  useCreateCareRelationship,
  useDeclineCareInvitation,
  useLookupCareUserByLumaId,
  useRevokeCareRelationship,
  useUpdateCaregiverRoutine,
  useUpdateCarePermissions,
  useUpdateCarePreferences,
  useUpdateCareScope,
} from "../../care/hooks";
import { useCareTimeline, useCareTimelineFilters } from "../../care/timelineHooks";
import type {
  CarePermissionsPayload,
  CarePublicUser,
  CareRelationship,
  CareRelationshipType,
  CareScopePayload,
} from "../../care/types";
import { careRelationshipTypes } from "../../care/types";
import { useMedications } from "../../medications/hooks";
import {
  dateDaysAgo,
  formatAsNeededUsageDateTime,
  formatHistoryDate,
  formatHistoryTime,
  getHistoryStatusLabelKey,
  getTimelineDescription,
  toDateInputValue,
} from "../../history/historyUtils";
import type { AdherenceHistoryStatus } from "../../history/types";
import type { CareTimelineFilters } from "../../care/timelineTypes";
import { colors } from "../../design/theme";
import { createProfilePhotoSignedUrl } from "../../profilePhotos/native";
import { Accordion, Badge, Body, Button, Card, Choice, Field, Label, Screen, Section, StateMessage, ToggleRow, nativeStyles } from "../shared/native";
import { RoutineEditorSheet } from "../routines/RoutineEditorSheet";
import type { Routine } from "../../routines/types";
import {
  isCarePreferenceAllowed,
  normalizeCarePreference,
  normalizeCareScope,
  permissionsFromRelationship,
  persistCareAccess,
  validateCareInvite,
  validateDateRange,
} from "./careFormUtils";

const defaultPermissions: CarePermissionsPayload = {
  allow_manage_routines: false,
  allow_mark_patient_taken: false,
  allow_receive_overdue: false,
  allow_receive_together: false,
  allow_skip_patient_dose: false,
  allow_view_timeline: false,
};

export function CareScreen() {
  const { t } = useTranslation();
  const relationships = useCareRelationships();
  const invitations = useCareInvitations();
  const accept = useAcceptCareInvitation();
  const decline = useDeclineCareInvitation();

  const refresh = () => {
    void relationships.refetch();
    void invitations.refetch();
  };

  const respond = async (relationship: CareRelationship, accepted: boolean) => {
    try {
      if (accepted) await accept.mutateAsync(relationship.id);
      else await decline.mutateAsync(relationship.id);
    } catch (error) {
      Alert.alert(t("settings.careInviteActionFailed"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  const sent = relationships.data?.sent ?? [];
  const received = relationships.data?.received ?? [];

  return (
    <Screen onRefresh={refresh} refreshing={relationships.isRefetching || invitations.isRefetching} title={t("nav.caregivers")}>
      <Body muted>{t("settings.caregiversPageDescription")}</Body>
      <Accordion title={t("settings.addCaregiver")}>
        <InviteCareForm />
      </Accordion>
      {relationships.isLoading || invitations.isLoading ? <StateMessage loading title={t("settings.loadingCareRelationships")} /> : null}
      {relationships.isError || invitations.isError ? <StateMessage action={<Button onPress={refresh}>{t("common.tryAgain")}</Button>} title={t("settings.failedLoadCareRelationships")} /> : null}

      <Section title={t("settings.careInvitations")}>
        {(invitations.data?.invitations ?? []).length === 0 ? <StateMessage title={t("settings.noCareInvitations")} /> : null}
        {(invitations.data?.invitations ?? []).map((relationship) => (
          <RelationshipAccordion key={relationship.id} relationship={relationship}>
            {relationship.status === "pending" ? (
              <View style={nativeStyles.actionRow}>
                <Button loading={accept.isPending} onPress={() => void respond(relationship, true)}>{t("settings.acceptCareInvite")}</Button>
                <Button danger loading={decline.isPending} onPress={() => void respond(relationship, false)}>{t("settings.declineCareInvite")}</Button>
              </View>
            ) : null}
          </RelationshipAccordion>
        ))}
      </Section>

      <Section title={t("settings.careWhoCaresForMe")}>
        {sent.length === 0 ? <StateMessage title={t("settings.noCareRelationships")} /> : null}
        {sent.map((relationship) => <RelationshipAccordion key={relationship.id} relationship={relationship} />)}
      </Section>
      <Section title={t("settings.carePeopleUnderMyCare")}>
        {received.length === 0 ? <StateMessage title={t("settings.noCareRelationships")} /> : null}
        {received.map((relationship) => <RelationshipAccordion key={relationship.id} relationship={relationship} />)}
      </Section>
    </Screen>
  );
}

function RelationshipAccordion({ children, relationship }: { children?: React.ReactNode; relationship: CareRelationship }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const otherName = relationship.patient_user_id === user?.id ? relationship.caregiver_display_name : relationship.patient_display_name;
  const photoPath = relationship.patient_user_id === user?.id ? relationship.caregiver_profile_photo_path : relationship.patient_profile_photo_path;
  return (
    <Accordion
      subtitle={`${t(`settings.relationshipOptions.${relationship.relationship_type}`)} | ${t(`settings.careInviteStatuses.${relationship.status}`)}`}
      title={otherName}
    >
      <RelationshipIdentity name={otherName} photoPath={photoPath} relationship={relationship} />
      {children}
      <CareRelationshipPanel relationship={relationship} />
    </Accordion>
  );
}

function InviteCareForm() {
  const { t } = useTranslation();
  const lookup = useLookupCareUserByLumaId();
  const create = useCreateCareRelationship();
  const [lumaId, setLumaId] = useState("");
  const [found, setFound] = useState<CarePublicUser | null>(null);
  const [relationshipType, setRelationshipType] = useState<CareRelationshipType>("caregiver");
  const [duration, setDuration] = useState<"indefinite" | "until_date">("indefinite");
  const [validUntil, setValidUntil] = useState("");
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [scope, setScope] = useState<CareScopePayload>({ medication_ids: [], medication_scope: "all_medications" });
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);
  const validationError = validateCareInvite({ duration, scope, validUntil });

  const reset = () => {
    lookup.reset();
    create.reset();
    setLumaId("");
    setFound(null);
    setRelationshipType("caregiver");
    setDuration("indefinite");
    setValidUntil("");
    setPermissions(defaultPermissions);
    setScope({ medication_ids: [], medication_scope: "all_medications" });
  };

  const verify = async () => {
    setDeliveryMessage(null);
    setFound(null);
    if (!lumaId.trim()) {
      Alert.alert(t("settings.careLumaIdRequired"));
      return;
    }
    try {
      setFound(await lookup.mutateAsync(lumaId.trim()));
    } catch (error) {
      setFound(null);
      Alert.alert(t("settings.careLookupFailed"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  const submit = async () => {
    if (!found || found.invite_block_reason) return;
    const error = validateCareInvite({ duration, scope, validUntil });
    if (error === "invalid_valid_until") {
      Alert.alert(t("validation.validEndDate"));
      return;
    }
    if (error === "selected_scope_empty") {
      Alert.alert(t("settings.selectMedicationToContinue"));
      return;
    }
    try {
      const result = await create.mutateAsync({
        caregiver_luma_id: found.luma_id,
        duration_type: duration,
        permissions,
        relationship_type: relationshipType,
        scope: normalizeCareScope(scope),
        valid_until: duration === "until_date" ? validUntil : null,
      });
      const deliveryStatus = result.whatsapp_invitation?.status;
      setDeliveryMessage(t(deliveryStatus === "failed"
        ? "settings.careInviteCreatedWhatsappFailed"
        : deliveryStatus === "skipped"
          ? "settings.careInviteCreatedWhatsappSkipped"
          : "settings.careInviteCreated"));
      reset();
    } catch (error) {
      Alert.alert(t("settings.careInviteFailed"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  return (
    <View style={styles.inlineForm}>
      {deliveryMessage ? <Card><Body>{deliveryMessage}</Body></Card> : null}
      <Field
        autoCapitalize="characters"
        label={t("settings.caregiverLumaId")}
        onChangeText={(value) => {
          setLumaId(value);
          setFound(null);
        }}
        value={lumaId}
      />
      <Button loading={lookup.isPending} onPress={() => void verify()}>{t("settings.verifyLumaId")}</Button>
      {found ? (
        <>
          <Card>
            <Text style={styles.name}>{found.display_name}</Text>
            <Body muted>{found.luma_id}</Body>
            {found.invite_block_reason ? <Body>{t(`settings.careInviteBlocked${blockSuffix(found.invite_block_reason)}`)}</Body> : null}
          </Card>
          {!found.invite_block_reason ? (
            <>
              <Choice label={t("settings.relationship")} onChange={(value) => setRelationshipType(value as CareRelationshipType)} options={careRelationshipTypes.map((value) => ({ label: t(`settings.relationshipOptions.${value}`), value }))} value={relationshipType} />
              <Choice label={t("settings.duration")} onChange={(value) => setDuration(value as "indefinite" | "until_date")} options={[
                { label: t("settings.durationOptions.indefinite"), value: "indefinite" },
                { label: t("settings.durationOptions.untilDate"), value: "until_date" },
              ]} value={duration} />
              {duration === "until_date" ? <Field error={validationError === "invalid_valid_until" ? t("validation.validEndDate") : undefined} label={t("settings.validUntil")} onChangeText={setValidUntil} value={validUntil} /> : null}
              <PermissionsEditor onChange={setPermissions} value={permissions} />
              <Choice label={t("settings.medicationScope")} onChange={(medication_scope) => setScope((current) => ({ ...current, medication_scope: medication_scope as CareScopePayload["medication_scope"] }))} options={[
                { label: t("settings.allMedications"), value: "all_medications" },
                { label: t("settings.selectedMedications"), value: "selected_medications" },
              ]} value={scope.medication_scope} />
              {scope.medication_scope === "selected_medications" ? (
                <MedicationScope medicationIds={scope.medication_ids} onChange={(medication_ids) => setScope({ medication_ids, medication_scope: "selected_medications" })} />
              ) : null}
              {validationError === "selected_scope_empty" ? <Body muted>{t("settings.selectMedicationToContinue")}</Body> : null}
              <Button disabled={validationError !== null} loading={create.isPending} onPress={() => void submit()}>{t("settings.sendCareInvite")}</Button>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function CareRelationshipPanel({ relationship }: { relationship: CareRelationship }) {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const updatePermissions = useUpdateCarePermissions();
  const updatePreferences = useUpdateCarePreferences();
  const updateScope = useUpdateCareScope();
  const revoke = useRevokeCareRelationship();
  const isPatient = relationship.patient_user_id === user?.id;
  const isAcceptedActive = relationship.status === "accepted" && relationship.is_active;
  const canViewTimeline = Boolean(
    !isPatient && isAcceptedActive && relationship.allow_view_timeline,
  );
  const canManageRoutines = Boolean(
    !isPatient && isAcceptedActive && relationship.allow_manage_routines,
  );
  const routines = useCareRelationshipRoutines(relationship?.id, canManageRoutines);
  const updateRoutine = useUpdateCaregiverRoutine();
  const [permissions, setPermissions] = useState(defaultPermissions);
  const [scope, setScope] = useState<CareScopePayload>({ medication_ids: [], medication_scope: "all_medications" });
  const [savedPermissions, setSavedPermissions] = useState(defaultPermissions);
  const [savedScope, setSavedScope] = useState<CareScopePayload>({ medication_ids: [], medication_scope: "all_medications" });
  const [preference, setPreference] = useState<"none" | "together" | "overdue_only">("none");
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [timelinePreset, setTimelinePreset] = useState<"today" | "7" | "30" | "custom">("today");
  const [timelineDateFrom, setTimelineDateFrom] = useState(dateDaysAgo(new Date(), 6));
  const [timelineDateTo, setTimelineDateTo] = useState(toDateInputValue());
  const [timelineMedication, setTimelineMedication] = useState("");
  const [timelineDoctor, setTimelineDoctor] = useState("");
  const [timelineStatus, setTimelineStatus] = useState<AdherenceHistoryStatus | "">("");
  const [editing, setEditing] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const timelineDateError = timelinePreset === "custom"
    ? validateDateRange(timelineDateFrom, timelineDateTo)
    : null;
  const timelineQueryFilters = useMemo<CareTimelineFilters>(() => {
    const dates: CareTimelineFilters = timelinePreset === "today"
      ? { date: toDateInputValue() }
      : timelinePreset === "7"
        ? { date_from: dateDaysAgo(new Date(), 6), date_to: toDateInputValue() }
        : timelinePreset === "30"
          ? { date_from: dateDaysAgo(new Date(), 29), date_to: toDateInputValue() }
          : { date_from: timelineDateFrom, date_to: timelineDateTo };
    return {
      ...dates,
      medication_id: timelineMedication || undefined,
      prescribing_doctor_name: timelineDoctor || undefined,
      status: timelineStatus || undefined,
    };
  }, [timelineDateFrom, timelineDateTo, timelineDoctor, timelineMedication, timelinePreset, timelineStatus]);
  const timeline = useCareTimeline(
    relationship?.id ?? "",
    timelineQueryFilters,
    canViewTimeline && timelineOpen && timelineDateError === null,
  );
  const timelineFilters = useCareTimelineFilters(
    relationship?.id ?? "",
    canViewTimeline && timelineOpen,
  );
  const timelineEntries = useMemo(() => {
    const scheduled = (timeline.data?.items ?? []).map((item) => ({
      at: item.scheduled_for,
      id: item.event_id,
      item,
      kind: "scheduled" as const,
    }));
    const asNeeded = (timeline.data?.as_needed_usage_logs ?? []).map((item) => ({
      at: item.used_at,
      id: item.id,
      item,
      kind: "prn" as const,
    }));
    return [...scheduled, ...asNeeded].sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [timeline.data]);
  const timelineGroups = useMemo(() => {
    const timezone = timeline.data?.timezone ?? "UTC";
    const groups = new Map<string, typeof timelineEntries>();
    for (const entry of timelineEntries) {
      const parts = new Intl.DateTimeFormat("en-CA", { day: "2-digit", month: "2-digit", timeZone: timezone, year: "numeric" }).formatToParts(new Date(entry.at));
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      const dateKey = `${values.year}-${values.month}-${values.day}`;
      groups.set(dateKey, [...(groups.get(dateKey) ?? []), entry]);
    }
    return [...groups.entries()].sort(([left], [right]) => left < right ? 1 : -1);
  }, [timeline.data?.timezone, timelineEntries]);

  const clearTimelineFilters = () => {
    setTimelinePreset("today");
    setTimelineDateFrom(dateDaysAgo(new Date(), 6));
    setTimelineDateTo(toDateInputValue());
    setTimelineMedication("");
    setTimelineDoctor("");
    setTimelineStatus("");
  };

  const resetDraft = () => {
    const relationshipPermissions = permissionsFromRelationship(relationship);
    const relationshipScope = normalizeCareScope({
      medication_ids: relationship.scoped_medications.map((item) => item.id),
      medication_scope: relationship.medication_scope,
    });
    setPermissions(relationshipPermissions);
    setScope(relationshipScope);
    setPreference(normalizeCarePreference(relationship.caregiver_notification_mode, relationship));
  };

  useEffect(() => {
    const relationshipPermissions = permissionsFromRelationship(relationship);
    const relationshipScope = normalizeCareScope({
      medication_ids: relationship.scoped_medications.map((item) => item.id),
      medication_scope: relationship.medication_scope,
    });
    setPermissions(relationshipPermissions);
    setScope(relationshipScope);
    setSavedPermissions(relationshipPermissions);
    setSavedScope(relationshipScope);
    setPreference(normalizeCarePreference(relationship.caregiver_notification_mode, relationship));
    setEditingRoutine(null);
    setTimelinePreset("today");
    setTimelineDateFrom(dateDaysAgo(new Date(), 6));
    setTimelineDateTo(toDateInputValue());
    setTimelineMedication("");
    setTimelineDoctor("");
    setTimelineStatus("");
    setTimelineOpen(false);
    setEditing(false);
  }, [relationship]);

  const scopeInvalid = scope.medication_scope === "selected_medications" && scope.medication_ids.length === 0;
  const preferenceInvalid = !isCarePreferenceAllowed(preference, relationship);
  const preferenceOptions = [
    { label: t("settings.prefNone"), value: "none" as const },
    ...(relationship.allow_receive_together
      ? [{ label: t("settings.prefTogether"), value: "together" as const }]
      : []),
    ...(relationship.allow_receive_overdue
      ? [{ label: t("settings.prefOverdue"), value: "overdue_only" as const }]
      : []),
  ];

  const save = async () => {
    if (isPatient && scopeInvalid) {
      Alert.alert(t("settings.selectMedicationToContinue"));
      return;
    }
    if (!isPatient && preferenceInvalid) {
      Alert.alert(t("settings.prefNotAuthorized"));
      return;
    }
    try {
      if (isPatient) {
        await persistCareAccess({
          currentPermissions: savedPermissions,
          currentScope: savedScope,
          nextPermissions: permissions,
          nextScope: scope,
          updatePermissions: (payload) => updatePermissions.mutateAsync({ payload, relationshipId: relationship.id }),
          updateScope: (payload) => updateScope.mutateAsync({ payload, relationshipId: relationship.id }),
        });
        setSavedPermissions({ ...permissions });
        setSavedScope(normalizeCareScope(scope));
      } else {
        await updatePreferences.mutateAsync({ payload: { notification_mode: preference }, relationshipId: relationship.id });
      }
      Alert.alert(t("common.save"), t("settings.permissionsSaved"));
      setEditing(false);
    } catch (error) {
      Alert.alert(t("settings.caregiverCardSaveError"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  const revokeRelationship = async () => {
    try {
      await revoke.mutateAsync({ payload: { reason: "user_requested" }, relationshipId: relationship.id });
    } catch (error) {
      Alert.alert(
        t("settings.caregiverCardSaveError"),
        error instanceof Error ? error.message : t("common.somethingWentWrong"),
      );
    }
  };

  const remove = () => Alert.alert(t(isPatient ? "settings.removeCaregiver" : "settings.leaveCareRelationship"), t("settings.areYouSure"), [
    { style: "cancel", text: t("common.cancel") },
    { style: "destructive", text: t("common.continue"), onPress: () => void revokeRelationship() },
  ]);

  return (
    <View style={styles.relationshipPanel}>
      <RelationshipSummary relationship={relationship} />
      {isAcceptedActive && !editing ? (
        <Button onPress={() => setEditing(true)} secondary>{t("settings.editCaregiverSettings")}</Button>
      ) : null}
      {isAcceptedActive && editing ? (
        <>
          {isPatient ? (
            <>
              <PermissionsEditor onChange={setPermissions} value={permissions} />
              <Choice label={t("settings.medicationScope")} onChange={(medication_scope) => setScope((current) => ({ ...current, medication_scope: medication_scope as CareScopePayload["medication_scope"] }))} options={[
                { label: t("settings.allMedications"), value: "all_medications" },
                { label: t("settings.selectedMedications"), value: "selected_medications" },
              ]} value={scope.medication_scope} />
              {scope.medication_scope === "selected_medications" ? <MedicationScope medicationIds={scope.medication_ids} onChange={(medication_ids) => setScope({ medication_ids, medication_scope: "selected_medications" })} /> : null}
              {scopeInvalid ? <Body muted>{t("settings.selectMedicationToContinue")}</Body> : null}
            </>
          ) : (
            <>
              <Choice label={t("settings.notificationMode.title")} onChange={(value) => setPreference(value as typeof preference)} options={preferenceOptions} value={preference} />
              {!relationship.allow_receive_together || !relationship.allow_receive_overdue ? <Body muted>{t("settings.prefNotAuthorized")}</Body> : null}
            </>
          )}
          <View style={nativeStyles.actionRow}>
            <Button disabled={scopeInvalid || preferenceInvalid} loading={updatePermissions.isPending || updatePreferences.isPending || updateScope.isPending} onPress={() => void save()}>{t("common.saveChanges")}</Button>
            <Button onPress={() => { resetDraft(); setEditing(false); }} variant="ghost">{t("common.cancel")}</Button>
          </View>
        </>
      ) : !isAcceptedActive ? (
        <Body muted>{t("settings.prefNotAuthorized")}</Body>
      ) : null}

      {canViewTimeline ? (
        <Accordion onExpandedChange={setTimelineOpen} title={t("history.timeline")}>
          <Accordion title={t("history.datePreset")}>
          <Choice
            label={t("history.datePreset")}
            onChange={(value) => setTimelinePreset(value as typeof timelinePreset)}
            options={[
              { label: t("history.today"), value: "today" },
              { label: t("history.last7Days"), value: "7" },
              { label: t("history.last30Days"), value: "30" },
              { label: t("history.custom"), value: "custom" },
            ]}
            value={timelinePreset}
          />
          {timelinePreset === "custom" ? (
            <View style={nativeStyles.row}>
              <View style={styles.flex}><Field error={timelineDateError === "invalid_start" ? t("validation.validStartDate") : undefined} label={t("history.dateFrom")} onChangeText={setTimelineDateFrom} value={timelineDateFrom} /></View>
              <View style={styles.flex}><Field error={timelineDateError === "invalid_end" ? t("validation.validEndDate") : timelineDateError === "end_before_start" ? t("validation.endDateAfterStart") : undefined} label={t("history.dateTo")} onChangeText={setTimelineDateTo} value={timelineDateTo} /></View>
            </View>
          ) : null}
          <Choice
            label={t("history.medication")}
            onChange={setTimelineMedication}
            options={[
              { label: t("history.allMedications"), value: "" },
              ...(timelineFilters.data?.medications ?? []).map((item) => ({ label: item.name, value: item.id })),
            ]}
            value={timelineMedication}
          />
          <Choice
            label={t("history.doctor")}
            onChange={setTimelineDoctor}
            options={[
              { label: t("history.allDoctors"), value: "" },
              ...(timelineFilters.data?.doctors ?? []).map((value) => ({ label: value, value })),
            ]}
            value={timelineDoctor}
          />
          <Choice
            label={t("history.status")}
            onChange={(value) => setTimelineStatus(value as AdherenceHistoryStatus | "")}
            options={[
              { label: t("history.allStatuses"), value: "" },
              ...(timelineFilters.data?.statuses ?? []).map((value) => ({ label: t(getHistoryStatusLabelKey(value)), value })),
            ]}
            value={timelineStatus}
          />
          <Button onPress={clearTimelineFilters} variant="ghost">{t("history.clearFilters")}</Button>
          </Accordion>
          {timeline.isLoading || timelineFilters.isLoading ? <StateMessage loading title={t("history.loading")} /> : null}
          {timeline.isError || timelineFilters.isError ? (
            <StateMessage
              action={<Button onPress={() => { void timeline.refetch(); void timelineFilters.refetch(); }}>{t("common.tryAgain")}</Button>}
              title={t("history.unableToLoad")}
            />
          ) : null}
          {timeline.isSuccess && timelineEntries.length === 0 ? <StateMessage title={t("history.noHistory")} /> : null}
          {timelineGroups.map(([dateKey, entries]) => (
            <View key={dateKey} style={styles.timelineGroup}>
              <Label>{formatHistoryDate(i18n.resolvedLanguage ?? "pt-BR", dateKey)}</Label>
              {entries.map((entry) => entry.kind === "prn" ? (
            <Card key={`care-prn-${entry.id}`}>
              <View style={nativeStyles.rowBetween}>
                <Text style={styles.name}>{entry.item.medication_name}</Text>
                <Text style={nativeStyles.badge}>{t("history.asNeeded")}</Text>
              </View>
              <Body>{formatAsNeededUsageDateTime(t, i18n.resolvedLanguage ?? "pt-BR", entry.item.used_at, timeline.data?.timezone ?? "UTC")}</Body>
              {entry.item.dose_quantity != null ? <Body muted>{entry.item.dose_quantity} {entry.item.dose_unit}</Body> : null}
              {entry.item.note ? <Body muted>{entry.item.note}</Body> : null}
            </Card>
          ) : (
            <Card key={`care-scheduled-${entry.id}`}>
              <View style={nativeStyles.rowBetween}>
                <Text style={styles.name}>{entry.item.medication_name}</Text>
                <Text style={nativeStyles.badge}>{t(getHistoryStatusLabelKey(entry.item.status))}</Text>
              </View>
              <Body>{formatHistoryTime(i18n.resolvedLanguage ?? "pt-BR", entry.item.scheduled_for, timeline.data?.timezone ?? "UTC")}</Body>
              <Body muted>{getTimelineDescription(t, entry.item.status, {
                delayMinutes: entry.item.delay_minutes,
                skippedAt: formatHistoryTime(i18n.resolvedLanguage ?? "pt-BR", entry.item.skipped_at, timeline.data?.timezone ?? "UTC"),
                takenAt: formatHistoryTime(i18n.resolvedLanguage ?? "pt-BR", entry.item.taken_at, timeline.data?.timezone ?? "UTC"),
              })}</Body>
            </Card>
              ))}
            </View>
          ))}
        </Accordion>
      ) : null}

      {canManageRoutines ? (
        <Section title={t("settings.authorizedRoutines")}>
          {routines.isLoading ? <StateMessage loading title={t("routines.loading")} /> : null}
          {routines.isError ? <StateMessage action={<Button onPress={() => void routines.refetch()}>{t("common.tryAgain")}</Button>} title={t("routines.couldNotLoad")} /> : null}
          {routines.isSuccess && (routines.data?.routines ?? []).length === 0 ? <StateMessage title={t("routines.noRoutinesTitle")} /> : null}
          {(routines.data?.routines ?? []).map((routine) => (
            <Card key={routine.id}><Text style={styles.name}>{routine.title}</Text><Button onPress={() => setEditingRoutine(routine)} secondary>{t("routines.editRoutine")}</Button></Card>
          ))}
        </Section>
      ) : null}
      {relationship.status === "pending" || relationship.status === "accepted" ? (
        <Button danger loading={revoke.isPending} onPress={remove}>{t(isPatient ? relationship.status === "pending" ? "settings.cancelCareInvite" : "settings.removeCaregiver" : "settings.leaveCareRelationship")}</Button>
      ) : null}
      <RoutineEditorSheet
        defaultDoseUnit={routines.data?.medications.find((item) => item.id === editingRoutine?.medication_id)?.form}
        onClose={() => setEditingRoutine(null)}
        onSave={(routine, payload) => updateRoutine.mutateAsync({ payload, relationshipId: relationship.id, routineId: routine.id })}
        routine={editingRoutine}
      />
    </View>
  );
}

function RelationshipIdentity({ name, photoPath, relationship }: { name: string; photoPath?: string | null; relationship: CareRelationship }) {
  const { t } = useTranslation();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setPhotoUrl(null);
    if (relationship.status !== "accepted" || !photoPath) return () => { active = false; };
    void createProfilePhotoSignedUrl(photoPath).then((url) => { if (active) setPhotoUrl(url); }).catch(() => undefined);
    return () => { active = false; };
  }, [photoPath, relationship.status]);
  return (
    <View style={styles.identity}>
      {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{name.trim().charAt(0).toUpperCase()}</Text></View>}
      <View style={styles.identityCopy}>
        <Text style={styles.name}>{name}</Text>
        <View style={styles.badges}>
          <Badge tone={relationship.status === "accepted" ? "success" : relationship.status === "pending" ? "warning" : "neutral"}>{t(`settings.careInviteStatuses.${relationship.status}`)}</Badge>
          {relationship.status === "accepted" ? <Badge tone={relationship.is_active ? "success" : "danger"}>{t(relationship.is_active ? "settings.activeStatus" : "settings.inactiveStatus")}</Badge> : null}
        </View>
      </View>
    </View>
  );
}

function RelationshipSummary({ relationship }: { relationship: CareRelationship }) {
  const { t } = useTranslation();
  const permissions = permissionsFromRelationship(relationship);
  const enabledPermissions = (Object.keys(permissions) as (keyof CarePermissionsPayload)[])
    .filter((key) => permissions[key]);
  const permissionLabels: Record<keyof CarePermissionsPayload, string> = {
    allow_manage_routines: t("settings.allowManageRoutines"),
    allow_mark_patient_taken: t("settings.allowMarkPatientTaken"),
    allow_receive_overdue: t("settings.allowReceiveOverdue"),
    allow_receive_together: t("settings.allowReceiveTogether"),
    allow_skip_patient_dose: t("settings.allowSkipPatientDose"),
    allow_view_timeline: t("settings.allowViewTimeline"),
  };

  return (
    <Card>
      <View style={nativeStyles.rowBetween}>
        <Label>{t(`settings.relationshipOptions.${relationship.relationship_type}`)}</Label>
        <Text style={nativeStyles.badge}>{t(`settings.careInviteStatuses.${relationship.status}`)}</Text>
      </View>
      {!relationship.is_active && relationship.inactive_reason ? (
        <Body muted>{t(`settings.inactiveReasons.${relationship.inactive_reason}`)}</Body>
      ) : null}
      <Body muted>
        {relationship.medication_scope === "all_medications"
          ? t("settings.allMedications")
          : relationship.scoped_medications.map((item) => item.name).join(", ")}
      </Body>
      {enabledPermissions.map((key) => <Body key={key}>{permissionLabels[key]}</Body>)}
    </Card>
  );
}

function PermissionsEditor({ onChange, value }: { onChange: (value: CarePermissionsPayload) => void; value: CarePermissionsPayload }) {
  const { t } = useTranslation();
  const toggle = (key: keyof CarePermissionsPayload, next: boolean) => onChange({ ...value, [key]: next });
  return (
    <Card>
      <Label>{t("settings.caregiverPermissionsTitle")}</Label>
      <ToggleRow label={t("settings.allowReceiveTogether")} onValueChange={(next) => toggle("allow_receive_together", next)} value={value.allow_receive_together} />
      <ToggleRow label={t("settings.allowReceiveOverdue")} onValueChange={(next) => toggle("allow_receive_overdue", next)} value={value.allow_receive_overdue} />
      <ToggleRow label={t("settings.allowMarkPatientTaken")} onValueChange={(next) => toggle("allow_mark_patient_taken", next)} value={value.allow_mark_patient_taken} />
      <ToggleRow label={t("settings.allowSkipPatientDose")} onValueChange={(next) => toggle("allow_skip_patient_dose", next)} value={value.allow_skip_patient_dose} />
      <ToggleRow label={t("settings.allowManageRoutines")} onValueChange={(next) => toggle("allow_manage_routines", next)} value={value.allow_manage_routines} />
      <ToggleRow label={t("settings.allowViewTimeline")} onValueChange={(next) => toggle("allow_view_timeline", next)} value={value.allow_view_timeline} />
    </Card>
  );
}

function MedicationScope({ medicationIds, onChange }: { medicationIds: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useTranslation();
  const medications = useMedications();
  return (
    <Card>
      <Label>{t("settings.chooseMedications")}</Label>
      {(medications.data ?? []).filter((item) => !item.is_archived).map((medication) => (
        <ToggleRow key={medication.id} label={medication.name} onValueChange={(selected) => onChange(selected ? [...medicationIds, medication.id] : medicationIds.filter((id) => id !== medication.id))} value={medicationIds.includes(medication.id)} />
      ))}
    </Card>
  );
}

function blockSuffix(reason: NonNullable<CarePublicUser["invite_block_reason"]>) {
  if (reason === "active_caregiver") return "ActiveCaregiver";
  if (reason === "pending_invite") return "PendingInvite";
  return "Self";
}

const styles = StyleSheet.create({
  avatar: { borderRadius: 24, height: 48, width: 48 },
  avatarFallback: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  avatarInitial: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flex: { flex: 1 },
  identity: { alignItems: "center", flexDirection: "row", gap: 12 },
  identityCopy: { flex: 1, gap: 8 },
  inlineForm: { gap: 12 },
  name: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: "800" },
  relationshipPanel: { gap: 12 },
  timelineGroup: { gap: 8 },
});
