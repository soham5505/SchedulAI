from typing import Dict, List, Optional, Tuple
from ..models.input_models import (
    SuggestRequest,
    ExistingTimetableEntryInput,
    DayOfWeek,
    TimeSlotInput,
    ClassroomInput,
)
from ..models.output_models import (
    SuggestResponse,
    SlotSuggestionOutput,
    ViolationOutput,
)
from .validator import TimetableValidator
from ..models.input_models import ValidateRequest


class SlotSuggester:
    def __init__(self, request: SuggestRequest):
        self.request = request
        self.teachers = {t.id: t for t in request.teachers}
        self.subjects = {s.id: s for s in request.subjects}
        self.classrooms = {c.id: c for c in request.classrooms}
        self.semesters = {m.id: m for m in request.semesters}
        self.timeslots = {ts.id: ts for ts in request.timeslots if ts.isActive and not ts.isBreak}
        self.assignments = request.teachingAssignments
        self.current_timetable = request.currentTimetable

    def suggest(self) -> SuggestResponse:
        # Find the entry to move
        target_entry: Optional[ExistingTimetableEntryInput] = None
        remaining_entries: List[ExistingTimetableEntryInput] = []

        for entry in self.current_timetable:
            if entry.id == self.request.entryId:
                target_entry = entry
            else:
                remaining_entries.append(entry)

        if not target_entry:
            # If id not explicitly set, match by slot/semester/subject
            for idx, entry in enumerate(self.current_timetable):
                if entry.timeSlotId == self.request.targetTimeSlotId or idx == 0:
                    target_entry = entry
                    remaining_entries = [e for i, e in enumerate(self.current_timetable) if i != idx]
                    break

        if not target_entry:
            return SuggestResponse(
                valid=False,
                conflicts=[ViolationOutput(type="ENTRY_NOT_FOUND", message="Timetable entry to move was not found.")],
                suggestions=[]
            )

        target_ts = self.timeslots.get(self.request.targetTimeSlotId)
        target_room_id = self.request.targetClassroomId or target_entry.classroomId

        # Check if the proposed move itself is valid
        proposed_entry = ExistingTimetableEntryInput(
            id=target_entry.id,
            semesterId=target_entry.semesterId,
            subjectId=target_entry.subjectId,
            teacherId=target_entry.teacherId,
            classroomId=target_room_id,
            timeSlotId=self.request.targetTimeSlotId,
            day=target_ts.day if target_ts else target_entry.day,
            startTime=target_ts.startTime if target_ts else target_entry.startTime,
            endTime=target_ts.endTime if target_ts else target_entry.endTime,
            periodType=target_entry.periodType,
        )

        test_timetable = remaining_entries + [proposed_entry]
        validator = TimetableValidator(
            ValidateRequest(
                timetable=test_timetable,
                teachers=list(self.teachers.values()),
                subjects=list(self.subjects.values()),
                classrooms=list(self.classrooms.values()),
                semesters=list(self.semesters.values()),
                timeslots=list(self.timeslots.values()),
                teachingAssignments=self.assignments,
            )
        )
        val_response = validator.validate()

        conflicts = [v for v in val_response.violations if v.severity == "ERROR"]
        is_valid = len(conflicts) == 0

        # Now compute alternative valid slot suggestions
        teacher = self.teachers.get(target_entry.teacherId)
        subject = self.subjects.get(target_entry.subjectId)
        semester = self.semesters.get(target_entry.semesterId)

        suggestions: List[SlotSuggestionOutput] = []

        # Find all busy slots for this teacher, semester, and classrooms in remaining_entries
        busy_teachers: Dict[Tuple[str, str], bool] = {}
        busy_semesters: Dict[Tuple[str, str], bool] = {}
        busy_classrooms: Dict[Tuple[str, str], bool] = {}

        for entry in remaining_entries:
            busy_teachers[(entry.teacherId, entry.timeSlotId)] = True
            busy_semesters[(entry.semesterId, entry.timeSlotId)] = True
            busy_classrooms[(entry.classroomId, entry.timeSlotId)] = True

        for ts_id, ts in self.timeslots.items():
            if not ts.isActive or ts.isBreak:
                continue

            # 1. Teacher availability
            if teacher:
                if ts.day not in teacher.availability:
                    continue
                if ts_id in teacher.unavailableTimeSlots:
                    continue
                if (teacher.id, ts_id) in busy_teachers:
                    continue

            # 2. Semester availability
            if semester:
                if (semester.id, ts_id) in busy_semesters:
                    continue

            # 3. Compatible classrooms
            for c_id, classroom in self.classrooms.items():
                if not classroom.isAvailable:
                    continue
                if (c_id, ts_id) in busy_classrooms:
                    continue
                if semester and classroom.capacity < semester.studentCount:
                    continue
                if subject and (subject.isLab or target_entry.periodType == "LAB") and not classroom.isLab:
                    continue

                # Calculate score
                score = 80.0
                reason_parts = []

                if teacher and ts_id in teacher.preferredTimeSlots:
                    score += 15.0
                    reason_parts.append("Preferred slot for teacher")

                if ts.periodNumber == 1:
                    score -= 5.0
                elif ts.periodNumber in (2, 3, 4):
                    score += 5.0
                    reason_parts.append("Prime academic period")

                if ts.day == DayOfWeek.FRIDAY and ts.periodNumber >= 5:
                    score -= 10.0

                if classroom.id == target_entry.classroomId:
                    score += 5.0
                    reason_parts.append("Same classroom")

                reason = ", ".join(reason_parts) if reason_parts else "Conflict-free valid slot"

                suggestions.append(
                    SlotSuggestionOutput(
                        timeSlotId=ts_id,
                        timeSlot=ts,
                        classroomId=c_id,
                        classroom=classroom,
                        score=max(0.0, min(100.0, score)),
                        reason=reason,
                    )
                )

        # Sort suggestions by score descending
        suggestions.sort(key=lambda s: s.score, reverse=True)
        top_suggestions = suggestions[:8]

        return SuggestResponse(
            valid=is_valid,
            conflicts=conflicts,
            suggestions=top_suggestions,
        )
