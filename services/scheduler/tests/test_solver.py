import pytest
from copy import deepcopy
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


@pytest.fixture
def sample_payload():
    return {
        "teachers": [
            {
                "id": "t1",
                "name": "Dr. Alan Turing",
                "availability": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
                "preferredTimeSlots": ["ts1", "ts2"],
                "unavailableTimeSlots": [],
                "maxClassesPerDay": 3,
                "maxClassesPerWeek": 15
            },
            {
                "id": "t2",
                "name": "Dr. Grace Hopper",
                "availability": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
                "preferredTimeSlots": [],
                "unavailableTimeSlots": [],
                "maxClassesPerDay": 3,
                "maxClassesPerWeek": 15
            }
        ],
        "subjects": [
            {
                "id": "s1",
                "name": "Algorithms",
                "code": "CS101",
                "weeklyPeriods": 3,
                "lecturePeriods": 3,
                "labPeriods": 0,
                "isLab": False
            },
            {
                "id": "s2",
                "name": "Compiler Design",
                "code": "CS201",
                "weeklyPeriods": 2,
                "lecturePeriods": 2,
                "labPeriods": 0,
                "isLab": False
            }
        ],
        "classrooms": [
            {
                "id": "c1",
                "name": "Hall 101",
                "capacity": 50,
                "type": "LECTURE",
                "equipment": ["PROJECTOR"],
                "isLab": False,
                "isAvailable": True
            }
        ],
        "semesters": [
            {
                "id": "sem1",
                "name": "CS Semester 3",
                "studentCount": 35
            }
        ],
        "timeslots": [
            {
                "id": "ts1",
                "day": "MONDAY",
                "startTime": "09:00",
                "endTime": "10:00",
                "periodNumber": 1,
                "isBreak": False,
                "isActive": True
            },
            {
                "id": "ts2",
                "day": "MONDAY",
                "startTime": "10:00",
                "endTime": "11:00",
                "periodNumber": 2,
                "isBreak": False,
                "isActive": True
            },
            {
                "id": "ts3",
                "day": "TUESDAY",
                "startTime": "09:00",
                "endTime": "10:00",
                "periodNumber": 1,
                "isBreak": False,
                "isActive": True
            },
            {
                "id": "ts4",
                "day": "WEDNESDAY",
                "startTime": "09:00",
                "endTime": "10:00",
                "periodNumber": 1,
                "isBreak": False,
                "isActive": True
            },
            {
                "id": "ts5",
                "day": "THURSDAY",
                "startTime": "09:00",
                "endTime": "10:00",
                "periodNumber": 1,
                "isBreak": False,
                "isActive": True
            },
            {
                "id": "ts6",
                "day": "FRIDAY",
                "startTime": "09:00",
                "endTime": "10:00",
                "periodNumber": 1,
                "isBreak": False,
                "isActive": True
            }
        ],
        "teachingAssignments": [
            {
                "id": "a1",
                "teacherId": "t1",
                "subjectId": "s1",
                "semesterId": "sem1",
                "classroomRequirements": [],
                "periodsPerWeek": 3,
                "isLab": False
            },
            {
                "id": "a2",
                "teacherId": "t2",
                "subjectId": "s2",
                "semesterId": "sem1",
                "classroomRequirements": [],
                "periodsPerWeek": 2,
                "isLab": False
            }
        ],
        "hardConstraints": {
            "enforceTeacherConflicts": True,
            "enforceClassroomConflicts": True,
            "enforceSemesterConflicts": True,
            "enforceTeacherAvailability": True,
            "enforceClassroomCapacity": True,
            "enforceLabCompatibility": True,
            "enforceWeeklyPeriodRequirements": True,
            "enforceTeacherWorkloadLimits": True
        },
        "softConstraints": {
            "avoidEarlyMorning": 2,
            "avoidFridayAfternoon": 2,
            "spreadSubjects": 5
        },
        "timeLimitSeconds": 10
    }


