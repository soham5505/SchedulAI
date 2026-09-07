import json
import os
import sys
from typing import Dict, List, Set, Tuple, Any

# Ensure both root and app directory are in the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.input_models import GenerateRequest, DayOfWeek
from app.solver.timetable_solver import TimetableSolver
from ortools.sat.python import cp_model

def run_diagnosis():
    # Load the dumped solver payload
    payload_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "solver_payload.json"))
    if not os.path.exists(payload_path):
        payload_path = os.path.abspath("solver_payload.json")
    
    print(f"Loading payload from: {payload_path}")
    with open(payload_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Parse request
    request = GenerateRequest(**data)
    
    # ----------------------------------------------------
    # Check 9: Precheck feasibility inspect
    # Let's instantiate the solver and run precheck
    # ----------------------------------------------------
    solver = TimetableSolver(request)
    print("\n--- Running Pre-Checks ---")
    precheck_violations = solver._precheck_feasibility()
    if precheck_violations:
        print(f"Pre-check reported {len(precheck_violations)} violations:")
        for v in precheck_violations:
            print(f" - {v.type}: {v.message} ({v.details})")
    else:
        print("Pre-checks passed (no violations reported by precheck).")
        
    print("\n--- Running Solver Diagnostics ---")
    solver._print_diagnostics()

    # Let's verify constraints systematically
    # We will do this by building a custom CP Model and testing feasibility
    # while selectively disabling each hard constraint.
    
    # Let's build a mapping of constraint name to how we enable/disable it
    # We can run the CP-SAT solver with modified hard constraints.
    constraints_to_test = [
        ("Default (All hard constraints enabled)", {}),
        ("Disable Teacher Overlaps", {"enforceTeacherConflicts": False}),
        ("Disable Classroom Overlaps", {"enforceClassroomConflicts": False}),
        ("Disable Semester/Batch Overlaps", {"enforceSemesterConflicts": False}),
        ("Disable Teacher Availability", {"enforceTeacherAvailability": False}),
        ("Disable Classroom Capacity", {"enforceClassroomCapacity": False}),
        ("Disable Lab Compatibility", {"enforceLabCompatibility": False}),
        ("Disable Teacher Workload Limits", {"enforceTeacherWorkloadLimits": False}),
    ]
    
    print("\n--- Selective Constraint Feasibility Test ---")
    for name, overrides in constraints_to_test:
        test_request = GenerateRequest(**data)
        for k, v in overrides.items():
            setattr(test_request.hardConstraints, k, v)
        
        test_solver = TimetableSolver(test_request)
        # Directly run solve but override time limit for speed
        test_solver.time_limit = 5
        
        # Build model and solve (simulate solve)
        model = cp_model.CpModel()
        x = {}
        instance_ts_var = {}
        num_timeslots = len(test_solver.sorted_timeslots)
        
        if num_timeslots == 0:
            print(f"Skipping {name}: No timeslots")
            continue
            
        is_build_failed = False
        empty_periods = []
        for a in test_solver.assignments:
            teacher = test_solver.teachers.get(a.teacherId)
            subject = test_solver.subjects.get(a.subjectId)
            semester = test_solver.semesters.get(a.semesterId)
            
            if not teacher or not subject or not semester:
                continue
                
            num_periods = a.periodsPerWeek
            for k in range(num_periods):
                valid_pairs = []
                for ts in test_solver.sorted_timeslots:
                    if test_solver.hard_constraints.enforceTeacherAvailability:
                        if ts.day not in teacher.availability or ts.id in teacher.unavailableTimeSlots:
                            continue
                            
                    for c in test_solver.classrooms.values():
                        if not c.isAvailable:
                            continue
                        if test_solver.hard_constraints.enforceClassroomCapacity:
                            if c.capacity < test_solver._student_count(a):
                                continue
                        if a.classroomId and c.id != a.classroomId:
                            continue
                        is_lab_instance = a.isLab or subject.isLab
                        if test_solver.hard_constraints.enforceLabCompatibility:
                            if is_lab_instance and not c.isLab:
                                continue
                        if a.classroomRequirements:
                            if not any(req in c.equipment or req == c.type.value for req in a.classroomRequirements):
                                continue
                                
                        var = model.NewBoolVar(f"x_{a.id}_{k}_{ts.id}_{c.id}")
                        x[(a.id, k, ts.id, c.id)] = var
                        valid_pairs.append((ts, c, var))
                        
                if not valid_pairs:
                    is_build_failed = True
                    empty_periods.append((a, k))
                else:
                    model.AddExactlyOne([v for _, _, v in valid_pairs])
                    ts_idx_var = model.NewIntVar(0, num_timeslots - 1, f"ts_idx_{a.id}_{k}")
                    instance_ts_var[(a.id, k)] = ts_idx_var
                    model.Add(ts_idx_var == sum(test_solver.ts_to_idx[ts.id] * var for ts, _, var in valid_pairs))
                    
            for k in range(num_periods - 1):
                if (a.id, k) in instance_ts_var and (a.id, k + 1) in instance_ts_var:
                    model.Add(instance_ts_var[(a.id, k)] < instance_ts_var[(a.id, k + 1)])
                    
        if is_build_failed:
            print(f"Result for {name}: MODEL BUILD FAILED (No valid slot/room for: {[f'{ep[0].id} (instance {ep[1]})' for ep in empty_periods]})")
            continue
            
        # Add hard constraints
        # 1. Teacher No-Overlap
        if test_solver.hard_constraints.enforceTeacherConflicts:
            for teacher_id in test_solver.teachers:
                for ts in test_solver.sorted_timeslots:
                    teacher_vars = [x[(a.id, k, ts.id, c.id)] for a in test_solver.assignments if a.teacherId == teacher_id for k in range(a.periodsPerWeek) for c in test_solver.classrooms.values() if (a.id, k, ts.id, c.id) in x]
                    if teacher_vars:
                        model.AddAtMostOne(teacher_vars)
                        
        # 2. Classroom No-Overlap
        if test_solver.hard_constraints.enforceClassroomConflicts:
            for c_id in test_solver.classrooms:
                for ts in test_solver.sorted_timeslots:
                    room_vars = [x[(a.id, k, ts.id, c_id)] for a in test_solver.assignments for k in range(a.periodsPerWeek) if (a.id, k, ts.id, c_id) in x]
                    if room_vars:
                        model.AddAtMostOne(room_vars)
                        
        # 3. Student/Semester/Batch Conflicts
        if test_solver.hard_constraints.enforceSemesterConflicts:
            for sem_id in test_solver.semesters:
                for ts in test_solver.sorted_timeslots:
                    scope_vars = {}
                    for a in test_solver.assignments:
                        if a.semesterId == sem_id:
                            scope = test_solver._student_scope(a.batchId)
                            scope_vars.setdefault(scope, [])
                            for k in range(a.periodsPerWeek):
                                for c in test_solver.classrooms.values():
                                    if (a.id, k, ts.id, c.id) in x:
                                        scope_vars[scope].append(x[(a.id, k, ts.id, c.id)])
                                        
                    all_vars = scope_vars.get("ALL", [])
                    if all_vars:
                        model.AddAtMostOne(all_vars)
                    for scope, b_vars in scope_vars.items():
                        if scope == "ALL":
                            continue
                        if b_vars:
                            model.AddAtMostOne(b_vars)
                        if all_vars and b_vars:
                            model.AddAtMostOne(all_vars + b_vars)
                            
        # 4. Teacher limits
        if test_solver.hard_constraints.enforceTeacherWorkloadLimits:
            for teacher in test_solver.teachers.values():
                for day, day_slots in test_solver.timeslots_by_day.items():
                    day_vars = [x[(a.id, k, ts.id, c.id)] for a in test_solver.assignments if a.teacherId == teacher.id for k in range(a.periodsPerWeek) for ts in day_slots for c in test_solver.classrooms.values() if (a.id, k, ts.id, c.id) in x]
                    if day_vars:
                        model.Add(sum(day_vars) <= teacher.maxClassesPerDay)
                if getattr(teacher, 'isMaxWeeklySourceDefined', True):
                    all_teacher_vars = [x[(a.id, k, ts.id, c.id)] for a in test_solver.assignments if a.teacherId == teacher.id for k in range(a.periodsPerWeek) for ts in test_solver.sorted_timeslots for c in test_solver.classrooms.values() if (a.id, k, ts.id, c.id) in x]
                    if all_teacher_vars:
                        model.Add(sum(all_teacher_vars) <= teacher.maxClassesPerWeek)
                        
        # Solve
        cp_solver = cp_model.CpSolver()
        cp_solver.parameters.max_time_in_seconds = 2.0
        status = cp_solver.Solve(model)
        status_name = cp_solver.StatusName(status)
        print(f"Result for {name}: {status_name}")
        
        # If it becomes FEASIBLE, it means the disabled constraint was causing the infeasibility!
        if status in (cp_model.FEASIBLE, cp_model.OPTIMAL):
            print(f"  --> FOUND KEY CONSTRAINT: Disabling '{name}' makes the solver feasible!")

if __name__ == "__main__":
    import sys
    class Tee(object):
        def __init__(self, *files):
            self.files = files
        def write(self, obj):
            for f in self.files:
                f.write(obj)
                f.flush()
        def flush(self):
            for f in self.files:
                f.flush()
                
    out_file_path = os.path.join(os.path.dirname(__file__), "diag_results.txt")
    with open(out_file_path, "w", encoding="utf-8") as f:
        original_stdout = sys.stdout
        sys.stdout = Tee(sys.stdout, f)
        try:
            run_diagnosis()
        finally:
            sys.stdout = original_stdout
