# Excel Import Format for SchedulAI

This guide describes the exact columns accepted by the current separate-file import flow. Create one `.xlsx` file for each import type, with a single worksheet. Put the exact headers in row 1 and data records in the rows below. Do not add a title row above the headers, merge cells, or use formulas.

In the app, select the matching **Import Entity Type** for each file. If the column-mapping screen appears, map each listed header to its matching field. Supported upload formats are `.xlsx`, `.xls`, and `.csv`.

## Import Order

1. Teachers
2. Subjects
3. Classrooms
4. Semesters
5. Batches, only when replacing or customizing the generated defaults
6. Assignments
7. TimeSlots, only if needed

Departments are not a separate option in the current Import Entity Type list. The importer uses the `departmentCode` column when present, or the department selected in the import screen. A new code in `departmentCode` may create a department, so check spelling carefully.

## Teachers.xlsx

Select **Faculty & Teachers**.

Worksheet name: `Teachers` (recommended)

| Header | Required | Example | Notes |
|---|---|---|---|
| `name` | Yes | `Asha Patel` | Teacher's full name. |
| `email` | Yes | `asha.patel@example.edu` | Must contain `@`. |
| `employeeId` | Yes | `EMP001` | Must be unique; use this ID in Assignments. |
| `designation` | No | `Assistant Professor` | Defaults to Assistant Professor. |
| `departmentCode` | Recommended | `IT` | Use an existing department code or choose a default department in the import screen. |

Example:

```csv
name,email,employeeId,designation,departmentCode
Asha Patel,asha.patel@example.edu,EMP001,Assistant Professor,IT
```

**Important:** this import sets teacher availability to Monday through Saturday. It does not import individual availability, unavailable periods, or workload limits. Extra columns for those values will not be applied.

## Subjects.xlsx

Select **Courses & Subjects**.

Worksheet name: `Subjects` (recommended)

| Header | Required | Example | Notes |
|---|---|---|---|
| `name` | Yes | `Data Structures` | Subject name. |
| `code` | Yes | `IT301` | Unique course code; stored uppercase. |
| `credits` | No | `3` | Defaults to 3; allowed values are 1-10. |
| `weeklyPeriods` | Recommended | `3` | Theory must be 3; lab practical must be 2. Leave blank only to use that default. |
| `isLab` | Recommended | `false` | Use `true` for a practical/lab subject or `false` for theory. `true` or `1` is accepted as true; blank defaults to false. |
| `departmentCode` | Recommended | `IT` | Department code, or use the selected default department. |

Example:

```csv
name,code,credits,weeklyPeriods,isLab,departmentCode
Data Structures,IT301,3,3,false,IT
Data Structures Lab,ITL301,1,2,true,IT
```

The current system represents theory and practicals as **separate subject records**. A course that has both needs one theory subject row and one lab subject row, usually with different codes. A lab subject is stored as 2 weekly periods, 0 lecture periods, and 2 lab periods. A theory subject is stored as 3 weekly periods, 3 lecture periods, and 0 lab periods. Other weekly totals are rejected by the current importer.

## Classrooms.xlsx

Select **Classrooms & Labs**.

Worksheet name: `Classrooms` (recommended)

| Header | Required | Example | Notes |
|---|---|---|---|
| `roomNumber` | Yes | `LAB-01` | Required; unique within the building. |
| `name` | No | `Computer Lab 1` | Display name. |
| `building` | No | `IT Block` | Defaults to `Main`. |
| `capacity` | No | `30` | Defaults to 40. Use the actual room capacity. |
| `type` | No | `LAB` | Use `LECTURE`, `LAB`, or `SEMINAR`. Defaults to `LECTURE`. |

Example:

```csv
name,building,roomNumber,capacity,type
Lecture Hall 1,IT Block,CR-01,60,LECTURE
Computer Lab 1,IT Block,LAB-01,30,LAB
```

Use `LAB` for every room intended for practicals. A lab assignment may not be scheduled in a lecture room.

## Semesters.xlsx

Select **Semesters & Student Batches**.

Worksheet name: `Semesters` (recommended)

| Header | Required | Example | Notes |
|---|---|---|---|
| `name` | Yes | `SEIT SEM III A` | Use the same name in Assignments. |
| `number` | No | `3` | Semester number; defaults to 1. |
| `section` | No | `A` | Defaults to A. |
| `studentCount` | No | `60` | Defaults to 30. Use the actual count. |
| `academicYear` | No | `2026-2027` | Defaults to 2025-2026. Recommended format: `YYYY-YYYY`. |
| `departmentCode` | Recommended | `IT` | Department code, or use the selected default department. |

Example:

```csv
name,number,section,studentCount,academicYear,departmentCode
SEIT SEM III A,3,A,60,2026-2027,IT
```

Importing a semester automatically creates four batches: `B1`, `B2`, `B3`, and `B4`, with students divided as evenly as possible. An optional Batches file can upsert explicit batch codes and student counts after semester import.

## Batches.xlsx (Optional)

Select **Student Batches** and import after Semesters. Provide a semester ID, or enough semester identity columns to resolve one unique semester. If semester names are reused, include department code, academic year, number, and section.