def test_generate_timetable_success(sample_payload):
    response = client.post("/generate", json=sample_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "COMPLETED"
    assert len(data["timetable"]) == 5  # 3 + 2 = 5 periods total

    # Check for no overlaps
    scheduled_slots = [e["timeSlotId"] for e in data["timetable"]]
    assert len(scheduled_slots) == len(set(scheduled_slots))  # No two entries in same slot


def test_generate_timetable_infeasible(sample_payload):
    # Make room too small
    sample_payload["classrooms"][0]["capacity"] = 10  # studentCount is 35
    response = client.post("/generate", json=sample_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["status"] == "FAILED"
    assert len(data["violations"]) > 0


def _batch_payload(sample_payload):
    payload = deepcopy(sample_payload)
    payload["timeslots"] = payload["timeslots"][:3]
    for teacher in payload["teachers"]:
        teacher["unavailableTimeSlots"] = ["ts2", "ts3"]
    payload["classrooms"] = payload["classrooms"] + [
        {"id": "c2", "name": "Hall 102", "capacity": 50, "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True},
        {"id": "c3", "name": "Hall 103", "capacity": 50, "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True},
    ]
    payload["teachers"].append({
        "id": "t3", "name": "Dr. Katherine Johnson", "availability": ["MONDAY"],
        "preferredTimeSlots": [], "unavailableTimeSlots": ["ts2", "ts3"], "maxClassesPerDay": 4,
        "maxClassesPerWeek": 15, "isMaxWeeklySourceDefined": True,
    })
    payload["batches"] = [
        {"id": "b1", "semesterId": "sem1", "code": "B1", "studentCount": 20},
        {"id": "b2", "semesterId": "sem1", "code": "B2", "studentCount": 20},
        {"id": "b3", "semesterId": "sem1", "code": "B3", "studentCount": 20},
    ]
    payload["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1", "batchId": "b1", "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s2", "semesterId": "sem1", "batchId": "b2", "classroomId": "c2", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a3", "teacherId": "t3", "subjectId": "s1", "semesterId": "sem1", "batchId": "b3", "classroomId": "c3", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    return payload


def test_different_batches_can_share_a_slot_with_distinct_resources(sample_payload):
    response = client.post("/generate", json=_batch_payload(sample_payload))
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert {entry["batchId"] for entry in data["timetable"]} == {"b1", "b2", "b3"}
    assert {entry["classroomId"] for entry in data["timetable"]} == {"c1", "c2", "c3"}


def test_same_batch_conflict_is_infeasible(sample_payload):
    payload = _batch_payload(sample_payload)
    payload["teachingAssignments"][1]["batchId"] = "b1"
    response = client.post("/generate", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] is False


def test_whole_class_conflicts_with_any_batch(sample_payload):
    payload = _batch_payload(sample_payload)
    payload["teachingAssignments"][0].pop("batchId")
    response = client.post("/generate", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] is False


def test_same_teacher_across_batches_is_still_infeasible(sample_payload):
    payload = _batch_payload(sample_payload)
    payload["teachingAssignments"][1]["teacherId"] = "t1"
    response = client.post("/generate", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] is False


def test_assignment_room_is_preserved(sample_payload):
    payload = _batch_payload(sample_payload)
    payload["teachingAssignments"] = payload["teachingAssignments"][:1]
    response = client.post("/generate", json=payload)
    assert response.status_code == 200
    assert response.json()["timetable"][0]["classroomId"] == "c1"


def test_legacy_assignment_without_batch_still_generates(sample_payload):
    response = client.post("/generate", json=sample_payload)
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert all("batchId" not in entry or entry["batchId"] is None for entry in response.json()["timetable"])


# ---------------------------------------------------------------------------
# Batch-aware constraint test helpers / fixtures
# ---------------------------------------------------------------------------

def _make_base(n_teachers: int, n_timeslots: int) -> dict:
    """Build a minimal feasible payload with N teachers and N timeslots."""
    days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    teachers = [
        {
            "id": f"t{i}",
            "name": f"Teacher {i}",
            "availability": days,
            "preferredTimeSlots": [],
            "unavailableTimeSlots": [],
            "maxClassesPerDay": 6,
            "maxClassesPerWeek": 30,
            "isMaxWeeklySourceDefined": True,
        }
        for i in range(1, n_teachers + 1)
    ]
    timeslots = [
        {
            "id": f"ts{i}",
            "day": days[(i - 1) % 5],
            "startTime": f"{8 + i}:00",
            "endTime": f"{9 + i}:00",
            "periodNumber": i,
            "isBreak": False,
            "isActive": True,
        }
        for i in range(1, n_timeslots + 1)
    ]
    return {
        "teachers": teachers,
        "subjects": [
            {"id": "s1", "name": "Subject Alpha", "code": "SA", "weeklyPeriods": 1,
             "lecturePeriods": 1, "labPeriods": 0, "isLab": False},
        ],
        "classrooms": [
            {"id": f"c{i}", "name": f"Room {i}", "capacity": 60, "type": "LECTURE",
             "equipment": [], "isLab": False, "isAvailable": True}
            for i in range(1, n_teachers + 2)  # plenty of rooms
        ],
        "semesters": [
            {"id": "sem1", "name": "Sem 1", "studentCount": 60},
        ],
        "batches": [],
        "timeslots": timeslots,
        "teachingAssignments": [],
        "hardConstraints": {
            "enforceTeacherConflicts": True,
            "enforceClassroomConflicts": True,
            "enforceSemesterConflicts": True,
            "enforceTeacherAvailability": True,
            "enforceClassroomCapacity": True,
            "enforceLabCompatibility": True,
            "enforceWeeklyPeriodRequirements": True,
            "enforceTeacherWorkloadLimits": True,
        },
        "softConstraints": {"avoidEarlyMorning": 0, "avoidFridayAfternoon": 0, "spreadSubjects": 0},
        "timeLimitSeconds": 10,
    }


# ---------------------------------------------------------------------------
# 1. Parallel batches: B1, B2, B3 with distinct teachers and rooms
# ---------------------------------------------------------------------------

def test_parallel_batches_b1_b2_b3_distinct_resources():
    """B1/B2/B3 can share a timeslot when teachers and rooms differ."""
    p = _make_base(n_teachers=3, n_timeslots=1)
    p["batches"] = [
        {"id": "b1", "semesterId": "sem1", "code": "B1", "studentCount": 20},
        {"id": "b2", "semesterId": "sem1", "code": "B2", "studentCount": 20},
        {"id": "b3", "semesterId": "sem1", "code": "B3", "studentCount": 20},
    ]
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1",
         "batchId": "b1", "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s1", "semesterId": "sem1",
         "batchId": "b2", "classroomId": "c2", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a3", "teacherId": "t3", "subjectId": "s1", "semesterId": "sem1",
         "batchId": "b3", "classroomId": "c3", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is True
    scheduled_slots = [e["timeSlotId"] for e in res["timetable"]]
    # All 3 should land in the only timeslot ts1
    assert len(res["timetable"]) == 3
    assert all(s == "ts1" for s in scheduled_slots)


# ---------------------------------------------------------------------------
# 2. Same-batch conflict: B1 cannot have two classes at the same time
# ---------------------------------------------------------------------------

def test_same_batch_conflict_is_infeasible():
    """Two assignments with the same batch at the same time must be rejected."""
    p = _make_base(n_teachers=2, n_timeslots=1)
    p["subjects"].append(
        {"id": "s2", "name": "Subject Beta", "code": "SB", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False}
    )
    p["batches"] = [{"id": "b1", "semesterId": "sem1", "code": "B1", "studentCount": 20}]
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1",
         "batchId": "b1", "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s2", "semesterId": "sem1",
         "batchId": "b1", "classroomId": "c2", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is False


# ---------------------------------------------------------------------------
# 3. ALL vs B1 conflict
# ---------------------------------------------------------------------------

def test_all_blocks_batch_same_time():
    """An ALL assignment cannot coexist with any batch assignment at the same time."""
    p = _make_base(n_teachers=2, n_timeslots=1)
    p["subjects"].append(
        {"id": "s2", "name": "Subject Beta", "code": "SB", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False}
    )
    p["batches"] = [{"id": "b1", "semesterId": "sem1", "code": "B1", "studentCount": 20}]
    # a1 is ALL (no batchId), a2 is B1 — both want the same only timeslot
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1",
         "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s2", "semesterId": "sem1",
         "batchId": "b1", "classroomId": "c2", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is False


# ---------------------------------------------------------------------------
# 4. ALL vs B2 conflict (same logic, different batch ID)
# ---------------------------------------------------------------------------

def test_all_blocks_b2_same_time():
    p = _make_base(n_teachers=2, n_timeslots=1)
    p["subjects"].append(
        {"id": "s2", "name": "Subject Beta", "code": "SB", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False}
    )
    p["batches"] = [{"id": "bx", "semesterId": "sem1", "code": "X9", "studentCount": 20}]
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1",
         "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s2", "semesterId": "sem1",
         "batchId": "bx", "classroomId": "c2", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is False


# ---------------------------------------------------------------------------
# 5. ALL vs ALL conflict at same time
# ---------------------------------------------------------------------------

def test_all_vs_all_same_time_conflict():
    """Two ALL (whole-class) assignments cannot occupy the same timeslot."""
    p = _make_base(n_teachers=2, n_timeslots=1)
    p["subjects"].append(
        {"id": "s2", "name": "Subject Beta", "code": "SB", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False}
    )
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1",
         "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s2", "semesterId": "sem1",
         "classroomId": "c2", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is False


# ---------------------------------------------------------------------------
# 6. ALL at different time than batch — allowed
# ---------------------------------------------------------------------------

def test_all_and_batch_at_different_times_is_feasible():
    """ALL assignment and batch assignment can coexist when given separate timeslots."""
    p = _make_base(n_teachers=2, n_timeslots=2)
    p["subjects"].append(
        {"id": "s2", "name": "Subject Beta", "code": "SB", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False}
    )
    p["batches"] = [{"id": "b1", "semesterId": "sem1", "code": "B1", "studentCount": 20}]
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1",
         "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s2", "semesterId": "sem1",
         "batchId": "b1", "classroomId": "c2", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is True
    slots = {e["subjectId"]: e["timeSlotId"] for e in res["timetable"]}
    # The all-assignment (s1) and batch-assignment (s2) must be in different slots
    assert slots["s1"] != slots["s2"]


# ---------------------------------------------------------------------------
# 7. Different semesters are independent (different student groups).
#    Two ALL assignments in different semesters CAN share a timeslot
#    (no teacher or room conflict).
# ---------------------------------------------------------------------------

def test_different_semesters_are_independent():
    """Assignments in different semesters are not subject to semester conflicts."""
    p = _make_base(n_teachers=2, n_timeslots=1)
    p["semesters"].append({"id": "sem2", "name": "Sem 2", "studentCount": 40})
    p["subjects"].append(
        {"id": "s2", "name": "Subject Beta", "code": "SB", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False}
    )
    # a1 in sem1, a2 in sem2 — different semesters, different teachers / rooms
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1",
         "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s2", "semesterId": "sem2",
         "classroomId": "c2", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is True
    assert len(res["timetable"]) == 2


# ---------------------------------------------------------------------------
# 8. Same teacher across batches is still a conflict
# ---------------------------------------------------------------------------

def test_same_teacher_across_batches_is_infeasible():
    """A teacher cannot teach two different batches simultaneously."""
    p = _make_base(n_teachers=1, n_timeslots=1)
    p["subjects"].append(
        {"id": "s2", "name": "Subject Beta", "code": "SB", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False}
    )
    p["batches"] = [
        {"id": "b1", "semesterId": "sem1", "code": "B1", "studentCount": 20},
        {"id": "b2", "semesterId": "sem1", "code": "B2", "studentCount": 20},
    ]
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1",
         "batchId": "b1", "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t1", "subjectId": "s2", "semesterId": "sem1",
         "batchId": "b2", "classroomId": "c2", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is False


# ---------------------------------------------------------------------------
# 9. Same room across batches is still a conflict
# ---------------------------------------------------------------------------

def test_same_room_across_batches_is_infeasible():
    """Two different batches cannot use the same room at the same time."""
    p = _make_base(n_teachers=2, n_timeslots=1)
    p["subjects"].append(
        {"id": "s2", "name": "Subject Beta", "code": "SB", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False}
    )
    p["batches"] = [
        {"id": "b1", "semesterId": "sem1", "code": "B1", "studentCount": 20},
        {"id": "b2", "semesterId": "sem1", "code": "B2", "studentCount": 20},
    ]
    # Both assignments forced into the same room c1
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1",
         "batchId": "b1", "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s2", "semesterId": "sem1",
         "batchId": "b2", "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is False


# ---------------------------------------------------------------------------
# 10. Arbitrary batch codes (not just B1/B2/B3)
# ---------------------------------------------------------------------------

def test_arbitrary_batch_codes_parallel():
    """Parallel scheduling works for any batch code, not just B1/B2/B3."""
    p = _make_base(n_teachers=2, n_timeslots=1)
    p["subjects"].append(
        {"id": "s2", "name": "Subject Beta", "code": "SB", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False}
    )
    p["batches"] = [
        {"id": "grp_a", "semesterId": "sem1", "code": "GroupA", "studentCount": 25},
        {"id": "grp_b", "semesterId": "sem1", "code": "GroupB", "studentCount": 25},
    ]
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1",
         "batchId": "grp_a", "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s2", "semesterId": "sem1",
         "batchId": "grp_b", "classroomId": "c2", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is True
    assert len(res["timetable"]) == 2
    # Both must occupy the only available timeslot (proving they run in parallel)
    assert all(e["timeSlotId"] == "ts1" for e in res["timetable"])


# ---------------------------------------------------------------------------
# 11. Multi-period lab: batch, teacher, and room must be reserved for every period
# ---------------------------------------------------------------------------

def test_multi_period_lab_blocks_resources_each_period():
    """A 2-period lab must block the batch/teacher/room in BOTH consecutive slots."""
    p = _make_base(n_teachers=2, n_timeslots=3)
    # Override subject to be a 2-period lab
    p["subjects"] = [
        {"id": "lab1", "name": "Lab A", "code": "LA", "weeklyPeriods": 2,
         "lecturePeriods": 0, "labPeriods": 2, "isLab": True},
        {"id": "theory1", "name": "Theory B", "code": "TB", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False},
    ]
    # Add a lab room
    p["classrooms"].append({"id": "lab_room", "name": "Lab Room", "capacity": 60,
                             "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True})
    p["batches"] = [
        {"id": "b1", "semesterId": "sem1", "code": "B1", "studentCount": 20},
    ]
    p["teachingAssignments"] = [
        # B1 does a 2-period lab with t1 in lab_room
        {"id": "a_lab", "teacherId": "t1", "subjectId": "lab1", "semesterId": "sem1",
         "batchId": "b1", "classroomId": "lab_room", "periodsPerWeek": 2, "isLab": True, "classroomRequirements": []},
        # Same teacher cannot teach theory at the same time as the lab
        {"id": "a_theory", "teacherId": "t1", "subjectId": "theory1", "semesterId": "sem1",
         "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is True
    lab_slots = {e["timeSlotId"] for e in res["timetable"] if e["subjectId"] == "lab1"}
    theory_slot = next(e["timeSlotId"] for e in res["timetable"] if e["subjectId"] == "theory1")
    # The theory period must not overlap with any of the lab's periods
    assert theory_slot not in lab_slots


# ---------------------------------------------------------------------------
# 12. Teacher weekly maximum is still enforced
# ---------------------------------------------------------------------------

def test_teacher_weekly_maximum_is_enforced():
    """Assigning more periods than a teacher's weekly max should be infeasible."""
    p = _make_base(n_teachers=1, n_timeslots=5)
    p["teachers"][0]["maxClassesPerWeek"] = 2
    p["teachers"][0]["isMaxWeeklySourceDefined"] = True
    # Three subjects, each needing 1 period — total 3 > max 2
    p["subjects"] = [
        {"id": f"s{i}", "name": f"Sub {i}", "code": f"S{i}", "weeklyPeriods": 1,
         "lecturePeriods": 1, "labPeriods": 0, "isLab": False}
        for i in range(1, 4)
    ]
    p["teachingAssignments"] = [
        {"id": f"a{i}", "teacherId": "t1", "subjectId": f"s{i}", "semesterId": "sem1",
         "classroomId": "c1", "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []}
        for i in range(1, 4)
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is False

