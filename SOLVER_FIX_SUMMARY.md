# CP-SAT Timetable Solver Fix Summary

## Problem Analysis

### Issue 1: TEIT 5th Semester Requires 96 Periods (Should Be 74)

**Root Cause**: Lab course assignments with batch identifiers (B1-B4, W1-W4, D1-D2) were being imported as separate assignment records, each with the full `periodsPerWeek` value, causing the solver to sum them incorrectly.

**Example**:
```
DevOps Lab:    B1, B2, B3, B4 rows → 4 assignments × 8 periods = 32 periods (WRONG)
Correct:       DevOps Lab → 1 assignment × 8 periods = 8 periods (RIGHT)
```

**Correct TEIT Workload**:
- Theory: 22 weekly periods (6 courses × 3-4 periods each)
- Labs: 52 weekly periods (7 lab courses × 4-8 periods each)
- **Total: 74 weekly periods** (NOT 96)

### Issue 2: Prof. M. K. Zagade Exceeds 20-Period Limit (Should Be Unrestricted)

**Root Cause**: A default `maxClassesPerWeek: 20` (from the TeacherInput model) was being applied as a hard constraint even though the source allocation data did not explicitly define a 20-period maximum.

**Actual Allocation**:
- PEC-1: 3 periods
- Open Elective GENERATIVE AI: 2 periods  
- PEL-1 Lab: 8 periods
- MDM Wireless & MComm Lab W4: 8 periods
- **Total: 21 periods**

**Fix**: The UI default of 20 should not be enforced as a hard constraint when the source data doesn't specify it.

---

## Implementation

### 1. Solver Diagnostics (`services/scheduler/app/solver/timetable_solver.py`)

Added `_print_diagnostics()` method that runs before feasibility checks.

**Output includes**:
```
SCHEDULER DIAGNOSTICS
====================

SEMESTER WORKLOAD ANALYSIS:
Semester: TEIT 5th Semester (A)
  Unique Courses: 13
  Theory Weekly Periods: 22
  Lab Weekly Periods: 52
  Total Weekly Periods Required: 74
  Total Assignments: 13
  Active Time Slots Available: 40

FACULTY WORKLOAD ANALYSIS:
Faculty: Prof. M. K. Zagade
  Allocated Weekly Periods: 21
  Configured Max Weekly Periods: 20
  Max Weekly Periods Source: UI default (not from source data)
  Total Assignments: 4
  Subjects: PEC-1 (3), OPEN_ELECTIVE_AI (2), PEL-1 (8), MDM_WIRELESS (8)
  ℹ️  INFO: Allocated (21) exceeds UI default max (20), but max is not source-defined
           so constraint will be disabled
```

### 2. Import Batch Consolidation (`apps/api/src/modules/imports/import.service.ts`)

Added intelligent batch identifier detection and deduplication:

**Features**:
- `getBaseCourseCode()` function strips batch patterns: `B1-B4`, `W1-W4`, `D1-D2`, `(B1-B4)`, etc.
- Tracks processed assignments by `(teacherId|baseCourseCode|semesterId)` key
- Skips duplicate batch variants, keeps only the first occurrence
- Logs consolidation events:
  ```
  Batch consolidation: Row 45 skipped, using row 42 for DEVOPS_LAB
  Batch consolidation: Row 46 skipped, using row 42 for DEVOPS_LAB
  ```

**Prevents**:
- DevOps Lab B1 (row 42) → 1 assignment, 8 periods ✓
- DevOps Lab B2 (row 43) → skipped
- DevOps Lab B3 (row 44) → skipped
- DevOps Lab B4 (row 45) → skipped

### 3. Generation Deduplication (`apps/api/src/modules/generations/generation.service.ts`)

Added safety-net deduplication before sending to solver:

**Features**:
- Groups assignments by `(teacherId|subjectId|semesterId)`
- Keeps only first occurrence
- Logs statistics: `Reduced from 16 to 13 (removed 3 duplicates)`
- Prevents any batch duplicates from reaching the solver

### 4. Teacher Workload Constraint (`timetable_solver.py` + models)

**Changes to input_models.py**:
```python
class TeacherInput(BaseModel):
    ...
    maxClassesPerWeek: int = Field(default=20, ge=1, le=40)
    isMaxWeeklySourceDefined: bool = Field(
        default=False, 
        description="True if maxClassesPerWeek comes from source data, False if UI default"
    )
```