| Header | Required | Example | Notes |
|---|---|---|---|
| `semesterId` | Recommended | `66f...` | Stable semester reference; may be used instead of the identity columns. |
| `name` | Recommended | `SEIT SEM III A` | Semester name. Must resolve to one semester when no ID is supplied. |
| `departmentCode` | Recommended | `IT` | Disambiguates departments. |
| `academicYear` | Recommended | `2026-2027` | Disambiguates academic years. |
| `number` | Recommended | `3` | Semester number. |
| `section` | Recommended | `A` | Section. |
| `batchCode` | Yes | `B1` | Existing or new batch code under the semester. |
| `studentCount` | Yes | `15` | Positive integer strength for this batch. |

Example:

```csv
name,departmentCode,academicYear,number,section,batchCode,studentCount
SEIT SEM III A,IT,2026-2027,3,A,B1,15
```

## Assignments.xlsx

Select **Teaching Assignments**. Import this after Teachers, Subjects, Classrooms, and Semesters.

Worksheet name: `Assignments` (recommended)

| Header | Required | Example | Notes |
|---|---|---|---|
| `employeeId` | Yes* | `EMP001` | Must match a teacher already imported. |
| `email` | Yes* | `asha.patel@example.edu` | Use only if `employeeId` is not provided. |
| `code` | Yes | `IT301` | Must match a subject code already imported. |
| `name` | Yes* | `SEIT SEM III A` | Semester name. Required unless `semesterId` is supplied. |
| `semesterId` | Yes* | `66f...` | Stable MongoDB ObjectId alternative to semester name. Do not put a semester number such as `3` here. |
| `departmentCode` | Recommended | `IT` | Include to disambiguate repeated names across departments. |
| `academicYear` | Recommended | `2026-2027` | Include to disambiguate repeated names across years. |
| `number` | Recommended | `3` | Optional additional semester identity. |
| `section` | Recommended | `A` | Optional additional semester identity. |
| `batchCode` | No | `B1` | Blank, `--`, or `ALL` means whole class. Use `B1`-`B4` for batch practicals. |
| `weeklyPeriods` | Recommended | `3` | Theory must be 3; lab practical must be 2. |
| `location` | No | `CR-01` | Must match an imported room number or room name. Leave blank if no fixed room is required. |

`*` Provide either `employeeId` or `email`, and either a MongoDB `semesterId` or the complete name-based identity: `name`, `departmentCode`, `academicYear`, `number`, and `section`. Put numeric values such as `3` in `number`, not `semesterId`. Batch-specific lab rows require a valid active `batchCode` (`B1`-`B4`); theory rows must leave it blank. A repeated import row for the same subject, semester, and batch is rejected, including when it names a different teacher.

Example:

```csv
employeeId,code,name,departmentCode,academicYear,number,section,batchCode,weeklyPeriods,location
EMP001,IT301,SEIT SEM III A,IT,2026-2027,3,A,,3,CR-01
EMP002,ITL301,SEIT SEM III A,IT,2026-2027,3,A,B1,2,LAB-01
EMP002,ITL301,SEIT SEM III A,IT,2026-2027,3,A,B2,2,LAB-01
EMP003,ITL301,SEIT SEM III A,IT,2026-2027,3,A,B3,2,LAB-01
EMP004,ITL301,SEIT SEM III A,IT,2026-2027,3,A,B4,2,LAB-01
```

The assignment's theory/lab type comes from the matching Subject record; do not add an `isLab` column. For batch-wise labs, create one row per batch. Make sure each batch code exists under that semester. A fixed `location` restricts the solver to that room, so leave it blank unless the room really must be fixed.

## TimeSlots.xlsx

Select **Time Slots** only when you need to import the timetable periods.

Worksheet name: `TimeSlots` (recommended)

| Header | Required | Example | Notes |
|---|---|---|---|
| `day` | Yes | `MONDAY` | Uppercase day name. Supported: Monday-Saturday. |
| `startTime` | Yes | `09:15` | 24-hour `HH:MM`. |
| `endTime` | Yes | `10:15` | 24-hour `HH:MM`. |
| `periodNumber` | Yes | `1` | Positive integer. Breaks also have a period number. |
| `isBreak` | No | `false` | Use `true` for break/lunch rows; otherwise `false`. |
| `label` | No | `Period 1` | Optional display label. |

Example rows for one day using the application's current standard schedule:

```csv
day,startTime,endTime,periodNumber,isBreak,label
MONDAY,09:15,10:15,1,false,Period 1
MONDAY,10:15,11:15,2,false,Period 2
MONDAY,11:15,11:30,3,true,SHORT BREAK
MONDAY,11:30,12:30,4,false,Period 3
MONDAY,12:30,13:30,5,false,Period 4
MONDAY,13:30,14:15,6,true,LUNCH BREAK
MONDAY,14:15,15:15,7,false,Period 5
MONDAY,15:15,16:15,8,false,Period 6
MONDAY,16:15,17:15,9,false,Period 7
```

Repeat the rows for Tuesday through Saturday if importing the full week. The scheduler currently restores its standard Monday-Saturday teaching grid if imported teaching slots do not match that schedule, so custom times may not remain in effect during timetable generation.

## Before Importing

- Keep one data type per file and select the same type in the app.
- Ensure row 1 contains the column headers exactly as listed.
- Do not type `isLab` in Assignments; it comes from Subjects.
- Do not assign a batch to a theory row. For batch-wise labs, use one row for each batch.
- Check that teacher IDs, subject codes, semester names, room names/numbers, and batch codes match across files.
- Do not assume `COMPLETED` means every row imported. Check the success/error row counts and row-level error details.
