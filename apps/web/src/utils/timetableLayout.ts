import type { ITimetableEntry, ITimeSlot } from '@schedulai/shared-types';

const getReferenceId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '_id' in value) return String(value._id);
  return '';
};

const getLabSessionKey = (entry: ITimetableEntry): string | null => {
  const subject = entry.subjectId as unknown as { isLab?: boolean };
  if (entry.periodType !== 'LAB' && !subject?.isLab) return null;

  const assignment = entry.assignmentId || [
    getReferenceId(entry.semesterId),
    getReferenceId(entry.subjectId),
    getReferenceId(entry.teacherId),
  ].join(':');
  return `${assignment}:${getReferenceId(entry.batchId) || 'whole-class'}`;
};

export const shouldMergeLabSlots = (
  firstSlot: ITimeSlot,
  secondSlot: ITimeSlot,
  firstEntries: ITimetableEntry[],
  secondEntries: ITimetableEntry[]
): boolean => {
  if (
    firstSlot.day !== secondSlot.day ||
    firstSlot.periodNumber + 1 !== secondSlot.periodNumber ||
    firstSlot.endTime !== secondSlot.startTime ||
    firstEntries.length === 0 ||
    firstEntries.length !== secondEntries.length
  ) {
    return false;
  }

  const firstKeys = firstEntries.map(getLabSessionKey);
  const secondKeys = secondEntries.map(getLabSessionKey);
  if (firstKeys.some((key) => key === null) || secondKeys.some((key) => key === null)) return false;

  const normalizedFirstKeys = (firstKeys as string[]).sort();
  const normalizedSecondKeys = (secondKeys as string[]).sort();
  return normalizedFirstKeys.every((key, index) => key === normalizedSecondKeys[index]);
};