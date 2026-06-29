import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Calendar, type DateData } from "react-native-calendars";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, Dialog, Modal, Portal, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { Swipeable } from "react-native-gesture-handler";
import { Screen } from "@/components/ui/Screen";
import { AppCard } from "@/components/ui/AppCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { palette } from "@/constants/theme";
import { enableStudyReminders, remindersAreEnabled, remindersSupported } from "@/hooks/useStudyReminders";
import { useTrackScreen } from "@/hooks/useTrackScreen";
import { useAppStore } from "@/store/appStore";
import type { EventRecurrence, EventType, StudyEvent } from "@/types";
import {
  addDays,
  expandEventOccurrences,
  isStudyTimeEvent,
  isTutorSessionEvent,
  localDateKey,
  recurrenceLabel,
  tutorTopicFromEvent,
  todayKey,
  type EventOccurrence
} from "@/utils/studyEvents";

type EventKind = "assessment" | "study" | "tutor";

const typeColor: Record<EventType, string> = {
  SAC: "#F59E0B",
  SAT: "#F472B6",
  PRACTICE_SAC: "#FBBF24",
  PRACTICE_SAT: "#F9A8D4",
  EXAM: palette.secondary,
  TASK: palette.info,
  STUDY_TIME: palette.success
};

const eventTypeLabel: Record<EventType, string> = {
  SAC: "Actual SAC",
  SAT: "Actual SAT",
  PRACTICE_SAC: "Practice SAC",
  PRACTICE_SAT: "Practice SAT",
  EXAM: "Exam",
  TASK: "Task",
  STUDY_TIME: "Study time"
};

const daysUntil = (date: string) => {
  const now = new Date();
  const target = new Date(`${date.slice(0, 10)}T00:00:00`);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
};

const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^\d{2}:\d{2}$/;

