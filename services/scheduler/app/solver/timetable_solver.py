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
    TimeSlotInput,
    AssignmentInput,
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
        self.timeslots = {ts.id: ts for ts in request.timeslots if ts.isActive and not ts.isBreak}
        self.assignments = request.teachingAssignments
        self.hard_constraints = request.hardConstraints
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
                    if self.hard_constraints.enforceTeacherAvailability:
                        if ts.day not in teacher.availability:
                            continue
                        if ts.id in teacher.unavailableTimeSlots:
                            continue

                    for c in self.classrooms.values():
                        if not c.isAvailable:
                            continue

                        # Capacity check
                        if self.hard_constraints.enforceClassroomCapacity:
                            if c.capacity < semester.studentCount:
                                continue

                        # Lab check
                        is_lab_instance = a.isLab or subject.isLab
                        if self.hard_constraints.enforceLabCompatibility:
                            if is_lab_instance and not c.isLab:
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

        # Semester No-Overlap: At most one class per timeslot for each semester
        if self.hard_constraints.enforceSemesterConflicts:
            for sem_id in self.semesters:
                for ts in self.sorted_timeslots:
                    sem_vars = []
                    for a in self.assignments:
                        if a.semesterId == sem_id:
                            for k in range(a.periodsPerWeek):
                                for c in self.classrooms.values():
                                    if (a.id, k, ts.id, c.id) in x:
                                        sem_vars.append(x[(a.id, k, ts.id, c.id)])
                    if sem_vars:
                        model.AddAtMostOne(sem_vars)

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

                # Weekly limit - only enforce if source data explicitly defined it
                if getattr(teacher, 'isMaxWeeklySourceDefined', True):  # Default to True for backwards compatibility
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
                            semesterId=assignment.semesterId,
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

        # Check total semester period demand vs available time slots
        sem_demand: Dict[str, int] = {}
        teacher_demand: Dict[str, int] = {}

        for a in self.assignments:
            sem_demand[a.semesterId] = sem_demand.get(a.semesterId, 0) + a.periodsPerWeek
            teacher_demand[a.teacherId] = teacher_demand.get(a.teacherId, 0) + a.periodsPerWeek

        for sem_id, demand in sem_demand.items():
            sem = self.semesters.get(sem_id)
            name = sem.name if sem else sem_id
            if demand > num_slots:
                violations.append(ViolationOutput(
                    type="SEMESTER_SLOT_EXCEEDED",
                    severity="ERROR",
                    message=f"Semester '{name}' requires {demand} weekly periods, but only {num_slots} active time slots exist.",
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
            # Only check weekly limit if source data defines it
            is_source_defined = getattr(teacher, 'isMaxWeeklySourceDefined', True)  # Default to True for backwards compatibility
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
