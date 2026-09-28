from typing import Dict, List, Tuple
from ..models.input_models import (
    ValidateRequest,
    ExistingTimetableEntryInput,
    DayOfWeek,
)
from ..models.output_models import (
    ValidateResponse,
    ViolationOutput,
)


class TimetableValidator:
    def __init__(self, request: ValidateRequest):
        self.timetable = request.timetable
        self.teachers = {t.id: t for t in request.teachers}
        self.subjects = {s.id: s for s in request.subjects}
        self.classrooms = {c.id: c for c in request.classrooms}
        self.semesters = {m.id: m for m in request.semesters}
        self.batches = {b.id: b for b in request.batches}
        self.timeslots = {ts.id: ts for ts in request.timeslots}
        self.assignments = request.teachingAssignments
        # Pre-compute sum of batch students per semester (for lecture capacity checks)
        self._sem_batch_student_sum: Dict[str, int] = {}
        for b in request.batches:
            self._sem_batch_student_sum[b.semesterId] = (
                self._sem_batch_student_sum.get(b.semesterId, 0) + b.studentCount
            )

    def validate(self) -> ValidateResponse:
        violations: List[ViolationOutput] = []

        # 1. Teacher conflicts: Same teacher, same timeSlotId
        teacher_slots: Dict[Tuple[str, str], List[ExistingTimetableEntryInput]] = {}
        # 2. Classroom conflicts: Same classroom, same timeSlotId
        classroom_slots: Dict[Tuple[str, str], List[ExistingTimetableEntryInput]] = {}
        # 3. Student-scope conflicts: same batch, or any batch with ALL
        semester_slots: Dict[Tuple[str, str], List[ExistingTimetableEntryInput]] = {}
        # Teacher day counts: (teacherId, day) -> count
        teacher_day_counts: Dict[Tuple[str, DayOfWeek], int] = {}
        # Teacher week counts: teacherId -> count
        teacher_week_counts: Dict[str, int] = {}

        for entry in self.timetable:
            t_key = (entry.teacherId, entry.timeSlotId)
            c_key = (entry.classroomId, entry.timeSlotId)
            s_key = (entry.semesterId, entry.timeSlotId)

            teacher_slots.setdefault(t_key, []).append(entry)
            classroom_slots.setdefault(c_key, []).append(entry)
            semester_slots.setdefault(s_key, []).append(entry)

            teacher_day_counts[(entry.teacherId, entry.day)] = teacher_day_counts.get((entry.teacherId, entry.day), 0) + 1
            teacher_week_counts[entry.teacherId] = teacher_week_counts.get(entry.teacherId, 0) + 1

            # Check Teacher Availability
            teacher = self.teachers.get(entry.teacherId)
            ts = self.timeslots.get(entry.timeSlotId)
            if teacher and ts:
                if entry.day not in teacher.availability:
                    violations.append(ViolationOutput(
                        type="TEACHER_UNAVAILABLE_DAY",
                        severity="ERROR",
                        message=f"Teacher '{teacher.name}' is scheduled on {entry.day}, but is not available on that day.",
                        entityType="TEACHER",
                        entityId=teacher.id,
                        details={"timeSlotId": entry.timeSlotId, "day": entry.day}
                    ))
                if entry.timeSlotId in teacher.unavailableTimeSlots:
                    violations.append(ViolationOutput(
                        type="TEACHER_UNAVAILABLE_SLOT",
                        severity="ERROR",
                        message=f"Teacher '{teacher.name}' is scheduled in an unavailable time slot ({ts.startTime}-{ts.endTime} on {entry.day}).",
                        entityType="TEACHER",
                        entityId=teacher.id,
                        details={"timeSlotId": entry.timeSlotId}
                    ))

            # Check Classroom Capacity
            classroom = self.classrooms.get(entry.classroomId)
            semester = self.semesters.get(entry.semesterId)
            if classroom and semester:
                if entry.batchId and entry.batchId in self.batches:
                    # Batch-specific: only that batch attends
                    student_count = self.batches[entry.batchId].studentCount
                else:
                    # Whole-semester lecture: count all batches in the semester,
                    # or fall back to semester.studentCount if no batches defined.
                    sem_batch_sum = self._sem_batch_student_sum.get(entry.semesterId, 0)
                    student_count = sem_batch_sum if sem_batch_sum > 0 else semester.studentCount
                if classroom.capacity < student_count:
                    violations.append(ViolationOutput(
                        type="CLASSROOM_CAPACITY_EXCEEDED",
                        severity="ERROR",
                        message=f"Classroom '{classroom.name}' (capacity {classroom.capacity}) cannot accommodate semester '{semester.name}' ({student_count} students).",
                        entityType="CLASSROOM",
                        entityId=classroom.id,
                        details={"capacity": classroom.capacity, "students": student_count}
                    ))

            # Check Lab Requirement
            subject = self.subjects.get(entry.subjectId)
            if subject and classroom:
                if (subject.isLab or entry.periodType == "LAB") and not classroom.isLab:
                    violations.append(ViolationOutput(
                        type="LAB_ROOM_REQUIRED",
                        severity="ERROR",
                        message=f"Subject '{subject.name}' requires a laboratory room, but '{classroom.name}' is not a lab.",
                        entityType="CLASSROOM",
                        entityId=classroom.id,
                        details={"subjectId": subject.id, "classroomId": classroom.id}
                    ))

        # Check Teacher Overlaps
        for (teacher_id, ts_id), entries in teacher_slots.items():
            if len(entries) > 1:
                teacher = self.teachers.get(teacher_id)
                t_name = teacher.name if teacher else teacher_id
                ts = self.timeslots.get(ts_id)
                time_str = f"{ts.day} {ts.startTime}-{ts.endTime}" if ts else ts_id
                violations.append(ViolationOutput(
                    type="TEACHER_CONFLICT",
                    severity="ERROR",
                    message=f"Teacher '{t_name}' is scheduled for {len(entries)} classes simultaneously at {time_str}.",
                    entityType="TEACHER",
                    entityId=teacher_id,
                    details={"timeSlotId": ts_id, "conflictingCount": len(entries)}
                ))

        # Check Classroom Overlaps
        for (c_id, ts_id), entries in classroom_slots.items():
            if len(entries) > 1:
                room = self.classrooms.get(c_id)
                r_name = room.name if room else c_id
                ts = self.timeslots.get(ts_id)
                time_str = f"{ts.day} {ts.startTime}-{ts.endTime}" if ts else ts_id
                violations.append(ViolationOutput(
                    type="CLASSROOM_CONFLICT",
                    severity="ERROR",
                    message=f"Classroom '{r_name}' is double-booked with {len(entries)} classes at {time_str}.",
                    entityType="CLASSROOM",
                    entityId=c_id,
                    details={"timeSlotId": ts_id, "conflictingCount": len(entries)}
                ))

        # Check student-scope overlaps. Legacy entries without batch are ALL.
        for (s_id, ts_id), entries in semester_slots.items():
            scopes: Dict[str, List[ExistingTimetableEntryInput]] = {}
            for entry in entries:
                scopes.setdefault(entry.batchId or "ALL", []).append(entry)
            conflicting_entries: List[ExistingTimetableEntryInput] = []
            if "ALL" in scopes:
                conflicting_entries = entries if len(entries) > 1 else []
            else:
                conflicting_entries = [entry for group in scopes.values() if len(group) > 1 for entry in group]
            if conflicting_entries:
                semester = self.semesters.get(s_id)
                s_name = semester.name if semester else s_id
                ts = self.timeslots.get(ts_id)
                time_str = f"{ts.day} {ts.startTime}-{ts.endTime}" if ts else ts_id
                violations.append(ViolationOutput(
                    type="SEMESTER_CONFLICT",
                    severity="ERROR",
                    message=f"Semester '{s_name}' has {len(conflicting_entries)} classes scheduled simultaneously at {time_str}.",
                    entityType="SEMESTER",
                    entityId=s_id,
                    details={"timeSlotId": ts_id, "conflictingCount": len(conflicting_entries)}
                ))

        # Check Daily and Weekly Teacher Limits
        for (t_id, day), count in teacher_day_counts.items():
            teacher = self.teachers.get(t_id)
            if teacher and count > teacher.maxClassesPerDay:
                violations.append(ViolationOutput(
                    type="TEACHER_DAILY_LIMIT_EXCEEDED",
                    severity="WARNING",
                    message=f"Teacher '{teacher.name}' has {count} classes on {day}, exceeding their daily limit of {teacher.maxClassesPerDay}.",
                    entityType="TEACHER",
                    entityId=t_id,
                    details={"day": day, "count": count, "max": teacher.maxClassesPerDay}
                ))

        for t_id, count in teacher_week_counts.items():
            teacher = self.teachers.get(t_id)
            if teacher and count > teacher.maxClassesPerWeek:
                violations.append(ViolationOutput(
                    type="TEACHER_WEEKLY_LIMIT_EXCEEDED",
                    severity="WARNING",
                    message=f"Teacher '{teacher.name}' has {count} classes in total, exceeding their weekly limit of {teacher.maxClassesPerWeek}.",
                    entityType="TEACHER",
                    entityId=t_id,
                    details={"count": count, "max": teacher.maxClassesPerWeek}
                ))

        is_valid = not any(v.severity == "ERROR" for v in violations)

        return ValidateResponse(
            isValid=is_valid,
            violations=violations,
            stats={
                "totalEntries": len(self.timetable),
                "conflictsCount": len(violations),
                "errorCount": sum(1 for v in violations if v.severity == "ERROR"),
                "warningCount": sum(1 for v in violations if v.severity == "WARNING"),
            }
        )
