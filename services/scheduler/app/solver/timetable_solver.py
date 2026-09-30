import time
from typing import Dict, List, Tuple, Any, Optional
from ortools.sat.python import cp_model
from ..models.input_models import (
    GenerateRequest,
    DayOfWeek,
    PeriodType,
    TeacherInput,
    SubjectInput,
    ClassroomInput,
    SemesterInput,
    BatchInput,
    TimeSlotInput,
    RoomBlockInput,
    AssignmentInput,
    HardConstraintsInput,
)
from ..models.output_models import (
    GenerateResponse,
    TimetableEntryOutput,
    ViolationOutput,
)


class TimetableSolver:
    def __init__(self, request: GenerateRequest):
        self.request = request
        self.teachers = {t.id: t for t in request.teachers}
        self.subjects = {s.id: s for s in request.subjects}
        self.classrooms = {c.id: c for c in request.classrooms}
        self.semesters = {m.id: m for m in request.semesters}
        self.batches = {b.id: b for b in request.batches}
        self.timeslots = {ts.id: ts for ts in request.timeslots if ts.isActive and not ts.isBreak}
        self.assignments = request.teachingAssignments
        self.room_blocks_by_classroom_day: Dict[Tuple[str, DayOfWeek], List[RoomBlockInput]] = {}
        for block in request.roomBlocks:
            self.room_blocks_by_classroom_day.setdefault(
                (block.classroomId, block.dayOfWeek), []
            ).append(block)
        self.hard_constraints = HardConstraintsInput()
        self.soft_constraints = request.softConstraints
        self.time_limit = request.timeLimitSeconds or 60

        # Sort timeslots chronologically: (day_index, periodNumber)
        day_order = {
            DayOfWeek.MONDAY: 0,
            DayOfWeek.TUESDAY: 1,
            DayOfWeek.WEDNESDAY: 2,
            DayOfWeek.THURSDAY: 3,
            DayOfWeek.FRIDAY: 4,
            DayOfWeek.SATURDAY: 5,
        }
        self.sorted_timeslots: List[TimeSlotInput] = sorted(
            self.timeslots.values(),
            key=lambda ts: (day_order.get(ts.day, 99), ts.periodNumber)
        )
        self.ts_to_idx = {ts.id: idx for idx, ts in enumerate(self.sorted_timeslots)}

        # Group timeslots by day
        self.timeslots_by_day: Dict[DayOfWeek, List[TimeSlotInput]] = {}
        for ts in self.sorted_timeslots:
            self.timeslots_by_day.setdefault(ts.day, []).append(ts)

    @staticmethod
    def _student_scope(batch_id: Optional[str]) -> str:
        return batch_id or "ALL"

    def _batch_student_sum(self, semester_id: str) -> int:
        """Sum of studentCount for all batches belonging to *semester_id*.
        Returns 0 if no batches are associated with the semester."""
        return sum(
            b.studentCount
            for b in self.batches.values()
            if b.semesterId == semester_id
        )

    def _student_count(self, assignment: AssignmentInput) -> int:
        """Return the number of students who will attend this assignment.

        - Batch-specific assignment (batchId is set): return the batch's own
          studentCount, since only that batch attends.
        - Whole-semester lecture (batchId is None/NULL): the entire semester
          attends together.  If the semester has explicit batches, return the
          **sum** of their studentCounts (e.g. B1+B2+B3+B4 = 4×20 = 80).
          Fall back to semester.studentCount when no batches are registered.
        """
        if assignment.batchId and assignment.batchId in self.batches:
            return self.batches[assignment.batchId].studentCount
        # Whole-semester lecture: count students across all batches
        total_from_batches = self._batch_student_sum(assignment.semesterId)
        if total_from_batches > 0:
            return total_from_batches
        semester = self.semesters.get(assignment.semesterId)
        return semester.studentCount if semester else 0

    @staticmethod
    def _lab_slots_are_adjacent(first: TimeSlotInput, second: TimeSlotInput) -> bool:
        if first.day != second.day:
            return False
        if second.periodNumber != first.periodNumber + 1:
            return False
        first_end = int(first.endTime[:2]) * 60 + int(first.endTime[3:])
        second_start = int(second.startTime[:2]) * 60 + int(second.startTime[3:])
        return second_start == first_end

    @staticmethod
    def _period_intervals_overlap(
        session_start: int,
        session_duration: int,
        blocked_start: int,
        blocked_duration: int,
    ) -> bool:
        """Return whether half-open teaching-period intervals overlap.

        A session [start, end) conflicts with a reservation [block_start,
        block_end) exactly when start < block_end and end > block_start.
        """
        session_end = session_start + session_duration
        blocked_end = blocked_start + blocked_duration
        return session_start < blocked_end and session_end > blocked_start

    def _is_classroom_blocked(self, classroom_id: str, timeslot: TimeSlotInput) -> bool:
        """Whether a room is unavailable for this occupied teaching period."""
        blocks = self.room_blocks_by_classroom_day.get((classroom_id, timeslot.day), [])
        return any(
            self._period_intervals_overlap(
                timeslot.periodNumber,
                1,
                block.startPeriod,
                block.duration,
            )
            for block in blocks
        )

    def _print_diagnostics(self) -> None:
        """Print diagnostic information about semester and faculty workload."""
        print("\n" + "="*80)
        print("SCHEDULER DIAGNOSTICS")
        print("="*80)
        
        # Semester workload analysis
        print("\nSEMESTER WORKLOAD ANALYSIS:")
        print("-" * 80)
        
        sem_workload: Dict[str, Dict[str, Any]] = {}
        for a in self.assignments:
            if a.semesterId not in sem_workload:
                sem_workload[a.semesterId] = {
                    'theory_periods': 0,
                    'lab_periods': 0,
                    'total_periods': 0,
                    'assignment_count': 0,
                    'unique_courses': set()
                }
            
            subject = self.subjects.get(a.subjectId)
            is_lab = a.isLab or (subject and subject.isLab)
            
            sem_workload[a.semesterId]['total_periods'] += a.periodsPerWeek
            sem_workload[a.semesterId]['assignment_count'] += 1
            if subject:
                sem_workload[a.semesterId]['unique_courses'].add(subject.code)
            
            # Try to infer whether this is theory or lab based on subject flag
            if is_lab:
                sem_workload[a.semesterId]['lab_periods'] += a.periodsPerWeek
            else:
                sem_workload[a.semesterId]['theory_periods'] += a.periodsPerWeek
        
        for sem_id, workload in sem_workload.items():
            semester = self.semesters.get(sem_id)
            sem_name = semester.name if semester else sem_id
            print(f"\nSemester: {sem_name}")
            print(f"  Unique Courses: {len(workload['unique_courses'])}")
            print(f"  Theory Weekly Periods: {workload['theory_periods']}")
            print(f"  Lab Weekly Periods: {workload['lab_periods']}")
            print(f"  Total Weekly Periods Required: {workload['total_periods']}")
            print(f"  Total Assignments: {workload['assignment_count']}")
            print(f"  Active Time Slots Available: {len(self.timeslots)}")
            
            if workload['total_periods'] > len(self.timeslots):
                print(f"  ⚠️  WARNING: Total demand ({workload['total_periods']}) exceeds available slots ({len(self.timeslots)})")
        
        # Faculty workload analysis
        print("\n\nFACULTY WORKLOAD ANALYSIS:")
        print("-" * 80)
        
        teacher_workload: Dict[str, Dict[str, Any]] = {}
        for a in self.assignments:
            if a.teacherId not in teacher_workload:
                teacher_workload[a.teacherId] = {
                    'allocated_periods': 0,
                    'assignment_count': 0,
                    'subjects': []
                }
            
            teacher_workload[a.teacherId]['allocated_periods'] += a.periodsPerWeek
            teacher_workload[a.teacherId]['assignment_count'] += 1
            
            subject = self.subjects.get(a.subjectId)
            if subject:
                teacher_workload[a.teacherId]['subjects'].append(f"{subject.code} ({a.periodsPerWeek})")
        
        for teacher_id, workload in teacher_workload.items():
            teacher = self.teachers.get(teacher_id)
            teacher_name = teacher.name if teacher else teacher_id
            print(f"\nFaculty: {teacher_name}")
            print(f"  Allocated Weekly Periods: {workload['allocated_periods']}")
            print(f"  Configured Max Weekly Periods: {teacher.maxClassesPerWeek if teacher else 'N/A'}")
            is_source_defined = getattr(teacher, 'isMaxWeeklySourceDefined', True) if teacher else False
            max_source = "source-defined" if is_source_defined else "UI default (not from source data)"
            print(f"  Max Weekly Periods Source: {max_source}")
            print(f"  Total Assignments: {workload['assignment_count']}")
            print(f"  Subjects: {', '.join(workload['subjects'])}")
            
            if teacher and workload['allocated_periods'] > teacher.maxClassesPerWeek:
                if is_source_defined:
                    print(f"  ⚠️  WARNING: Allocated ({workload['allocated_periods']}) exceeds source-defined max ({teacher.maxClassesPerWeek})")
                else:
                    print(f"  ℹ️  INFO: Allocated ({workload['allocated_periods']}) exceeds UI default max ({teacher.maxClassesPerWeek}), but max is not source-defined so constraint will be disabled")
        
        print("\nActive Time Slots: " + str(len(self.timeslots)))
        print("="*80 + "\n")

    def solve(self) -> GenerateResponse:
        start_time = time.time()

        # Step -1: Print diagnostic information
        self._print_diagnostics()

        # Step 0: Quick feasibility pre-checks
        precheck_violations = self._precheck_feasibility()
        if precheck_violations:
            return GenerateResponse(
                success=False,
                status="FAILED",
                timetable=[],
                score=0.0,
                violations=precheck_violations,
                errorMessage="Feasibility pre-check failed. See violations for details."
            )

        model = cp_model.CpModel()

        # x[assignment_id, instance_idx, timeslot_id, classroom_id] = BoolVar
        x: Dict[Tuple[str, int, str, str], cp_model.IntVar] = {}
        # instance_ts_var[assignment_id, instance_idx] = IntVar(0..num_timeslots-1)
        instance_ts_var: Dict[Tuple[str, int], cp_model.IntVar] = {}

        num_timeslots = len(self.sorted_timeslots)
        if num_timeslots == 0:
            return GenerateResponse(
                success=False,
                status="FAILED",
                timetable=[],
                score=0.0,
                violations=[ViolationOutput(
                    type="NO_ACTIVE_TIMESLOTS",
                    severity="ERROR",
                    message="No active non-break time slots available for scheduling."
                )],
                errorMessage="No active time slots available."
            )

        # 1. Create Variables
        for a in self.assignments:
            teacher = self.teachers.get(a.teacherId)
            subject = self.subjects.get(a.subjectId)
            semester = self.semesters.get(a.semesterId)

            if not teacher or not subject or not semester:
                continue

            num_periods = a.periodsPerWeek
            for k in range(num_periods):
                valid_pairs = []
                for ts in self.sorted_timeslots:
                    # Teacher availability check
                    if ts.day not in teacher.availability or ts.id in teacher.unavailableTimeSlots:
                        continue

                    for c in self.classrooms.values():
                        if not c.isAvailable:
                            continue

                        # Room reservations are an unconditional hard constraint.
                        # Each lab period receives its own candidate check, so a
                        # two-period lab is rejected when either occupied period
                        # overlaps a reservation.
                        if self._is_classroom_blocked(c.id, ts):
                            continue

                        is_lab_instance = a.isLab or subject.isLab
                        # Capacity check
                        required_capacity = max(20, self._student_count(a)) if is_lab_instance else max(80, self._student_count(a))
                        if c.capacity < required_capacity:
                            continue

                        if a.classroomId and c.id != a.classroomId:
                            continue

                        # Lab check
                        if is_lab_instance and not c.isLab:
                            continue
                        if not is_lab_instance and c.isLab:
                            continue

                        # Specific classroom requirements
                        if a.classroomRequirements:
                            if not any(req in c.equipment or req == c.type.value for req in a.classroomRequirements):
                                continue

                        var_name = f"x_{a.id}_{k}_{ts.id}_{c.id}"
                        var = model.NewBoolVar(var_name)
                        x[(a.id, k, ts.id, c.id)] = var
                        valid_pairs.append((ts, c, var))

                if not valid_pairs:
                    return GenerateResponse(
                        success=False,
                        status="FAILED",
                        timetable=[],
                        score=0.0,
                        violations=[ViolationOutput(
                            type="NO_VALID_SLOT_ROOM_PAIR",
                            severity="ERROR",
                            message=f"No valid time slot and room found for assignment {subject.name} ({teacher.name} -> {semester.name}). Check teacher availability and room capacities.",
                            details={"assignmentId": a.id, "subject": subject.name, "teacher": teacher.name}
                        )],
                        errorMessage="Infeasible: A required period has zero valid slot/room combinations."
                    )

                # Exactly one (timeslot, classroom) assigned for this period instance
                model.AddExactlyOne([v for _, _, v in valid_pairs])

                # Integer variable representing the timeslot index for symmetry breaking & ordering
                ts_idx_var = model.NewIntVar(0, num_timeslots - 1, f"ts_idx_{a.id}_{k}")
                instance_ts_var[(a.id, k)] = ts_idx_var

                # Link ts_idx_var with boolean x variables: ts_idx_var = sum(ts_to_idx[ts.id] * x)
                model.Add(
                    ts_idx_var == sum(
                        self.ts_to_idx[ts.id] * var for ts, _, var in valid_pairs
                    )
                )

            # Symmetry breaking: instance k must occur strictly before instance k+1
            for k in range(num_periods - 1):
                if (a.id, k) in instance_ts_var and (a.id, k + 1) in instance_ts_var:
                    model.Add(instance_ts_var[(a.id, k)] < instance_ts_var[(a.id, k + 1)])

        # A practical is one paired, same-room block occupying two adjacent
        # teaching periods. A short break may separate periods; lunch may not.
        lab_blocks_by_batch_day: Dict[Tuple[str, str, DayOfWeek], List[cp_model.IntVar]] = {}
        for assignment in self.assignments:
            subject = self.subjects.get(assignment.subjectId)
            if not subject or not (assignment.isLab or subject.isLab):
                continue
            if assignment.periodsPerWeek != 2:
                continue

            block_records = []
            for first_index, first_slot in enumerate(self.sorted_timeslots):
                for second_slot in self.sorted_timeslots[first_index + 1:]:
                    if not self._lab_slots_are_adjacent(first_slot, second_slot):
                        if second_slot.day != first_slot.day:
                            break
                        continue
                    for classroom in self.classrooms.values():
                        first_var = x.get((assignment.id, 0, first_slot.id, classroom.id))
                        second_var = x.get((assignment.id, 1, second_slot.id, classroom.id))
                        if first_var is None or second_var is None:
                            continue
                        block_var = model.NewBoolVar(
                            f"lab_block_{assignment.id}_{first_slot.id}_{classroom.id}"
                        )
                        model.Add(block_var <= first_var)
                        model.Add(block_var <= second_var)
                        model.Add(block_var >= first_var + second_var - 1)
                        block_records.append((block_var, first_slot, second_slot, classroom.id))
                        if assignment.batchId:
                            key = (assignment.semesterId, assignment.batchId, first_slot.day)
                            lab_blocks_by_batch_day.setdefault(key, []).append(block_var)

            if not block_records:
                return GenerateResponse(
                    success=False,
                    status="FAILED",
                    timetable=[],
                    score=0.0,
                    violations=[ViolationOutput(
                        type="NO_VALID_LAB_BLOCK",
                        severity="ERROR",
                        message=f"No adjacent two-period lab block is available for assignment {subject.name}.",
                        details={"assignmentId": assignment.id},
                    )],
                    errorMessage="No valid consecutive two-period lab block is available.",
                )

            model.AddExactlyOne([record[0] for record in block_records])
            for instance_index in range(2):
                for slot in self.sorted_timeslots:
                    for classroom in self.classrooms.values():
                        period_var = x.get((assignment.id, instance_index, slot.id, classroom.id))
                        if period_var is None:
                            continue
                        matching_blocks = [
                            block_var
                            for block_var, first_slot, second_slot, room_id in block_records
                            if room_id == classroom.id
                            and slot.id == (first_slot.id if instance_index == 0 else second_slot.id)
                        ]
                        model.Add(period_var == sum(matching_blocks))

        for block_vars in lab_blocks_by_batch_day.values():
            model.Add(sum(block_vars) <= 1)

        # 2. Hard Constraints

        # Teacher No-Overlap: At most one class per timeslot for each teacher
        if self.hard_constraints.enforceTeacherConflicts:
            for teacher_id in self.teachers:
                for ts in self.sorted_timeslots:
                    teacher_vars = []
                    for a in self.assignments:
                        if a.teacherId == teacher_id:
                            for k in range(a.periodsPerWeek):
                                for c in self.classrooms.values():
                                    if (a.id, k, ts.id, c.id) in x:
                                        teacher_vars.append(x[(a.id, k, ts.id, c.id)])
                    if teacher_vars:
                        model.AddAtMostOne(teacher_vars)

        # Classroom No-Overlap: At most one class per timeslot for each classroom
        if self.hard_constraints.enforceClassroomConflicts:
            for c_id in self.classrooms:
                for ts in self.sorted_timeslots:
                    room_vars = []
                    for a in self.assignments:
                        for k in range(a.periodsPerWeek):
                            if (a.id, k, ts.id, c_id) in x:
                                room_vars.append(x[(a.id, k, ts.id, c_id)])
                    if room_vars:
                        model.AddAtMostOne(room_vars)

        # Student scope no-overlap:
        #   - ALL: blocks every other assignment in the same semester at the same time.
        #   - Batch B_N: conflicts only with same batch B_N OR with an ALL assignment.
        #   - Different specific batches (B1 vs B2) may run in parallel.
        if self.hard_constraints.enforceSemesterConflicts:
            for sem_id in self.semesters:
                for ts in self.sorted_timeslots:
                    scope_vars: Dict[str, List[cp_model.IntVar]] = {}
                    for a in self.assignments:
                        if a.semesterId == sem_id:
                            scope = self._student_scope(a.batchId)
                            scope_vars.setdefault(scope, [])
                            for k in range(a.periodsPerWeek):
                                for c in self.classrooms.values():
                                    if (a.id, k, ts.id, c.id) in x:
                                        scope_vars[scope].append(x[(a.id, k, ts.id, c.id)])

                    all_vars = scope_vars.get("ALL", [])

                    # ALL vs ALL: at most one ALL assignment at any time
                    if all_vars:
                        model.AddAtMostOne(all_vars)

                    # Each specific batch: at most one per timeslot
                    for scope, b_vars in scope_vars.items():
                        if scope == "ALL":
                            continue
                        if b_vars:
                            model.AddAtMostOne(b_vars)

                    # ALL vs each specific batch: if an ALL is active, no batch may
                    # run at the same time (and vice versa).
                    if all_vars:
                        for scope, b_vars in scope_vars.items():
                            if scope == "ALL":
                                continue
                            if b_vars:
                                # Together they must sum to at most 1
                                model.AddAtMostOne(all_vars + b_vars)

        # Teacher Workload Limits
        if self.hard_constraints.enforceTeacherWorkloadLimits:
            for teacher in self.teachers.values():
                # Daily limit
                for day, day_slots in self.timeslots_by_day.items():
                    day_vars = []
                    for a in self.assignments:
                        if a.teacherId == teacher.id:
                            for k in range(a.periodsPerWeek):
                                for ts in day_slots:
                                    for c in self.classrooms.values():
                                        if (a.id, k, ts.id, c.id) in x:
                                            day_vars.append(x[(a.id, k, ts.id, c.id)])
                    if day_vars:
                        model.Add(sum(day_vars) <= teacher.maxClassesPerDay)

                all_teacher_vars = []
                for a in self.assignments:
                    if a.teacherId == teacher.id:
                        for k in range(a.periodsPerWeek):
                            for ts in self.sorted_timeslots:
                                for c in self.classrooms.values():
                                    if (a.id, k, ts.id, c.id) in x:
                                        all_teacher_vars.append(x[(a.id, k, ts.id, c.id)])
                if all_teacher_vars:
                    model.Add(sum(all_teacher_vars) <= teacher.maxClassesPerWeek)

        # 3. Soft Constraints / Objective
        objective_terms = []

        # A. Spread subjects across days: Penalize multiple classes of same subject on same day
        spread_weight = self.soft_constraints.spreadSubjects
        if spread_weight > 0:
            for a in self.assignments:
                for day, day_slots in self.timeslots_by_day.items():
                    day_sub_vars = []
                    for k in range(a.periodsPerWeek):
                        for ts in day_slots:
                            for c in self.classrooms.values():
                                if (a.id, k, ts.id, c.id) in x:
                                    day_sub_vars.append(x[(a.id, k, ts.id, c.id)])
                    if len(day_sub_vars) > 1:
                        # Extra periods on the same day beyond 1 incur penalty
                        extra_var = model.NewIntVar(0, a.periodsPerWeek, f"extra_day_{a.id}_{day}")
                        model.Add(extra_var >= sum(day_sub_vars) - 1)
                        objective_terms.append(-spread_weight * 10 * extra_var)

        # B. Avoid Early Morning (Period 1)
        early_weight = self.soft_constraints.avoidEarlyMorning
        if early_weight > 0:
            for ts in self.sorted_timeslots:
                if ts.periodNumber == 1:
                    for (a_id, k, ts_id, c_id), var in x.items():
                        if ts_id == ts.id:
                            objective_terms.append(-early_weight * 5 * var)

        # C. Avoid Friday Afternoon
        fri_weight = self.soft_constraints.avoidFridayAfternoon
        if fri_weight > 0:
            for ts in self.sorted_timeslots:
                if ts.day == DayOfWeek.FRIDAY and ts.periodNumber >= 5:
                    for (a_id, k, ts_id, c_id), var in x.items():
                        if ts_id == ts.id:
                            objective_terms.append(-fri_weight * 8 * var)

        # D. Prefer Teacher Preferred Time Slots
        pref_weight = self.soft_constraints.preferTeacherPreferredPeriods
        if pref_weight > 0:
            for teacher in self.teachers.values():
                if teacher.preferredTimeSlots:
                    for ts_id in teacher.preferredTimeSlots:
                        for a in self.assignments:
                            if a.teacherId == teacher.id:
                                for k in range(a.periodsPerWeek):
                                    for c in self.classrooms.values():
                                        if (a.id, k, ts_id, c.id) in x:
                                            objective_terms.append(pref_weight * 12 * x[(a.id, k, ts_id, c.id)])

        # Maximize total objective
        if objective_terms:
            model.Maximize(sum(objective_terms))

        # 4. Run Solver
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(self.time_limit)
        solver.parameters.num_search_workers = 4

        status = solver.Solve(model)
        elapsed_time = time.time() - start_time

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            timetable: List[TimetableEntryOutput] = []
            for (a_id, k, ts_id, c_id), var in x.items():
                if solver.Value(var) == 1:
                    assignment = next(a for a in self.assignments if a.id == a_id)
                    subject = self.subjects[assignment.subjectId]
                    ts = self.timeslots[ts_id]

                    # Determine period type (lecture vs lab)
                    p_type = PeriodType.LAB if (assignment.isLab or subject.isLab) else PeriodType.LECTURE
                    if not assignment.isLab and not subject.isLab and subject.labPeriods > 0:
                        if k >= subject.lecturePeriods:
                            p_type = PeriodType.LAB

                    timetable.append(
                        TimetableEntryOutput(
                            assignmentId=assignment.id,
                            semesterId=assignment.semesterId,
                            batchId=assignment.batchId,
                            subjectId=assignment.subjectId,
                            teacherId=assignment.teacherId,
                            classroomId=c_id,
                            timeSlotId=ts_id,
                            day=ts.day,
                            startTime=ts.startTime,
                            endTime=ts.endTime,
                            periodType=p_type,
                        )
                    )

            # Sort timetable entries chronologically
            day_order = {
                DayOfWeek.MONDAY: 0,
                DayOfWeek.TUESDAY: 1,
                DayOfWeek.WEDNESDAY: 2,
                DayOfWeek.THURSDAY: 3,
                DayOfWeek.FRIDAY: 4,
                DayOfWeek.SATURDAY: 5,
            }
            timetable.sort(key=lambda e: (day_order.get(e.day, 99), e.startTime, e.semesterId))

            score = 100.0 if status == cp_model.OPTIMAL else 85.0
            return GenerateResponse(
                success=True,
                status="COMPLETED",
                timetable=timetable,
                score=score,
                violations=[],
                statistics={
                    "totalAssignments": len(self.assignments),
                    "scheduledCount": len(timetable),
                    "unassignedCount": 0,
                    "solveTimeSeconds": round(elapsed_time, 3),
                    "status": solver.StatusName(status),
                    "branches": solver.NumBranches(),
                    "wallTime": solver.WallTime(),
                }
            )
        else:
            # Diagnostics on infeasibility
            diagnostics = self._diagnose_infeasibility()
            return GenerateResponse(
                success=False,
                status="FAILED",
                timetable=[],
                score=0.0,
                violations=diagnostics,
                statistics={
                    "solveTimeSeconds": round(elapsed_time, 3),
                    "status": solver.StatusName(status),
                },
                errorMessage="The scheduler could not find a feasible timetable satisfying all hard constraints."
            )

    def _precheck_feasibility(self) -> List[ViolationOutput]:
        violations = []
        # Total slots required vs total slots available
        num_slots = len(self.timeslots)
        if num_slots == 0:
            violations.append(ViolationOutput(
                type="NO_TIMESLOTS",
                severity="ERROR",
                message="There are no active, non-break time slots defined."
            ))
            return violations

        # Check semester period demand vs available time slots.
        # Batch-aware: different specific batches may run in parallel, so they each
        # independently consume slots.  The semester "sequential" demand is:
        #   ALL-scope periods  +  max(periods per individual batch)
        # This gives a conservative lower-bound on slots needed.
        sem_all_demand: Dict[str, int] = {}    # sum of ALL-scope periods per semester
        sem_batch_demand: Dict[str, Dict[str, int]] = {}  # per-batch demand: sem -> batch -> periods
        teacher_demand: Dict[str, int] = {}

        for a in self.assignments:
            subject = self.subjects.get(a.subjectId)
            if subject and (a.isLab or subject.isLab) and a.periodsPerWeek != 2:
                violations.append(ViolationOutput(
                    type="INVALID_LAB_WEEKLY_PERIODS",
                    severity="ERROR",
                    message=f"Lab assignment {subject.name} must have exactly 2 periods per week for one two-period practical.",
                    details={"assignmentId": a.id, "expectedPeriods": 2, "actualPeriods": a.periodsPerWeek},
                ))
            teacher_demand[a.teacherId] = teacher_demand.get(a.teacherId, 0) + a.periodsPerWeek
            scope = self._student_scope(a.batchId)
            if scope == "ALL":
                sem_all_demand[a.semesterId] = sem_all_demand.get(a.semesterId, 0) + a.periodsPerWeek
            else:
                if a.semesterId not in sem_batch_demand:
                    sem_batch_demand[a.semesterId] = {}
                sem_batch_demand[a.semesterId][scope] = (
                    sem_batch_demand[a.semesterId].get(scope, 0) + a.periodsPerWeek
                )

        # Collect all semester IDs we need to check
        all_sem_ids = set(sem_all_demand.keys()) | set(sem_batch_demand.keys())

        for sem_id in all_sem_ids:
            sem = self.semesters.get(sem_id)
            name = sem.name if sem else sem_id

            all_periods = sem_all_demand.get(sem_id, 0)
            batch_periods = sem_batch_demand.get(sem_id, {})
            # Max single-batch demand (batches can be parallel, but each batch still
            # needs its own sequential slots)
            max_batch = max(batch_periods.values(), default=0)
            demand = all_periods + max_batch

            if demand > num_slots:
                violations.append(ViolationOutput(
                    type="SEMESTER_SLOT_EXCEEDED",
                    severity="ERROR",
                    message=(
                        f"Semester '{name}' requires at least {demand} sequential time slots "
                        f"({all_periods} whole-class + {max_batch} max single-batch), "
                        f"but only {num_slots} active time slots exist."
                    ),
                    entityType="SEMESTER",
                    entityId=sem_id,
                    details={"required": demand, "availableSlots": num_slots}
                ))

        for t_id, demand in teacher_demand.items():
            teacher = self.teachers.get(t_id)
            if not teacher:
                continue
            # Check availability days
            available_slots_for_teacher = sum(
                1 for ts in self.timeslots.values()
                if ts.day in teacher.availability and ts.id not in teacher.unavailableTimeSlots
            )
            if demand > available_slots_for_teacher:
                violations.append(ViolationOutput(
                    type="TEACHER_SLOT_EXCEEDED",
                    severity="ERROR",
                    message=f"Teacher '{teacher.name}' is assigned {demand} periods, but has only {available_slots_for_teacher} available time slots.",
                    entityType="TEACHER",
                    entityId=t_id,
                    details={"assigned": demand, "available": available_slots_for_teacher}
                ))
            # Only check weekly limit if source data explicitly defines it.
            # Default is False so that UI-default maxClassesPerWeek values
            # do not block valid schedules for teachers with many batch assignments.
            is_source_defined = getattr(teacher, 'isMaxWeeklySourceDefined', False)
            if is_source_defined and demand > teacher.maxClassesPerWeek:
                violations.append(ViolationOutput(
                    type="TEACHER_WEEKLY_LIMIT_EXCEEDED",
                    severity="ERROR",
                    message=f"Teacher '{teacher.name}' is assigned {demand} periods, which exceeds their weekly maximum of {teacher.maxClassesPerWeek}.",
                    entityType="TEACHER",
                    entityId=t_id,
                    details={"assigned": demand, "maxClassesPerWeek": teacher.maxClassesPerWeek}
                ))

        return violations

    def _diagnose_infeasibility(self) -> List[ViolationOutput]:
        diagnostics = []
        diagnostics.append(ViolationOutput(
            type="SCHEDULER_INFEASIBLE",
            severity="ERROR",
            message="No conflict-free schedule exists for the given assignments, availability, and room capacities.",
            details={
                "suggestion": "Check teacher availability restrictions, reduce weekly periods, or add more classrooms."
            }
        ))
        return diagnostics