const isValidDateKey = (value: string) => {
  if (!dateKeyPattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && localDateKey(date) === value;
};

const datePickerValue = (value: string) => (isValidDateKey(value) ? new Date(`${value}T00:00:00`) : new Date());

const isValidTime = (value: string) => {
  if (!timePattern.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const timeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const displayMeta = (occurrence: EventOccurrence) => {
  const { event, dateKey } = occurrence;
  if (isTutorSessionEvent(event)) {
    return `${event.subject?.subjectName ?? "Flexible"} · Tutor session · ${event.startTime}-${event.endTime} · ${recurrenceLabel(event.recurrence)}`;
  }
  if (isStudyTimeEvent(event)) {
    return `${event.subject?.subjectName ?? "Flexible"} · Study time · ${event.startTime}-${event.endTime} · ${recurrenceLabel(event.recurrence)}`;
  }
  return `${event.subject?.subjectName ?? "No subject"} · ${eventTypeLabel[event.eventType]} · ${
    daysUntil(dateKey) === 0 ? "today" : `in ${daysUntil(dateKey)} days`
  }`;
};

function EventRow({
  occurrence,
  onComplete,
  onEdit,
  onDelete,
  onStartTutor
}: {
  occurrence: EventOccurrence;
  onComplete: (event: StudyEvent) => void;
  onEdit: (event: StudyEvent, dateKey: string) => void;
  onDelete: (event: StudyEvent) => void;
  onStartTutor: (event: StudyEvent) => void;
}) {
  const { event } = occurrence;
  const isTutorSession = isTutorSessionEvent(event);
  const renderRightActions = () => (
    <Pressable style={styles.completeAction} onPress={() => onComplete(event)}>
      <Text style={styles.completeText}>Complete</Text>
    </Pressable>
  );

  const row = (
    <Pressable style={styles.eventRow} onPress={() => onEdit(event, occurrence.dateKey)}>
      <View style={[styles.eventBar, { backgroundColor: isTutorSession ? palette.primary : typeColor[event.eventType] }]} />
      <View style={styles.eventBody}>
        <Text style={[styles.eventTitle, event.completed && styles.completed]} numberOfLines={1}>
          {event.title}
        </Text>
        <Text style={styles.muted} numberOfLines={1}>
          {displayMeta(occurrence)}
        </Text>
        {event.description ? <Text style={styles.description}>{event.description}</Text> : null}
      </View>
      <View style={styles.eventActions}>
        {isTutorSession && !event.completed ? (
          <Button mode="text" compact icon="school-outline" onPress={() => onStartTutor(event)}>
            Start
          </Button>
        ) : null}
        <Button mode="text" compact icon="pencil" onPress={() => onEdit(event, occurrence.dateKey)}>
          Edit
        </Button>
        <Button mode="text" compact textColor={palette.secondary} icon="delete" onPress={() => onDelete(event)}>
          Delete
        </Button>
      </View>
    </Pressable>
  );

  if (isStudyTimeEvent(event)) return row;
  return <Swipeable renderRightActions={renderRightActions}>{row}</Swipeable>;
}

export default function CalendarScreen() {
  useTrackScreen("calendar");
  const router = useRouter();
  const { subjects, events, sessions, loading, fetchAll, createEvent, updateEvent, deleteEvent } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventKind, setEventKind] = useState<EventKind>("assessment");
  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<EventType>("SAC");
  const [eventDate, setEventDate] = useState(todayKey());
  const [startTime, setStartTime] = useState("15:30");
  const [endTime, setEndTime] = useState("16:30");
  const [recurrence, setRecurrence] = useState<EventRecurrence>("NONE");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [notificationMinutes, setNotificationMinutes] = useState("60");
  const [description, setDescription] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<StudyEvent | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(remindersAreEnabled());

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      setRemindersEnabled(remindersAreEnabled());
    }, [fetchAll])
  );

  const occurrenceStart = localDateKey(addDays(new Date(), -14));
  const occurrenceEnd = localDateKey(addDays(new Date(), 120));
  const occurrences = useMemo(
    () => expandEventOccurrences(events, occurrenceStart, occurrenceEnd),
    [events, occurrenceEnd, occurrenceStart]
  );

  const sessionDateSet = useMemo(() => {
    const set = new Set<string>();
    for (const session of sessions) {
      set.add(session.createdAt.slice(0, 10));
    }
    return set;
  }, [sessions]);

  const markedDates = useMemo(() => {
    const marks: Record<string, { dots?: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }> = {};
    for (const dateKey of sessionDateSet) {
      marks[dateKey] ??= { dots: [] };
      marks[dateKey].dots = [...(marks[dateKey].dots ?? []), { key: "session", color: palette.success }];
    }
    for (const occurrence of occurrences) {
      const key = occurrence.dateKey;
      marks[key] ??= { dots: [] };
      marks[key].dots = [
        ...(marks[key].dots ?? []),
        { key: `${occurrence.id}-${occurrence.event.eventType}`, color: typeColor[occurrence.event.eventType] }
      ];
    }
    marks[selectedDate] = {
      ...(marks[selectedDate] ?? {}),
      selected: true,
      selectedColor: palette.primary
    };
    return marks;
  }, [occurrences, selectedDate, sessionDateSet]);

  const eventsForDate = useMemo(
    () => occurrences.filter((occurrence) => occurrence.dateKey === selectedDate),
    [occurrences, selectedDate]
  );

  const upcoming = useMemo(
    () =>
      occurrences
        .filter(
          (occurrence) =>
            !occurrence.event.completed &&
            !isStudyTimeEvent(occurrence.event) &&
            daysUntil(occurrence.dateKey) >= 0
        )
        .slice(0, 10),
    [occurrences]
  );
  const dueSoonCount = useMemo(() => upcoming.filter((occurrence) => daysUntil(occurrence.dateKey) <= 7).length, [upcoming]);
  const todayAssessmentCount = useMemo(() => upcoming.filter((occurrence) => daysUntil(occurrence.dateKey) === 0).length, [upcoming]);
  const nextAssessment = upcoming[0];
  const eventDateMarked = useMemo(
    () =>
      isValidDateKey(eventDate)
        ? {
            [eventDate]: {
              selected: true,
              selectedColor: palette.primary
            }
          }
        : {},
    [eventDate]
  );

  const eventDateValid = isValidDateKey(eventDate);
  const recurrenceUntilValid = !recurrenceUntil.trim() || isValidDateKey(recurrenceUntil.trim());
  const studyTimesValid =
    eventKind === "assessment" || (isValidTime(startTime) && isValidTime(endTime) && timeToMinutes(endTime) > timeToMinutes(startTime));
  const canSubmitEvent =
    !saving && eventDateValid && recurrenceUntilValid && studyTimesValid && (eventKind === "study" || Boolean(subjectId));

  const resetForm = (kind: EventKind) => {
    const defaultDate = selectedDate >= todayKey() ? selectedDate : todayKey();
    setEventKind(kind);
    setSubjectId(kind === "study" ? null : subjects[0]?.id ?? null);
    setEventType("SAC");
    setEventDate(defaultDate);
    setTitle(kind === "study" ? "Study block" : kind === "tutor" ? "Tutor session" : "");
    setStartTime("15:30");
    setEndTime("16:30");
    setRecurrence("NONE");
    setRecurrenceUntil("");
    setNotificationMinutes(kind === "study" || kind === "tutor" ? "15" : "60");
    setDescription("");
    setMessage(null);
    setEditingEventId(null);
    setShowPicker(false);
  };

  const changeEventKind = (value: string) => {
    const nextKind = value as EventKind;
    setEventKind(nextKind);
    setMessage(null);
    if (nextKind === "study") {
      setTitle((current) => current.trim() || "Study block");
      setNotificationMinutes((current) => current || "15");
      return;
    }
    if (nextKind === "tutor") {
      setSubjectId((current) => current ?? subjects[0]?.id ?? null);
      setTitle((current) => current.trim() || "Tutor session");
      setNotificationMinutes((current) => current || "15");
      return;
    }
    setSubjectId((current) => current ?? subjects[0]?.id ?? null);
    setTitle((current) => (current === "Study block" || current === "Tutor session" ? "" : current));
    setNotificationMinutes((current) => current || "60");
  };

  const openAddDialog = (kind: EventKind = "assessment") => {
    resetForm(kind);
    setDialogOpen(true);
  };

  const openEditDialog = (event: StudyEvent, dateKey: string) => {
    const isStudyTime = isStudyTimeEvent(event);
    const isTutorSession = isTutorSessionEvent(event);
    setEditingEventId(event.id);
    setEventKind(isTutorSession ? "tutor" : isStudyTime ? "study" : "assessment");
    setSubjectId(event.subjectId ?? null);
    setEventType(isStudyTime ? "SAC" : event.eventType);
    setEventDate(dateKey);
    setTitle(event.title);
    setStartTime(event.startTime ?? "15:30");
    setEndTime(event.endTime ?? "16:30");
    setRecurrence(event.recurrence ?? "NONE");
    setRecurrenceUntil(event.recurrenceUntil?.slice(0, 10) ?? "");
    setNotificationMinutes(String(event.notificationMinutes ?? (isStudyTime ? 15 : 60)));
    setDescription(event.description ?? "");
    setMessage(null);
    setShowPicker(false);
    setDialogOpen(true);
  };

  const submitEvent = async () => {
    const isStudyTime = eventKind === "study" || eventKind === "tutor";
    const isTutorSession = eventKind === "tutor";
    if (!eventDateValid) {
      setMessage("Use a real date like 2026-05-12.");
      return;
    }
    if (!recurrenceUntilValid) {
      setMessage("Repeat-until must be a real date like 2026-06-30.");
      return;
    }
    if (!isStudyTime && !subjectId) {
      setMessage("Choose a subject for the assessment.");
      return;
    }
    if (isTutorSession && !subjectId) {
      setMessage("Choose a subject for the tutor session.");
      return;
    }
    if (!studyTimesValid) {
      setMessage("Use 24-hour times like 15:30, with the end after the start.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        subjectId,
        title: title.trim() || (isTutorSession ? "Tutor session" : isStudyTime ? "Study block" : "Assessment"),
        eventType: isStudyTime ? "STUDY_TIME" : eventType,
        eventDate,
        startTime: isStudyTime ? startTime : null,
        endTime: isStudyTime ? endTime : null,
        recurrence: isStudyTime ? recurrence : "NONE",
        recurrenceUntil: isStudyTime && recurrenceUntil.trim() ? recurrenceUntil.trim() : null,
        notificationMinutes: Number(notificationMinutes) || (isStudyTime ? 15 : 60),
        source: isTutorSession ? "tutor_session" : "manual",
        description: description.trim() || null
      };
      if (editingEventId) {
        await updateEvent(editingEventId, payload);
      } else {
        await createEvent(payload);
      }
      setDialogOpen(false);
      setEditingEventId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save event.");
    } finally {
      setSaving(false);
    }
  };

  const startTutorSession = (event: StudyEvent) => {
    setSheetOpen(false);
    router.push({
      pathname: "/(tabs)/study",
      params: {
        mode: "coach",
        ...(event.subjectId ? { subjectId: event.subjectId } : {}),
        tutorTopic: tutorTopicFromEvent(event),
        tutorGoal: event.description ?? "",
        tutorEventId: event.id,
        tutorEventTitle: event.title
      }
    });
  };

  const completeEvent = async (event: StudyEvent) => {
    await updateEvent(event.id, { completed: true });
  };

  const confirmDelete = async () => {
    if (!deletingEvent) return;
    setSaving(true);
    try {
      await deleteEvent(deletingEvent.id);
      setDeletingEvent(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete event.");
    } finally {
      setSaving(false);
    }
  };

  const enableReminders = async () => {
    const enabled = await enableStudyReminders();
    setRemindersEnabled(enabled || remindersAreEnabled());
  };

  if (loading && !events.length) {
    return (
      <Screen>
        <SkeletonStack />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Calendar</Text>
          <Text variant="headlineLarge" style={styles.title}>
            Assessment radar
          </Text>
        </View>
        <View style={styles.headerActions}>
          {remindersSupported() ? (
            <Button mode="outlined" icon={remindersEnabled ? "bell-check" : "bell-ring"} onPress={enableReminders}>
              {remindersEnabled ? "Reminders on" : "Reminders"}
            </Button>
          ) : null}
          <Button mode="outlined" icon="calendar-clock" onPress={() => openAddDialog("study")}>
            Study time
          </Button>
          <Button mode="outlined" icon="school-outline" disabled={!subjects.length} onPress={() => openAddDialog("tutor")}>
            Tutor session
          </Button>
          <Button mode="contained" icon="plus" disabled={!subjects.length} onPress={() => openAddDialog("assessment")}>
            Add
          </Button>
        </View>
      </View>

      <AppCard style={styles.radarCard}>
        <View style={styles.radarTop}>
          <View>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Assessment pressure
            </Text>
            <Text style={styles.description}>
              {nextAssessment
                ? `Next: ${nextAssessment.event.title} ${daysUntil(nextAssessment.dateKey) === 0 ? "today" : `in ${daysUntil(nextAssessment.dateKey)} days`}`
                : "No active deadlines on the radar."}
            </Text>
          </View>
          <Button mode="outlined" compact icon="plus" disabled={!subjects.length} onPress={() => openAddDialog("assessment")}>
            Add
          </Button>
        </View>
        <View style={styles.radarTiles}>
          <View style={styles.radarTile}>
            <Text style={styles.radarValue}>{todayAssessmentCount}</Text>
            <Text style={styles.radarLabel}>today</Text>
          </View>
          <View style={styles.radarTile}>
            <Text style={styles.radarValue}>{dueSoonCount}</Text>
            <Text style={styles.radarLabel}>next 7 days</Text>
          </View>
          <View style={styles.radarTile}>
            <Text style={styles.radarValue}>{upcoming.length}</Text>
            <Text style={styles.radarLabel}>upcoming</Text>
          </View>
        </View>
      </AppCard>

      <AppCard>
        <Calendar
          markingType="multi-dot"
          markedDates={markedDates}
          onDayPress={(day: DateData) => {
            setSelectedDate(day.dateString);
            setSheetOpen(true);
          }}
          theme={{
            calendarBackground: palette.surface,
            dayTextColor: palette.text,
            monthTextColor: palette.text,
            textDisabledColor: "#44445A",
            arrowColor: palette.primary,
            todayTextColor: palette.success,
            selectedDayTextColor: palette.text
          }}
        />
        <View style={styles.calendarLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: palette.success }]} />
            <Text style={styles.legendLabel}>Study session</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: palette.warning }]} />
            <Text style={styles.legendLabel}>Assessment</Text>
          </View>
        </View>
      </AppCard>

      <AppCard style={styles.section}>
        <Text variant="titleMedium" style={styles.cardTitle}>
          Upcoming
        </Text>
        {upcoming.length ? (
          upcoming.map((occurrence) => (
            <EventRow
              key={occurrence.id}
              occurrence={occurrence}
              onComplete={completeEvent}
              onEdit={openEditDialog}
              onDelete={setDeletingEvent}
              onStartTutor={startTutorSession}
            />
          ))
        ) : (
          <EmptyState title="No upcoming events" body="Add SACs, SATs, exams, tasks or study times to keep the countdown visible." />
        )}
      </AppCard>

      <Portal>
        <Modal visible={sheetOpen} onDismiss={() => setSheetOpen(false)} contentContainerStyle={styles.sheet}>
          <Text variant="titleLarge" style={styles.cardTitle}>
            {selectedDate}
          </Text>
          {eventsForDate.length ? (
            eventsForDate.map((occurrence) => (
              <EventRow
                key={occurrence.id}
                occurrence={occurrence}
                onComplete={completeEvent}
                onEdit={openEditDialog}
                onDelete={setDeletingEvent}
                onStartTutor={startTutorSession}
              />
            ))
          ) : (
            <EmptyState title="Nothing booked" body="This date is clear." />
          )}
          <View style={styles.sheetActions}>
            <Button mode="outlined" icon="calendar-clock" onPress={() => openAddDialog("study")}>
              Study time
            </Button>
            <Button mode="outlined" icon="school-outline" disabled={!subjects.length} onPress={() => openAddDialog("tutor")}>
              Tutor session
            </Button>
            <Button mode="contained" icon="plus" disabled={!subjects.length} onPress={() => openAddDialog("assessment")}>
              Add assessment
            </Button>
          </View>
        </Modal>

        <Dialog visible={dialogOpen} onDismiss={() => setDialogOpen(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            {editingEventId ? "Edit event" : eventKind === "study" ? "Add study time" : eventKind === "tutor" ? "Book tutor session" : "Add assessment"}
          </Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <SegmentedButtons
              value={eventKind}
              onValueChange={changeEventKind}
              buttons={[
                { value: "assessment", label: "Assessment" },
                { value: "study", label: "Study time" },
                { value: "tutor", label: "Tutor" }
              ]}
            />
            <TextInput mode="outlined" label="Title" value={title} onChangeText={setTitle} />
            {eventKind === "assessment" ? (
              <SegmentedButtons
                value={eventType}
                onValueChange={(value) => setEventType(value as EventType)}
                buttons={[
                  { value: "SAC", label: "SAC" },
                  { value: "SAT", label: "SAT" },
                  { value: "PRACTICE_SAC", label: "Prac SAC" },
                  { value: "PRACTICE_SAT", label: "Prac SAT" },
                  { value: "EXAM", label: "Exam" },
                  { value: "TASK", label: "Task" }
                ]}
              />
            ) : null}
            <View style={styles.subjectGrid}>
              {eventKind === "study" ? (
                <Pressable
                  onPress={() => setSubjectId(null)}
                  style={[styles.subjectChoice, !subjectId && styles.flexibleChoice]}
                >
                  <Text style={styles.subjectChoiceText}>Flexible</Text>
                </Pressable>
              ) : null}
              {subjects.map((subject) => (
                <Pressable
                  key={subject.id}
                  onPress={() => setSubjectId(subject.id)}
                  style={[
                    styles.subjectChoice,
                    subjectId === subject.id && { borderColor: subject.color, backgroundColor: `${subject.color}22` }
                  ]}
                >
                  <Text style={styles.subjectChoiceText} numberOfLines={1}>
                    {subject.subjectName}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              mode="outlined"
              label="Date"
              value={eventDate}
              placeholder="YYYY-MM-DD"
              onChangeText={(value) => {
                setEventDate(value.trim());
                setMessage(null);
              }}
              right={<TextInput.Icon icon="calendar" onPress={() => setShowPicker((value) => !value)} />}
            />
            {showPicker ? (
              Platform.OS === "web" ? (
                <Calendar
                  current={isValidDateKey(eventDate) ? eventDate : todayKey()}
                  markedDates={eventDateMarked}
                  onDayPress={(day: DateData) => {
                    setEventDate(day.dateString);
                    setShowPicker(false);
                    setMessage(null);
                  }}
                  theme={{
                    calendarBackground: palette.surface,
                    dayTextColor: palette.text,
                    monthTextColor: palette.text,
                    textDisabledColor: "#44445A",
                    arrowColor: palette.primary,
                    todayTextColor: palette.success,
                    selectedDayTextColor: palette.text
                  }}
                />
              ) : (
                <DateTimePicker
                  value={datePickerValue(eventDate)}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={(_, date) => {
                    if (Platform.OS !== "ios") setShowPicker(false);
                    if (date) {
                      setEventDate(localDateKey(date));
                      setMessage(null);
                    }
                  }}
                />
              )
            ) : null}

            {eventKind !== "assessment" ? (
              <>
                <View style={styles.timeRow}>
                  <TextInput
                    mode="outlined"
                    label="Start"
                    value={startTime}
                    onChangeText={setStartTime}
                    keyboardType="numbers-and-punctuation"
                    style={styles.timeInput}
                  />
                  <TextInput
                    mode="outlined"
                    label="End"
                    value={endTime}
                    onChangeText={setEndTime}
                    keyboardType="numbers-and-punctuation"
                    style={styles.timeInput}
                  />
                </View>
                <SegmentedButtons
                  value={recurrence}
                  onValueChange={(value) => setRecurrence(value as EventRecurrence)}
                  buttons={[
                    { value: "NONE", label: "Once" },
                    { value: "WEEKLY", label: "Weekly" },
                    { value: "FORTNIGHTLY_WEEK_1", label: "Wk 1" },
                    { value: "FORTNIGHTLY_WEEK_2", label: "Wk 2" }
                  ]}
                />
                <TextInput
                  mode="outlined"
                  label="Repeat until YYYY-MM-DD"
                  value={recurrenceUntil}
                  onChangeText={setRecurrenceUntil}
                />
              </>
            ) : null}

            <TextInput
              mode="outlined"
              label="Reminder minutes before"
              keyboardType="number-pad"
              value={notificationMinutes}
              onChangeText={setNotificationMinutes}
            />
            <TextInput
              mode="outlined"
              label={eventKind === "tutor" ? "Topic / tutor goal" : eventKind === "study" ? "Notes" : "Topic / description"}
              value={description}
              multiline
              numberOfLines={3}
              onChangeText={setDescription}
            />
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDialogOpen(false)}>Cancel</Button>
            <Button mode="contained" loading={saving} disabled={!canSubmitEvent} onPress={submitEvent}>
              {editingEventId ? "Update" : "Save"}
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={Boolean(deletingEvent)} onDismiss={() => setDeletingEvent(null)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Delete event</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text style={styles.description}>
              Delete {deletingEvent?.title}? If this repeats, the whole repeating block will be removed.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeletingEvent(null)}>Cancel</Button>
            <Button mode="contained" buttonColor={palette.secondary} loading={saving} disabled={saving} onPress={confirmDelete}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  calendarLegend: {
    flexDirection: "row",
    gap: 16,
    paddingTop: 8,
    paddingHorizontal: 4
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendLabel: {
    color: palette.muted,
    fontSize: 12
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  headerText: {
    flex: 1
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8
  },
  eyebrow: {
    color: palette.primary,
    fontFamily: "Outfit_700Bold",
    marginBottom: 4
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  section: {
    gap: 12
  },
  radarCard: {
    gap: 12,
    borderColor: "rgba(245,158,11,0.22)",
    backgroundColor: "rgba(245,158,11,0.08)"
  },
  radarTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12
  },
  radarTiles: {
    flexDirection: "row",
    gap: 8
  },
  radarTile: {
    flex: 1,
    minHeight: 64,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 10
  },
  radarValue: {
    color: palette.text,
    fontSize: 22,
    fontFamily: "Outfit_700Bold"
  },
  radarLabel: {
    color: palette.muted,
    fontSize: 12
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  eventRow: {
    minHeight: 70,
    flexDirection: "row",
    backgroundColor: palette.surfaceRaised,
    borderRadius: 8,
    overflow: "hidden",
    marginVertical: 5
  },
  eventBar: {
    width: 5
  },
  eventBody: {
    flex: 1,
    padding: 12,
    gap: 3
  },
  eventActions: {
    width: 128,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: 8,
    gap: 2
  },
  eventTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  completed: {
    color: palette.muted,
    textDecorationLine: "line-through"
  },
  muted: {
    color: palette.muted,
    fontSize: 12
  },
  description: {
    color: palette.muted,
    marginTop: 4
  },
  completeAction: {
    width: 104,
    marginVertical: 5,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.success
  },
  completeText: {
    color: "#04130A",
    fontFamily: "Outfit_700Bold"
  },
  sheet: {
    marginTop: "auto",
    backgroundColor: palette.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    padding: 20,
    gap: 12
  },
  sheetActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8
  },
  dialog: {
    backgroundColor: palette.surface
  },
  dialogTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  dialogContent: {
    gap: 12
  },
  subjectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  subjectChoice: {
    maxWidth: "48%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.03)"
  },
  flexibleChoice: {
    borderColor: `${palette.success}66`,
    backgroundColor: `${palette.success}16`
  },
  subjectChoiceText: {
    color: palette.text,
    fontSize: 12
  },
  timeRow: {
    flexDirection: "row",
    gap: 10
  },
  timeInput: {
    flex: 1
  },
  message: {
    color: palette.warning,
    textAlign: "center",
    fontFamily: "Outfit_700Bold"
  }
});
