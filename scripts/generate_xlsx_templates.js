/**
 * SchedulAI — XLSX Import Template Generator
 * Generates individual module templates + master reference from actual model specifications.
 * Run: node scripts/generate_xlsx_templates.js
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.join(__dirname, '..'); // root of project

// ─── Style helpers ────────────────────────────────────────────────────────────
function headerStyle() {
    return {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
        fill: { fgColor: { rgb: '1E3A5F' } },
        alignment: { horizontal: 'center', wrapText: true },
        border: {
            top: { style: 'thin', color: { rgb: '999999' } },
            bottom: { style: 'thin', color: { rgb: '999999' } },
            left: { style: 'thin', color: { rgb: '999999' } },
            right: { style: 'thin', color: { rgb: '999999' } },
        },
    };
}

function reqStyle() {
    return { fill: { fgColor: { rgb: 'FFF9E6' } } };
}

function applyStyles(ws, cols) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
        const hdr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[hdr]) ws[hdr].s = headerStyle();
        for (let R = 1; R <= range.e.r; R++) {
            const cell = XLSX.utils.encode_cell({ r: R, c: C });
            if (ws[cell]) ws[cell].s = reqStyle();
        }
    }
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
}

function setColWidths(ws, widths) {
    ws['!cols'] = widths.map((w) => ({ wch: w }));
}

function makeSheet(headers, rows, colWidths) {
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    applyStyles(ws);
    setColWidths(ws, colWidths || headers.map(() => 22));
    return ws;
}

function instructionSheet(lines) {
    const data = lines.map((l) => [l]);
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 80 }];
    return ws;
}

// ─── Module definitions (derived from actual model + service code) ──────────

// 1. DEPARTMENTS
// Model: DepartmentModel {name, code, description}
// Import service: findOneAndUpdate({ code }, {...})
// Auto-suggest maps: name→'name', code→'code' (or 'deptcode')
function deptSheet() {
    const headers = ['Department Name', 'Department Code', 'Description'];
    const rows = [
        ['Computer Science Engineering', 'CSE', 'Computer Science and Engineering Department'],
        ['Information Technology', 'IT', 'Information Technology Department'],
        ['Electronics & Communication', 'ECE', 'Electronics and Communication Engineering'],
        ['Mechanical Engineering', 'MECH', 'Mechanical Engineering Department'],
        ['Civil Engineering', 'CIVIL', 'Civil Engineering Department'],
    ];
    return makeSheet(headers, rows, [32, 20, 45]);
}

function deptInstructions() {
    return instructionSheet([
        'DEPARTMENTS — Import Instructions',
        '══════════════════════════════════',
        '',
        'PURPOSE: Creates or updates academic departments.',
        'IMPORT ORDER: Import FIRST — all other modules depend on Department Code.',
        'DUPLICATE RULE: Upsert on Department Code (existing record is updated).',
        '',
        'COLUMN DETAILS:',
        '──────────────',
        'Department Name  | Required | Text | Min 2, Max 100 chars',
        '                 | Example: Computer Science Engineering',
        '',
        'Department Code  | Required | Text (UPPERCASE) | Min 2, Max 20 chars | UNIQUE',
        '                 | Example: CSE',
        '                 | Auto-detected from column headers containing: code, deptcode',
        '',
        'Description      | Optional | Text | Max 500 chars',
        '                 | Example: Computer Science and Engineering Department',
        '',
        'COMMON ERRORS:',
        '• Duplicate Department Code — the existing record will be overwritten (this is safe)',
        '• Department Code longer than 20 characters — will fail',
        '• Missing Department Name — will fail with validation error',
        '',
        'NOTE: Department Code is stored in UPPERCASE automatically.',
    ]);
}

// 2. FACULTY / TEACHERS
// Model: TeacherModel {name, email, employeeId, designation, departmentId, ...}
// Import service: findOneAndUpdate({ $or: [{email}, {employeeId}] }, {...})
// departmentCode → resolved via DepartmentModel lookup
function teacherSheet() {
    const headers = ['Faculty Name', 'Email', 'Employee ID', 'Designation', 'Department Code'];
    const rows = [
        ['Dr. Anand Sharma', 'anand.sharma@college.edu', 'T001', 'Professor', 'CSE'],
        ['Prof. Meena Patel', 'meena.patel@college.edu', 'T002', 'Associate Professor', 'IT'],
        ['Dr. Rajesh Kumar', 'rajesh.kumar@college.edu', 'T003', 'Assistant Professor', 'CSE'],
        ['Prof. Sunita Desai', 'sunita.desai@college.edu', 'T004', 'Assistant Professor', 'ECE'],
        ['Dr. Vivek Singh', 'vivek.singh@college.edu', 'T005', 'Professor', 'MECH'],
    ];
    return makeSheet(headers, rows, [28, 32, 14, 24, 18]);
}

function teacherInstructions() {
    return instructionSheet([
        'FACULTY & TEACHERS — Import Instructions',
        '════════════════════════════════════════',
        '',
        'PURPOSE: Creates or updates faculty/teacher records.',
        'IMPORT ORDER: Import AFTER Departments.',
        'DUPLICATE RULE: Upsert on Email OR Employee ID (whichever matches first).',
        '',
        'COLUMN DETAILS:',
        '──────────────',
        'Faculty Name     | Required | Text | Min 2, Max 100 chars',
        '                 | Auto-detected from: name, fullname, teachername, facultyname',
        '',
        'Email            | Required | Email format (must contain @) | UNIQUE across teachers',
        '                 | Auto-detected from: email, emailaddress, mail',
        '',
        'Employee ID      | Required | Text | UNIQUE across teachers',
        '                 | Auto-detected from: employeeid, empid, facultyid, teacheremployeeid, id',
        '                 | Example: T001',
        '',
        'Designation      | Optional | Text | Default: Assistant Professor',
        '                 | Auto-detected from: designation, role, title, position',
        '                 | Suggested: Professor / Associate Professor / Assistant Professor / Lecturer',
        '',
        'Department Code  | Required | Must match existing Department Code',
        '                 | Auto-detected from: department, dept, deptcode, departmentcode',
        '                 | Example: CSE',
        '',
        'COMMON ERRORS:',
        '• Email format is invalid (must include @)',
        '• Department Code does not match any existing department → import fails for that row',
        '• Duplicate Employee ID → existing record is updated (safe)',
        '',
        'DEFAULTS SET BY IMPORTER:',
        '• availability = [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY]',
        '• maxClassesPerDay = 4, maxClassesPerWeek = 20 (edit manually after import)',
    ]);
}

// 3. COURSES / SUBJECTS
// Model: SubjectModel {name, code, credits, weeklyPeriods, lecturePeriods, labPeriods, isLab, departmentId}
// Import service: findOneAndUpdate({ code }, {...})
// lecturePeriods = isLab ? weeklyPeriods-1 : weeklyPeriods
// labPeriods = isLab ? 1 : 0
function subjectSheet() {
    const headers = ['Subject Name', 'Subject Code', 'Credits', 'Weekly Periods', 'Is Lab', 'Department Code'];
    const rows = [
        ['Data Structures', 'DS', 4, 4, 'false', 'CSE'],
        ['Database Management System', 'DBMS', 4, 4, 'false', 'CSE'],
        ['Computer Networks', 'CN', 3, 4, 'false', 'CSE'],
        ['Operating Systems', 'OS', 4, 4, 'false', 'CSE'],
        ['Programming Lab', 'PL', 2, 3, 'true', 'CSE'],
    ];
    return makeSheet(headers, rows, [32, 16, 10, 16, 10, 18]);
}

function subjectInstructions() {
    return instructionSheet([
        'COURSES & SUBJECTS — Import Instructions',
        '════════════════════════════════════════',
        '',
        'PURPOSE: Creates or updates course/subject records.',
        'IMPORT ORDER: Import AFTER Departments.',
        'DUPLICATE RULE: Upsert on Subject Code.',
        '',
        'COLUMN DETAILS:',
        '──────────────',
        'Subject Name     | Required | Text | Min 2, Max 100 chars',
        '                 | Auto-detected from: name, fullname, subjectname',
        '',
        'Subject Code     | Required | Text (stored UPPERCASE) | Min 2, Max 20 | UNIQUE',
        '                 | Auto-detected from: code, subjectcode, coursecode',
        '                 | Example: DBMS',
        '',
        'Credits          | Optional | Number | Min 1, Max 10 | Default: 3',
        '                 | Auto-detected from: credits, credit, creditpoints',
        '',
        'Weekly Periods   | Optional | Number | Min 1, Max 20 | Default: 4',
        '                 | Auto-detected from: weeklyperiods, periods, periodsperweek, hours',
        '                 | = total periods per week for this subject',
        '',
        'Is Lab           | Optional | true / false | Default: false',
        '                 | When true: labPeriods = 1, lecturePeriods = weeklyPeriods - 1',
        '                 | When false: labPeriods = 0, lecturePeriods = weeklyPeriods',
        '',
        'Department Code  | Required | Must match existing Department Code',
        '                 | Auto-detected from: department, dept, deptcode, departmentcode',
        '',
        'COMMON ERRORS:',
        '• Subject Code missing or blank → row fails',
        '• Department Code not found → row fails',
        '• Is Lab must be literal string "true" or "1" (not TRUE or True)',
    ]);
}

// 4. CLASSROOMS & LABS
// Model: ClassroomModel {name, building, roomNumber, capacity, type, isLab, isAvailable}
// Unique index: {building, roomNumber}
// Import service: findOneAndUpdate({ building, roomNumber }, {...})
// type: LECTURE | LAB | SEMINAR | OTHER
function classroomSheet() {
    const headers = ['Room Name', 'Building', 'Room Number', 'Capacity', 'Room Type'];
    const rows = [
        ['CS Lab 1', 'Main Block', '101', 40, 'LAB'],
        ['Lecture Hall A', 'Main Block', '201', 60, 'LECTURE'],
        ['Seminar Room 1', 'Admin Block', 'S01', 50, 'SEMINAR'],
        ['CS Lab 2', 'Main Block', '102', 40, 'LAB'],
        ['Lecture Hall B', 'Main Block', '202', 60, 'LECTURE'],
    ];
    return makeSheet(headers, rows, [22, 18, 14, 12, 16]);
}

function classroomInstructions() {
    return instructionSheet([
        'CLASSROOMS & LABS — Import Instructions',
        '═══════════════════════════════════════',
        '',
        'PURPOSE: Creates or updates classroom/lab room records.',
        'IMPORT ORDER: Can import any time (no dependencies on other modules).',
        'DUPLICATE RULE: Upsert on Building + Room Number combination.',
        '',
        'COLUMN DETAILS:',
        '──────────────',
        'Room Name        | Optional | Text | Auto-generated as "Building - RoomNumber" if blank',
        '                 | Auto-detected from: name, roomname',
        '',
        'Building         | Optional | Text | Default: Main',
        '                 | Auto-detected from: building, block, hall',
        '                 | Example: Main Block, Admin Block',
        '',
        'Room Number      | Required | Text | Must be unique within the same Building',
        '                 | Auto-detected from: roomnumber, roomno, room, roomnum',
        '                 | Example: 101, LAB-01, S01',
        '',
        'Capacity         | Optional | Number | Min 1 | Default: 40',
        '                 | Auto-detected from: capacity, seats, studentcapacity, size',
        '',
        'Room Type        | Optional | LECTURE / LAB / SEMINAR / OTHER | Default: LECTURE',
        '                 | Auto-detected from: type, roomtype',
        '                 | Setting LAB also sets isLab = true automatically',
        '',
        'COMMON ERRORS:',
        '• Room Number missing → row fails',
        '• Room Type value is not one of: LECTURE, LAB, SEMINAR, OTHER → row fails',
        '• Duplicate Building + Room Number → existing record is updated (safe)',
    ]);
}

// 5. SEMESTERS & BATCHES
// Model: SemesterModel {name, number, section, academicYear, studentCount, departmentId}
// Unique index: {departmentId, number, section, academicYear}
// Import service: findOneAndUpdate({ departmentId, number, section, academicYear }, {...})
function semesterSheet() {
    const headers = ['Semester Name', 'Semester Number', 'Section', 'Student Count', 'Academic Year', 'Department Code'];
    const rows = [
        ['3rd Semester - A', 3, 'A', 65, '2025-2026', 'CSE'],
        ['3rd Semester - B', 3, 'B', 60, '2025-2026', 'CSE'],
        ['5th Semester - A', 5, 'A', 62, '2025-2026', 'CSE'],
        ['3rd Semester - A', 3, 'A', 58, '2025-2026', 'IT'],
        ['1st Semester - A', 1, 'A', 70, '2025-2026', 'ECE'],
    ];
    return makeSheet(headers, rows, [22, 18, 11, 14, 14, 18]);
}

function semesterInstructions() {
    return instructionSheet([
        'SEMESTERS & BATCHES — Import Instructions',
        '═════════════════════════════════════════',
        '',
        'PURPOSE: Creates or updates semester/batch records.',
        'IMPORT ORDER: Import AFTER Departments.',
        'DUPLICATE RULE: Upsert on (Department Code + Semester Number + Section + Academic Year).',
        '',
        'COLUMN DETAILS:',
        '──────────────',
        'Semester Name    | Required | Text | Min 2, Max 100 chars | This is the DISPLAY name',
        '                 | Auto-detected from: name, fullname, semestername',
        '                 | Example: 3rd Semester - A',
        '                 | ⚠ Teaching Assignments match semesters by this exact name (case-insensitive)',
        '',
        'Semester Number  | Optional | Number | Min 1, Max 12 | Default: 1',
        '                 | Auto-detected from: number',
        '                 | Example: 3 (for 3rd semester)',
        '',
        'Section          | Optional | Text | Default: A',
        '                 | Auto-detected from: section',
        '                 | Example: A, B, C',
        '',
        'Student Count    | Optional | Number | Min 1 | Default: 30',
        '                 | Auto-detected from: studentcount, students, strength, enrolled',
        '',
        'Academic Year    | Optional | Text | Default: 2025-2026',
        '                 | Auto-detected from: academicyear',
        '                 | Format: YYYY-YYYY',
        '',
        'Department Code  | Required | Must match existing Department Code',
        '                 | Auto-detected from: department, dept, deptcode, departmentcode',
        '',
        'COMMON ERRORS:',
        '• Semester Name missing → row fails',
        '• Department Code not found → row fails',
        '• Academic Year format mismatch → records are created as duplicates',
        '',
        '⚠ CRITICAL: The "Semester Name" here MUST EXACTLY MATCH what you write in the',
        '  Teaching Assignments file. The Teaching Assignments importer searches by name',
        '  using case-insensitive matching.',
    ]);
}

// 6. TIME SLOTS
// Model: TimeSlotModel {day, startTime, endTime, periodNumber, isBreak, label}
// Unique index: {day, startTime, endTime}
// Import service (added): findOneAndUpdate({ day, startTime, endTime }, {...})
// Valid days: MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY
function timeslotSheet() {
    const headers = ['Day', 'Start Time', 'End Time', 'Period Number', 'Is Break', 'Label'];
    const rows = [
        ['MONDAY', '09:00', '09:55', 1, 'false', 'Period 1'],
        ['MONDAY', '10:00', '10:55', 2, 'false', 'Period 2'],
        ['MONDAY', '10:55', '11:10', 3, 'true', 'Break'],
        ['MONDAY', '11:10', '12:05', 4, 'false', 'Period 3'],
        ['MONDAY', '12:05', '13:00', 5, 'false', 'Period 4'],
        ['TUESDAY', '09:00', '09:55', 1, 'false', 'Period 1'],
        ['TUESDAY', '10:00', '10:55', 2, 'false', 'Period 2'],
        ['TUESDAY', '10:55', '11:10', 3, 'true', 'Break'],
        ['TUESDAY', '11:10', '12:05', 4, 'false', 'Period 3'],
        ['TUESDAY', '12:05', '13:00', 5, 'false', 'Period 4'],
        ['WEDNESDAY', '09:00', '09:55', 1, 'false', 'Period 1'],
        ['WEDNESDAY', '10:00', '10:55', 2, 'false', 'Period 2'],
        ['WEDNESDAY', '10:55', '11:10', 3, 'true', 'Break'],
        ['WEDNESDAY', '11:10', '12:05', 4, 'false', 'Period 3'],
        ['WEDNESDAY', '12:05', '13:00', 5, 'false', 'Period 4'],
        ['THURSDAY', '09:00', '09:55', 1, 'false', 'Period 1'],
        ['THURSDAY', '10:00', '10:55', 2, 'false', 'Period 2'],
        ['THURSDAY', '10:55', '11:10', 3, 'true', 'Break'],
        ['THURSDAY', '11:10', '12:05', 4, 'false', 'Period 3'],
        ['THURSDAY', '12:05', '13:00', 5, 'false', 'Period 4'],
        ['FRIDAY', '09:00', '09:55', 1, 'false', 'Period 1'],
        ['FRIDAY', '10:00', '10:55', 2, 'false', 'Period 2'],
        ['FRIDAY', '10:55', '11:10', 3, 'true', 'Break'],
        ['FRIDAY', '11:10', '12:05', 4, 'false', 'Period 3'],
        ['FRIDAY', '12:05', '13:00', 5, 'false', 'Period 4'],
    ];
    return makeSheet(headers, rows, [14, 13, 13, 15, 11, 16]);
}

function timeslotInstructions() {
    return instructionSheet([
        'TIME SLOTS — Import Instructions',
        '════════════════════════════════',
        '',
        'PURPOSE: Creates or updates time slot records used by the timetable scheduler.',
        'IMPORT ORDER: Can import any time (no dependencies on other modules).',
        '             Recommended: Import BEFORE generating timetables.',
        'DUPLICATE RULE: Upsert on (Day + Start Time + End Time).',
        '',
        'COLUMN DETAILS:',
        '──────────────',
        'Day              | Required | Text (UPPERCASE)',
        '                 | Auto-detected from: day, dayofweek, weekday',
        '                 | Allowed values: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY',
        '                 | ⚠ Must be UPPERCASE exactly as shown',
        '',
        'Start Time       | Required | Text | Format: HH:MM (24-hour)',
        '                 | Auto-detected from: starttime, start, from',
        '                 | Example: 09:00, 13:30',
        '',
        'End Time         | Required | Text | Format: HH:MM (24-hour)',
        '                 | Auto-detected from: endtime, end, to',
        '                 | Example: 09:55, 14:25',
        '',
        'Period Number    | Required | Number | Min 1, Max 20',
        '                 | Auto-detected from: periodnumber, period, slot, periodno',
        '                 | Example: 1, 2, 3 ...',
        '',
        'Is Break         | Optional | true / false | Default: false',
        '                 | Mark break/lunch slots as true so scheduler ignores them',
        '',
        'Label            | Optional | Text | Human-readable label',
        '                 | Example: Period 1, Morning Break, Lunch',
        '',
        'COMMON ERRORS:',
        '• Day is not UPPERCASE (e.g. "Monday" instead of "MONDAY") → row fails',
        '• Period Number is 0 or missing → row fails',
        '• Start Time or End Time blank → row fails',
        '',
        'TIP: Repeat the same Period Number pattern for all days.',
        '     For 5 periods per day × 5 days = 25 rows minimum (exclude break rows from count).',
    ]);
}

// 7. TEACHING ASSIGNMENTS
// Model: TeachingAssignmentModel {teacherId, subjectId, semesterId, periodsPerWeek, isLab}
// Unique index: {teacherId, subjectId, semesterId}
// Import service:
//   - teacherEmpId → TeacherModel.findOne({ employeeId: teacherEmpId })
//   - subjectCode  → SubjectModel.findOne({ code: subjectCode })
//   - semesterName → SemesterModel.findOne({ name: /$regex case-insensitive/ })
//   - periodsPerWeek → from columnMapping.weeklyPeriods
//   - isLab → copied from subject.isLab automatically (NOT from Excel)
function assignmentSheet() {
    const headers = ['Teacher Employee ID', 'Subject Code', 'Semester Name', 'Weekly Periods'];
    const rows = [
        ['T001', 'DS', '3rd Semester - A', 4],
        ['T002', 'DBMS', '3rd Semester - A', 4],
        ['T003', 'CN', '5th Semester - A', 4],
        ['T001', 'OS', '5th Semester - A', 4],
        ['T004', 'PL', '3rd Semester - B', 3],
    ];
    return makeSheet(headers, rows, [22, 16, 22, 16]);
}

function assignmentInstructions() {
    return instructionSheet([
        'TEACHING ASSIGNMENTS — Import Instructions',
        '══════════════════════════════════════════',
        '',
        'PURPOSE: Assigns teachers to subjects for specific semester batches.',
        '         This is the core input for AI timetable generation.',
        'IMPORT ORDER: Import LAST — depends on Teachers, Subjects, AND Semesters.',
        'DUPLICATE RULE: Upsert on (Teacher + Subject + Semester).',
        '',
        'COLUMN DETAILS:',
        '──────────────',
        'Teacher Employee ID | Required | Must match Employee ID of an EXISTING teacher',
        '                    | Auto-detected from: employeeid, teacheremployeeid, empid',
        '                    | Example: T001',
        '                    | ⚠ Do NOT use Teacher Name or database ID — use Employee ID only',
        '',
        'Subject Code        | Required | Must match Code of an EXISTING subject',
        '                    | Auto-detected from: code, subjectcode, coursecode',
        '                    | Example: DS, DBMS, CN',
        '                    | ⚠ Case-insensitive — DS and ds both work',
        '',
        'Semester Name       | Required | Must match Name of an EXISTING semester (case-insensitive)',
        '                    | Auto-detected from: name, semestername',
        '                    | Example: 3rd Semester - A',
        '                    | ⚠ Must match EXACTLY (minus casing) what is in the Semesters table',
        '',
        'Weekly Periods      | Optional | Number | Min 1, Max 20 | Default: 4',
        '                    | Auto-detected from: weeklyperiods, periods, periodsperweek, hours',
        '                    | = number of classes per week for this assignment',
        '',
        'NOT IN EXCEL (set automatically by importer):',
        '• isLab → copied from the Subject record automatically',
        '• teacherId, subjectId, semesterId → resolved via lookup, not identifiers',
        '',
        'FOREIGN KEY DEPENDENCIES:',
        '• Teacher Employee ID → must exist in Faculty & Teachers',
        '• Subject Code → must exist in Courses & Subjects',
        '• Semester Name → must exist in Semesters & Batches',
        '',
        'COMMON ERRORS:',
        '• "Teacher with Employee ID T001 not found" → import Teachers first',
        '• "Subject with code DS not found" → import Subjects first',
        '• "Semester 3rd Semester - A not found" → name must match Semesters exactly',
        '• Teacher Employee ID dropdown shows blank → select the column manually',
    ]);
}

// ─── Individual template files ────────────────────────────────────────────

function writeTemplate(filePath, dataSheetName, dataSheetFn, instrFn) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, dataSheetFn(), dataSheetName);
    XLSX.utils.book_append_sheet(wb, instrFn(), 'Instructions');
    XLSX.writeFile(wb, filePath, { bookType: 'xlsx' });
    console.log(`✔ Created: ${path.basename(filePath)}`);
}

// ─── Master Reference ──────────────────────────────────────────────────────

function readmeSheet() {
    const lines = [
        ['SchedulAI — XLSX Import Reference'],
        [''],
        ['This reference contains import specifications for all modules in the SchedulAI'],
        ['Intelligent AI Timetable Generator system.'],
        [''],
        ['HOW TO USE THIS FILE:'],
        ['1. Read the "Import Order" sheet to understand the dependency sequence.'],
        ['2. Use each module sheet as a reference for column names, types, and examples.'],
        ['3. Use the individual template files for actual data entry.'],
        ['4. Upload files via: App → Import Excel/CSV → Select Entity → Upload File'],
        [''],
        ['GENERATED FROM:'],
        ['• apps/api/src/modules/imports/import.service.ts (backend handler)'],
        ['• apps/web/src/pages/ImportPage.tsx (frontend column mapping)'],
        ['• apps/api/src/models/*.model.ts (database schemas)'],
        [''],
        ['KEY RULES:'],
        ['• All lookups use business keys (codes, employee IDs, names) — NOT database ObjectIDs'],
        ['• Duplicate detection uses upsert — re-importing is safe'],
        ['• Column header detection is automatic but case-insensitive'],
        ['• Teaching Assignments must be imported LAST'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(lines);
    ws['!cols'] = [{ wch: 90 }];
    return ws;
}

function importOrderSheet() {
    const headers = ['Step', 'Module', 'Template File', 'Depends On', 'Why'];
    const rows = [
        [1, 'Departments', 'departments_template.xlsx', '(none)', 'All other modules reference Department Code'],
        [2, 'Faculty & Teachers', 'teachers_template.xlsx', 'Departments', 'Teacher records need a valid Department Code'],
        [2, 'Courses & Subjects', 'subjects_template.xlsx', 'Departments', 'Subject records need a valid Department Code'],
        [2, 'Semesters & Batches', 'semesters_template.xlsx', 'Departments', 'Semester records need a valid Department Code'],
        [2, 'Classrooms & Labs', 'classrooms_template.xlsx', '(none)', 'No foreign key dependency'],
        [2, 'Time Slots', 'timeslots_template.xlsx', '(none)', 'No foreign key dependency'],
        [3, 'Teaching Assignments', 'teaching_assignments_template.xlsx', 'Teachers + Subjects + Semesters', 'Resolves Teacher by Employee ID, Subject by Code, Semester by Name'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 36 }, { wch: 28 }, { wch: 60 }];
    // header style
    for (let C = 0; C < 5; C++) {
        const hdr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[hdr]) ws[hdr].s = headerStyle();
    }
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
    return ws;
}

function consistencySheet() {
    const headers = ['Module', 'Excel Column', 'Mapping Key', 'Auto-Detect Synonyms', 'API Field', 'DB Field', 'Status'];
    const rows = [
        // Departments
        ['Departments', 'Department Name', 'name', 'name, fullname', 'name', 'name', '✔ OK'],
        ['Departments', 'Department Code', 'code', 'code, subjectcode, deptcode', 'code', 'code (UNIQUE)', '✔ OK'],
        ['Departments', 'Description', '(not mapped)', '(not in patterns)', 'description', 'description', '⚠ No auto-detect; importer reads raw column "description"'],
        // Teachers
        ['Teachers', 'Faculty Name', 'name', 'name, fullname, teachername, facultyname', 'name', 'name', '✔ OK'],
        ['Teachers', 'Email', 'email', 'email, emailaddress, mail', 'email', 'email (UNIQUE)', '✔ OK'],
        ['Teachers', 'Employee ID', 'employeeId', 'employeeid, empid, facultyid, teacheremployeeid, id', 'employeeId', 'employeeId (UNIQUE)', '✔ OK (fixed)'],
        ['Teachers', 'Designation', 'designation', 'designation, role, title, position', 'designation', 'designation', '✔ OK'],
        ['Teachers', 'Department Code', 'departmentCode', 'department, dept, deptcode, departmentcode', 'departmentId (resolved)', 'departmentId (ObjectId)', '✔ OK'],
        // Subjects
        ['Subjects', 'Subject Name', 'name', 'name, fullname, subjectname', 'name', 'name', '✔ OK'],
        ['Subjects', 'Subject Code', 'code', 'code, subjectcode, coursecode', 'code', 'code (UNIQUE)', '✔ OK'],
        ['Subjects', 'Credits', 'credits', 'credits, credit, creditpoints', 'credits', 'credits', '✔ OK'],
        ['Subjects', 'Weekly Periods', 'weeklyPeriods', 'weeklyperiods, periods, periodsperweek, hours', 'weeklyPeriods', 'weeklyPeriods', '✔ OK'],
        ['Subjects', 'Is Lab', 'isLab', '(no auto-detect)', 'isLab', 'isLab', '⚠ Not in suggestedMapping patterns; user must select manually'],
        ['Subjects', 'Department Code', 'departmentCode', 'department, dept, deptcode, departmentcode', 'departmentId (resolved)', 'departmentId (ObjectId)', '✔ OK'],
        // Classrooms
        ['Classrooms', 'Room Name', 'name', 'name, fullname, roomname', 'name', 'name', '✔ OK'],
        ['Classrooms', 'Building', 'building', 'building, block, hall', 'building', 'building', '✔ OK'],
        ['Classrooms', 'Room Number', 'roomNumber', 'roomnumber, roomno, room, roomnum', 'roomNumber', 'roomNumber (UNIQUE+building)', '✔ OK'],
        ['Classrooms', 'Capacity', 'capacity', 'capacity, seats, studentcapacity, size', 'capacity', 'capacity', '✔ OK'],
        ['Classrooms', 'Room Type', 'type', 'type, roomtype', 'type', 'type (LECTURE/LAB/SEMINAR/OTHER)', '✔ OK'],
        // Semesters
        ['Semesters', 'Semester Name', 'name', 'name, fullname, semestername', 'name', 'name', '✔ OK'],
        ['Semesters', 'Semester Number', 'number', '(no auto-detect)', 'number', 'number', '⚠ Not in suggestedMapping; default 1'],
        ['Semesters', 'Section', 'section', '(no auto-detect)', 'section', 'section', '⚠ Not in suggestedMapping; default A'],
        ['Semesters', 'Student Count', 'studentCount', 'studentcount, students, strength, enrolled', 'studentCount', 'studentCount', '✔ OK'],
        ['Semesters', 'Academic Year', 'academicYear', '(no auto-detect)', 'academicYear', 'academicYear', '⚠ Not in suggestedMapping; default 2025-2026'],
        ['Semesters', 'Department Code', 'departmentCode', 'department, dept, deptcode, departmentcode', 'departmentId (resolved)', 'departmentId (ObjectId)', '✔ OK'],
        // Time Slots
        ['Time Slots', 'Day', 'day', 'day, dayofweek, weekday', 'day', 'day (enum)', '✔ OK'],
        ['Time Slots', 'Start Time', 'startTime', 'starttime, start, from', 'startTime', 'startTime', '✔ OK'],
        ['Time Slots', 'End Time', 'endTime', 'endtime, end, to', 'endTime', 'endTime', '✔ OK'],
        ['Time Slots', 'Period Number', 'periodNumber', 'periodnumber, period, slot, periodno', 'periodNumber', 'periodNumber', '✔ OK'],
        ['Time Slots', 'Is Break', 'isBreak', '(no auto-detect)', 'isBreak', 'isBreak', '⚠ Not in suggestedMapping; user selects manually'],
        ['Time Slots', 'Label', 'label', '(no auto-detect)', 'label', 'label', '⚠ Not in suggestedMapping; user selects manually'],
        // Assignments
        ['Assignments', 'Teacher Employee ID', 'employeeId', 'employeeid, teacheremployeeid, empid, facultyid, id', 'teacherId (resolved)', 'teacherId (ObjectId)', '✔ OK (fixed)'],
        ['Assignments', 'Subject Code', 'code', 'code, subjectcode, coursecode', 'subjectId (resolved)', 'subjectId (ObjectId)', '✔ OK'],
        ['Assignments', 'Semester Name', 'name', 'name, fullname, semestername', 'semesterId (resolved)', 'semesterId (ObjectId)', '✔ OK (case-insensitive)'],
        ['Assignments', 'Weekly Periods', 'weeklyPeriods', 'weeklyperiods, periods, periodsperweek, hours', 'periodsPerWeek', 'periodsPerWeek', '✔ OK'],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [14, 26, 18, 50, 22, 28, 45].map((w) => ({ wch: w }));
    for (let C = 0; C < headers.length; C++) {
        const hdr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[hdr]) ws[hdr].s = headerStyle();
    }
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
    return ws;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

console.log('\n🔧 SchedulAI — Generating XLSX Import Templates...\n');

// Individual templates
writeTemplate(path.join(OUT_DIR, 'departments_template.xlsx'), 'Departments', deptSheet, deptInstructions);
writeTemplate(path.join(OUT_DIR, 'teachers_template.xlsx'), 'Faculty & Teachers', teacherSheet, teacherInstructions);
writeTemplate(path.join(OUT_DIR, 'subjects_template.xlsx'), 'Courses & Subjects', subjectSheet, subjectInstructions);
writeTemplate(path.join(OUT_DIR, 'classrooms_template.xlsx'), 'Classrooms & Labs', classroomSheet, classroomInstructions);
writeTemplate(path.join(OUT_DIR, 'semesters_template.xlsx'), 'Semesters & Batches', semesterSheet, semesterInstructions);
writeTemplate(path.join(OUT_DIR, 'timeslots_template.xlsx'), 'Time Slots', timeslotSheet, timeslotInstructions);
writeTemplate(path.join(OUT_DIR, 'teaching_assignments_template.xlsx'), 'Teaching Assignments', assignmentSheet, assignmentInstructions);

// Master reference
const masterPath = path.join(OUT_DIR, 'SchedulAI_XLSX_Import_Reference.xlsx');
const masterWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(masterWb, readmeSheet(), 'README');
XLSX.utils.book_append_sheet(masterWb, importOrderSheet(), 'Import Order');
XLSX.utils.book_append_sheet(masterWb, deptSheet(), 'Departments');
XLSX.utils.book_append_sheet(masterWb, teacherSheet(), 'Faculty');
XLSX.utils.book_append_sheet(masterWb, subjectSheet(), 'Courses');
XLSX.utils.book_append_sheet(masterWb, classroomSheet(), 'Classrooms');
XLSX.utils.book_append_sheet(masterWb, semesterSheet(), 'Semesters');
XLSX.utils.book_append_sheet(masterWb, timeslotSheet(), 'Time Slots');
XLSX.utils.book_append_sheet(masterWb, assignmentSheet(), 'Teaching Assignments');
XLSX.utils.book_append_sheet(masterWb, consistencySheet(), 'Column Consistency Check');
XLSX.writeFile(masterWb, masterPath, { bookType: 'xlsx' });
console.log(`✔ Created: SchedulAI_XLSX_Import_Reference.xlsx`);

console.log('\n✅ All templates generated successfully!\n');
console.log('Files written to:', OUT_DIR);
