# SchedulAI REST API Reference

Base URL: `http://localhost:5000/api/v1`

---

## 1. Authentication & Users

### `POST /auth/register`
Register a new academic user account.
- **Access**: Public (or Admin created)
- **Body**:
  ```json
  {
    "name": "Dr. Sarah Johnson",
    "email": "sarah.j@university.edu",
    "password": "SecurePassword@123",
    "role": "TEACHER",
    "departmentId": "64d0a1b2c3d4e5f6a7b8c9d0"
  }
  ```

### `POST /auth/login`
Authenticate and obtain JWT tokens.
- **Body**:
  ```json
  {
    "email": "admin@schedulai.local",
    "password": "AdminPassword@123"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "...", "name": "...", "email": "...", "role": "ADMIN" },
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi..."
    }
  }
  ```

### `POST /auth/refresh`
Refresh expired access token.
- **Body**: `{ "refreshToken": "..." }`

### `GET /auth/me`
Retrieve currently logged in user profile.
- **Headers**: `Authorization: Bearer <accessToken>`

---

## 2. Master Academic Resources CRUD

All endpoints support pagination (`page`, `limit`), search queries (`search`), sorting (`sort`, `order`), and filtering:

- **Departments**: `/departments` (`GET`, `POST`, `GET :id`, `PUT :id`, `DELETE :id`)
- **Teachers**: `/teachers` (`GET`, `POST`, `GET :id`, `PUT :id`, `DELETE :id`)
- **Subjects**: `/subjects` (`GET`, `POST`, `GET :id`, `PUT :id`, `DELETE :id`)
- **Classrooms**: `/classrooms` (`GET`, `POST`, `GET :id`, `PUT :id`, `DELETE :id`)
- **Semesters / Cohorts**: `/semesters` (`GET`, `POST`, `GET :id`, `PUT :id`, `DELETE :id`)
- **Time Slots**: `/timeslots` (`GET`, `POST`, `GET :id`, `PUT :id`, `DELETE :id`, `POST /bulk-default`)
- **Teaching Assignments**: `/assignments` (`GET`, `POST`, `GET :id`, `PUT :id`, `DELETE :id`)

---

## 3. Timetable Generation & Engine

### `POST /generations`
Trigger automated generation job using Python OR-Tools CP-SAT solver.
- **Access**: ADMIN, STAFF
- **Body**:
  ```json
  {
    "name": "Fall 2026 CS Timetable v1",
    "semesterIds": ["64d0a1b2c3d4e5f6a7b8c9d0"],
    "hardConstraints": {
      "enforceTeacherConflicts": true,
      "enforceClassroomConflicts": true,
      "enforceSemesterConflicts": true,
      "enforceTeacherAvailability": true,
      "enforceClassroomCapacity": true,
      "enforceLabCompatibility": true
    },
    "softConstraints": {
      "avoidTeacherGaps": 6,
      "balanceTeacherWorkload": 7,
      "avoidEarlyMorning": 5
    },
    "timeLimitSeconds": 60
  }
  ```

### `GET /generations`
List all generation runs, statuses, statistics, solver runtimes, and quality scores.

### `GET /timetables`
Query timetable entries by `generationId`, `semesterId`, `teacherId`, or `classroomId`.

### `POST /timetables/move`
Interactive Drag-and-Drop Move Validator with Suggestion Fallback.
- **Body**:
  ```json
  {
    "entryId": "64d0b1...",
    "targetTimeSlotId": "64d0c2...",
    "targetClassroomId": "64d0d3...",
    "generationId": "64d0e4..."
  }
  ```
- **Response on Conflict**: `200 OK` with `valid: false` and ranked `suggestions`.

---

## 4. AI Copilot

### `POST /ai/parse-preferences`
Convert natural language statements into structured constraint preferences.
- **Body**:
  ```json
  {
    "prompt": "Dr. Turing cannot take morning slots on Monday and prefers Room 301 for Algorithms"
  }
  ```

### `POST /ai/explain-conflict`
AI root cause analysis and step-by-step resolution suggestions.
- **Body**:
  ```json
  {
    "conflict": {
      "type": "TEACHER_CONFLICT",
      "teacherName": "Dr. Alan Turing",
      "timeSlot": "Monday 09:00 - 10:00"
    }
  }
  ```

### `POST /ai/summary`
Generate natural language timetable quality summary, metrics analysis, and recommendation report.

---

## 5. Import & Export

### `POST /imports/preview`
Upload CSV/Excel file (multipart/form-data) to extract headers, infer row count, and get auto-suggested column mappings.

### `POST /imports/execute`
Execute validated import transaction.

### `GET /exports/excel`
Download generated timetable as multi-sheet `.xlsx` spreadsheet (Detailed List & Matrix Grid).

### `GET /exports/csv`
Download raw timetable records in `.csv` format.

### `GET /exports/print`
Retrieve complete structured payload for high-resolution print & PDF generator.