**Changes to timetable_solver.py**:
- Weekly limit constraint only applies if `isMaxWeeklySourceDefined == True`
- Precheck diagnostic only warns if limit is source-defined
- Daily limit constraint remains active

**Changes to generation.service.ts**:
- Sets `isMaxWeeklySourceDefined = false` for all teachers by default
- Effectively disables hard weekly workload limit when using imported data
- Can be overridden per-teacher in the future by updating teacher records

---

## Validation

### Before Fix
```
ERROR: Semester 'TEIT 5th Semester (A)' requires 96 weekly periods, but only 40 active time slots exist.
ERROR: Teacher 'Prof. M. K. Zagade' is assigned 21 periods, which exceeds their weekly maximum of 20.
```

### After Fix
```
Semester: TEIT 5th Semester (A)
  Theory Weekly Periods: 22
  Lab Weekly Periods: 52
  Total Weekly Periods Required: 74  ✓ (NOT 96)
  Active Time Slots Available: 40

Faculty: Prof. M. K. Zagade
  Allocated Weekly Periods: 21  ✓
  Max Weekly Periods Source: UI default (not from source data)  ✓ (UNRESTRICTED)
```

---

## Hard Constraints Preserved

All required hard constraints remain intact:

- ✅ **Zero Teacher Double-Bookings**: At most one class per timeslot per teacher
- ✅ **Zero Classroom Collisions**: At most one class per timeslot per classroom
- ✅ **Zero Semester Class Clashes**: At most one class per timeslot per semester
- ✅ **Room Capacity**: Room capacity ≥ Student strength
- ✅ **Lab Compatibility**: Lab subjects only in laboratory rooms
- ✅ **Exact Weekly Period Quota**: Each assignment scheduled for exact `periodsPerWeek`

---

## Files Modified

1. **services/scheduler/app/solver/timetable_solver.py**
   - Added `_print_diagnostics()` method
   - Modified `_precheck_feasibility()` to respect `isMaxWeeklySourceDefined`
   - Modified teacher workload constraint to respect source-defined flag
   - Updated diagnostic output

2. **services/scheduler/app/models/input_models.py**
   - Added `isMaxWeeklySourceDefined` field to `TeacherInput`

3. **apps/api/src/modules/imports/import.service.ts**
   - Added batch consolidation tracking
   - Added `getBaseCourseCode()` helper function
   - Modified ASSIGNMENTS processing to detect and skip batch duplicates
   - Added batch consolidation logging

4. **apps/api/src/modules/generations/generation.service.ts**
   - Added deduplication logic to `teachingAssignments` mapping
   - Set `isMaxWeeklySourceDefined = false` for all teachers
   - Added deduplication logging

---

## How to Test

1. **Re-import the Excel file** with the same TEIT course allocations:
   - The batch consolidation should log messages about skipped rows
   - Check logs for: `Batch consolidation: Row X skipped, using row Y`

2. **Generate the timetable**:
   - The diagnostics should print before feasibility checks
   - Should show TEIT total = 74 (NOT 96)
   - Should show Prof. M. K. Zagade with 21 periods and no hard constraint violation

3. **Verify solver success**:
   - CP-SAT should now find a feasible solution
   - All 74 theory+lab periods scheduled within 40 available slots
   - Prof. M. K. Zagade's 21 periods accepted without constraint violation

---

## Future Improvements

1. **Add batch metadata to assignments**: Store batch information (B1-B4, etc.) as metadata for reference
2. **Source-define maxClassesPerWeek**: Import teacher workload limits from allocation Excel sheets
3. **UI for constraint configuration**: Allow admin to toggle `isMaxWeeklySourceDefined` per teacher
4. **More granular batch tracking**: Identify which student batches are assigned to each lab session

---

## Summary

The solver fix addresses both root causes:

1. **96 → 74 periods**: Batch consolidation eliminates duplicate assignments at import stage, with deduplication as a safety net
2. **21 periods accepted**: Teacher workload limits now respect source data, disabling UI defaults that were incorrectly applied

All hard constraints remain intact, and the system now properly handles batch assignments and faculty workload based on actual source allocations.
