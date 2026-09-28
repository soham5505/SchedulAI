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


# ---------------------------------------------------------------------------
# 13. REAL-WORLD SCENARIO A: same teacher → 4 different batches, same practical
#     The teacher CANNOT teach all 4 at the same time slot.
#     With 4 available slots the solver must spread them across 4 distinct slots.
# ---------------------------------------------------------------------------

def test_same_teacher_four_batches_must_be_spread_across_slots():
    """
    Scenario: B1/B2/B3/B4 all need Practical X taught by Teacher X.
    Teacher X cannot be in two places at once, so the solver MUST place the
    4 sessions in 4 different time slots.  This is the general rule — it applies
    to ANY teacher/subject combination, not just specific ones.
    """
    days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    timeslots = [
        {"id": f"ts{i}", "day": days[i-1], "startTime": f"{8+i}:00",
         "endTime": f"{9+i}:00", "periodNumber": i, "isBreak": False, "isActive": True}
        for i in range(1, 5)   # 4 time slots on 4 different days
    ]
    p = {
        "teachers": [
            {
                "id": "tx", "name": "Teacher X",
                "availability": days,
                "preferredTimeSlots": [], "unavailableTimeSlots": [],
                "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
                "isMaxWeeklySourceDefined": False,  # UI default — must NOT be enforced
            }
        ],
        "subjects": [
            {"id": "px", "name": "Practical X", "code": "PX",
             "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True}
        ],
        "classrooms": [
            {"id": f"lab{i}", "name": f"Lab {i}", "capacity": 20,
             "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True}
            for i in range(1, 5)   # 4 separate labs — room conflict won't block
        ],
        "semesters": [{"id": "sem1", "name": "IT 3rd Sem", "studentCount": 60}],
        "batches": [
            {"id": f"b{i}", "semesterId": "sem1", "code": f"B{i}", "studentCount": 15}
            for i in range(1, 5)
        ],
        "timeslots": timeslots,
        "teachingAssignments": [
            # Same teacher (tx), same subject (px), but DIFFERENT batches and rooms
            {"id": f"a{i}", "teacherId": "tx", "subjectId": "px",
             "semesterId": "sem1", "batchId": f"b{i}",
             "classroomId": f"lab{i}", "periodsPerWeek": 1,
             "isLab": True, "classroomRequirements": []}
            for i in range(1, 5)
        ],
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
        "timeLimitSeconds": 15,
    }

    res = client.post("/generate", json=p).json()

    # Must be feasible — 4 sessions, 4 slots, 4 separate rooms
    assert res["success"] is True, f"Expected feasible but got: {res.get('violations') or res.get('errorMessage')}"
    assert len(res["timetable"]) == 4

    # KEY ASSERTION: all 4 entries must be in DIFFERENT time slots
    # (teacher conflict constraint forces this)
    scheduled_slots = [e["timeSlotId"] for e in res["timetable"]]
    assert len(set(scheduled_slots)) == 4, (
        f"Same teacher scheduled in overlapping slots! Slots: {scheduled_slots}"
    )

    # Each batch must appear exactly once
    scheduled_batches = [e["batchId"] for e in res["timetable"]]
    assert set(scheduled_batches) == {"b1", "b2", "b3", "b4"}


def test_same_teacher_four_batches_infeasible_with_one_slot():
    """
    Same scenario as above but with ONLY ONE time slot.
    The teacher physically cannot teach 4 batches at the same time.
    The solver must correctly report INFEASIBLE.
    """
    p = {
        "teachers": [
            {
                "id": "tx", "name": "Teacher X",
                "availability": ["MONDAY"],
                "preferredTimeSlots": [], "unavailableTimeSlots": [],
                "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
                "isMaxWeeklySourceDefined": False,
            }
        ],
        "subjects": [
            {"id": "px", "name": "Practical X", "code": "PX",
             "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True}
        ],
        "classrooms": [
            {"id": f"lab{i}", "name": f"Lab {i}", "capacity": 20,
             "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True}
            for i in range(1, 5)
        ],
        "semesters": [{"id": "sem1", "name": "IT 3rd Sem", "studentCount": 60}],
        "batches": [
            {"id": f"b{i}", "semesterId": "sem1", "code": f"B{i}", "studentCount": 15}
            for i in range(1, 5)
        ],
        "timeslots": [
            {"id": "ts1", "day": "MONDAY", "startTime": "09:00",
             "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True}
        ],  # Only ONE slot — impossible to fit 4 sessions
        "teachingAssignments": [
            {"id": f"a{i}", "teacherId": "tx", "subjectId": "px",
             "semesterId": "sem1", "batchId": f"b{i}",
             "classroomId": f"lab{i}", "periodsPerWeek": 1,
             "isLab": True, "classroomRequirements": []}
            for i in range(1, 5)
        ],
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

    res = client.post("/generate", json=p).json()
    # Only 1 slot but teacher needs 4 distinct slots → must be infeasible
    assert res["success"] is False, "Expected infeasible but solver returned a solution!"


# ---------------------------------------------------------------------------
# 14. REAL-WORLD SCENARIO B: 4 different teachers, 4 different batches, 4 labs
#     All 4 CAN and SHOULD run in parallel (same slot).
# ---------------------------------------------------------------------------

def test_four_different_teachers_four_batches_can_run_in_parallel():
    """
    Scenario: B1/B2/B3/B4 each have their OWN teacher and lab.
    No teacher or room conflicts exist, so the solver MAY place all 4 in
    the SAME time slot (parallel practical sessions) — exactly like a real
    college timetable.  This is the general rule for any data combination.
    """
    p = {
        "teachers": [
            {
                "id": f"t{i}", "name": f"Teacher {i}",
                "availability": ["MONDAY"],
                "preferredTimeSlots": [], "unavailableTimeSlots": [],
                "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
                "isMaxWeeklySourceDefined": False,
            }
            for i in range(1, 5)
        ],
        "subjects": [
            {"id": f"p{i}", "name": f"Practical {i}", "code": f"P{i}",
             "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True}
            for i in range(1, 5)
        ],
        "classrooms": [
            {"id": f"lab{i}", "name": f"Lab {i}", "capacity": 20,
             "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True}
            for i in range(1, 5)
        ],
        "semesters": [{"id": "sem1", "name": "IT 3rd Sem", "studentCount": 60}],
        "batches": [
            {"id": f"b{i}", "semesterId": "sem1", "code": f"B{i}", "studentCount": 15}
            for i in range(1, 5)
        ],
        "timeslots": [
            # Only ONE time slot — all 4 must fit in it (parallel execution)
            {"id": "ts1", "day": "MONDAY", "startTime": "09:00",
             "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True}
        ],
        "teachingAssignments": [
            # Each batch → its own teacher and its own lab
            {"id": f"a{i}", "teacherId": f"t{i}", "subjectId": f"p{i}",
             "semesterId": "sem1", "batchId": f"b{i}",
             "classroomId": f"lab{i}", "periodsPerWeek": 1,
             "isLab": True, "classroomRequirements": []}
            for i in range(1, 5)
        ],
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

    res = client.post("/generate", json=p).json()

    # Must be feasible — no shared teacher, no shared room, different batches
    assert res["success"] is True, f"Expected feasible but got: {res.get('violations') or res.get('errorMessage')}"
    assert len(res["timetable"]) == 4

    # KEY ASSERTION: all 4 MUST run in the SAME slot (parallel execution)
    scheduled_slots = [e["timeSlotId"] for e in res["timetable"]]
    assert all(s == "ts1" for s in scheduled_slots), (
        f"Expected all 4 batches in ts1 but got: {scheduled_slots}"
    )

    # Each batch appears exactly once, each teacher appears exactly once
    assert set(e["batchId"] for e in res["timetable"]) == {"b1", "b2", "b3", "b4"}
    assert set(e["teacherId"] for e in res["timetable"]) == {"t1", "t2", "t3", "t4"}
    assert set(e["classroomId"] for e in res["timetable"]) == {"lab1", "lab2", "lab3", "lab4"}


# ---------------------------------------------------------------------------
# 15. THEORY blocks ALL batches at the same time (ALL vs BATCH constraint)
#     Theory assignment has batchId=None → it is an ALL-scope assignment.
#     If theory is placed at time T, no batch lab may run at T in that semester.
# ---------------------------------------------------------------------------

def test_theory_at_same_slot_as_batch_labs_is_infeasible():
    """
    RULE: A theory lecture (batchId=None, isLab=False) occupies the entire
    semester at that time slot.  No batch-specific lab may run simultaneously.
    This is the ALL vs BATCH constraint in timetable_solver.py (lines 337-345).
    Generic — applies to every teacher/subject/semester combination.
    """
    p = {
        "teachers": [
            {
                "id": "tTheory", "name": "Theory Teacher",
                "availability": ["MONDAY"],
                "preferredTimeSlots": [], "unavailableTimeSlots": [],
                "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
                "isMaxWeeklySourceDefined": False,
            },
            {
                "id": "tLab", "name": "Lab Teacher",
                "availability": ["MONDAY"],
                "preferredTimeSlots": [], "unavailableTimeSlots": [],
                "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
                "isMaxWeeklySourceDefined": False,
            },
        ],
        "subjects": [
            {"id": "sTheory", "name": "Java Theory", "code": "JT",
             "weeklyPeriods": 1, "lecturePeriods": 1, "labPeriods": 0, "isLab": False},
            {"id": "sLab", "name": "Java Lab", "code": "JL",
             "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True},
        ],
        "classrooms": [
            {"id": "room1", "name": "Lecture Hall", "capacity": 60,
             "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True},
            {"id": "lab1", "name": "Lab 1", "capacity": 20,
             "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True},
        ],
        "semesters": [{"id": "sem1", "name": "IT 3rd Sem", "studentCount": 60}],
        "batches": [
            {"id": "b1", "semesterId": "sem1", "code": "B1", "studentCount": 15}
        ],
        # Only ONE time slot — theory + B1 lab both need it → INFEASIBLE (ALL blocks B1)
        "timeslots": [
            {"id": "ts1", "day": "MONDAY", "startTime": "09:00",
             "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True}
        ],
        "teachingAssignments": [
            # Theory: batchId absent/None → ALL-scope
            {"id": "aTheory", "teacherId": "tTheory", "subjectId": "sTheory",
             "semesterId": "sem1", "periodsPerWeek": 1,
             "isLab": False, "classroomRequirements": []},
            # Lab for B1
            {"id": "aLab", "teacherId": "tLab", "subjectId": "sLab",
             "semesterId": "sem1", "batchId": "b1", "classroomId": "lab1",
             "periodsPerWeek": 1, "isLab": True, "classroomRequirements": []},
        ],
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

    res = client.post("/generate", json=p).json()
    # 1 slot but both theory (ALL) + B1 lab need it → infeasible
    assert res["success"] is False, "Expected infeasible: theory and B1 lab cannot share the same slot"


def test_theory_and_batch_labs_at_different_slots_is_feasible():
    """
    RULE: theory at slot T1, batch labs at slot T2 → FEASIBLE.
    Different slots means no conflict between ALL-scope theory and batch labs.
    Generic — no hard-coded names.
    """
    p = {
        "teachers": [
            {
                "id": "tTheory", "name": "Theory Teacher",
                "availability": ["MONDAY", "TUESDAY"],
                "preferredTimeSlots": [], "unavailableTimeSlots": [],
                "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
                "isMaxWeeklySourceDefined": False,
            },
            {
                "id": "tLab", "name": "Lab Teacher",
                "availability": ["MONDAY", "TUESDAY"],
                "preferredTimeSlots": [], "unavailableTimeSlots": [],
                "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
                "isMaxWeeklySourceDefined": False,
            },
        ],
        "subjects": [
            {"id": "sTheory", "name": "Java Theory", "code": "JT",
             "weeklyPeriods": 1, "lecturePeriods": 1, "labPeriods": 0, "isLab": False},
            {"id": "sLab", "name": "Java Lab", "code": "JL",
             "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True},
        ],
        "classrooms": [
            {"id": "room1", "name": "Lecture Hall", "capacity": 60,
             "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True},
            {"id": "lab1", "name": "Lab 1", "capacity": 20,
             "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True},
        ],
        "semesters": [{"id": "sem1", "name": "IT 3rd Sem", "studentCount": 60}],
        "batches": [
            {"id": "b1", "semesterId": "sem1", "code": "B1", "studentCount": 15}
        ],
        # TWO slots — theory can go in ts1, lab can go in ts2
        "timeslots": [
            {"id": "ts1", "day": "MONDAY", "startTime": "09:00",
             "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True},
            {"id": "ts2", "day": "TUESDAY", "startTime": "09:00",
             "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True},
        ],
        "teachingAssignments": [
            {"id": "aTheory", "teacherId": "tTheory", "subjectId": "sTheory",
             "semesterId": "sem1", "periodsPerWeek": 1,
             "isLab": False, "classroomRequirements": []},
            {"id": "aLab", "teacherId": "tLab", "subjectId": "sLab",
             "semesterId": "sem1", "batchId": "b1", "classroomId": "lab1",
             "periodsPerWeek": 1, "isLab": True, "classroomRequirements": []},
        ],
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

    res = client.post("/generate", json=p).json()
    assert res["success"] is True, f"Expected feasible but got: {res.get('violations') or res.get('errorMessage')}"
    assert len(res["timetable"]) == 2

    # Theory and lab must be in DIFFERENT slots
    slots = {e["subjectId"]: e["timeSlotId"] for e in res["timetable"]}
    assert slots["sTheory"] != slots["sLab"], (
        f"Theory and lab assigned to same slot! theory={slots['sTheory']}, lab={slots['sLab']}"
    )


# ===========================================================================
# NEW TESTS — Semester 3/5/7, Batches B1-B4 (20 students each)
# Requirement:
#   - LECTURE: batchId=NULL, whole-semester, needs room capacity >= 80
#   - LAB:     batchId=B1/B2/B3/B4, 20 students, uses LAB room
#   - B1/B2/B3/B4 labs may run in parallel (different teachers, different rooms)
#   - Teacher conflicts: same teacher + same timeslot = conflict (always global)
#   - Room conflicts:    same room    + same timeslot = conflict (always global)
# ===========================================================================

def _make_sem357_base():
    """
    Minimal reusable base for Semester 3/5/7 tests.
    Three semesters, four batches each (20 students).
    One large lecture hall (cap=80), four small labs (cap=20 each).
    Five days × 6 periods = 30 time slots available.
    """
    days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    timeslots = [
        {
            "id": f"ts{d}p{p}",
            "day": day,
            "startTime": f"{8 + p}:00",
            "endTime": f"{9 + p}:00",
            "periodNumber": p,
            "isBreak": False,
            "isActive": True,
        }
        for d, day in enumerate(days)
        for p in range(1, 7)
    ]
    semesters = [
        {"id": f"sem{s}", "name": f"Semester {s}", "studentCount": 80}
        for s in [3, 5, 7]
    ]
    batches = [
        {"id": f"sem{s}_b{b}", "semesterId": f"sem{s}", "code": f"B{b}", "studentCount": 20}
        for s in [3, 5, 7]
        for b in [1, 2, 3, 4]
    ]
    # Lecture halls — capacity 80 (non-lab)
    classrooms = [
        {"id": f"lh{i}", "name": f"Lecture Hall {i}", "capacity": 80,
         "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True}
        for i in range(1, 4)
    ]
    # Lab rooms — capacity 20 (lab)
    classrooms += [
        {"id": f"lab{i}", "name": f"Lab Room {i}", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True}
        for i in range(1, 13)  # 12 labs: 3 sems × 4 batches
    ]
    return {
        "semesters": semesters,
        "batches": batches,
        "classrooms": classrooms,
        "timeslots": timeslots,
        "subjects": [],
        "teachers": [],
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
        "timeLimitSeconds": 15,
    }


# ---------------------------------------------------------------------------
# 16. Whole-semester lecture (batchId=NULL) is placed with a single teacher,
#     single room, single timeslot for the entire semester.
#     Room must hold ALL batches: 4 × 20 = 80 students.
# ---------------------------------------------------------------------------

def test_whole_semester_lecture_single_entry_per_period():
    """
    A lecture assignment (batchId=NULL) must appear as ONE entry in the timetable
    per period instance (not four copies) and must use a room with capacity >= 80.
    """
    p = _make_sem357_base()
    p["subjects"] = [
        {"id": "s_theory", "name": "Data Structures", "code": "DS",
         "weeklyPeriods": 3, "lecturePeriods": 3, "labPeriods": 0, "isLab": False},
    ]
    p["teachers"] = [
        {"id": "t1", "name": "Prof. Lecture",
         "availability": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
         "isMaxWeeklySourceDefined": False},
    ]
    # batchId absent → whole-semester lecture
    p["teachingAssignments"] = [
        {"id": "a_lec", "teacherId": "t1", "subjectId": "s_theory",
         "semesterId": "sem3",
         "periodsPerWeek": 3, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is True, (
        f"Expected feasible whole-semester lecture. Violations: {res.get('violations')}"
    )
    entries = res["timetable"]
    # 3 periods → 3 entries
    assert len(entries) == 3
    # All entries have batchId = None (whole-semester)
    assert all(e.get("batchId") is None for e in entries), (
        f"Lecture should have batchId=None but got: {[e.get('batchId') for e in entries]}"
    )
    # All entries use the same teacher
    assert all(e["teacherId"] == "t1" for e in entries)
    # All entries must be in distinct timeslots (no double-booking)
    slots = [e["timeSlotId"] for e in entries]
    assert len(set(slots)) == 3, f"Lecture periods overlap slots: {slots}"


def test_whole_semester_lecture_requires_80_capacity_room():
    """
    A lecture (batchId=NULL) with 4 batches × 20 = 80 students must NOT be
    placed in a room with capacity < 80, even if enforceClassroomCapacity=True.
    """
    p = _make_sem357_base()
    # Replace lecture halls with undersized rooms (capacity 60)
    p["classrooms"] = [
        {"id": f"small{i}", "name": f"Small Room {i}", "capacity": 60,
         "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True}
        for i in range(1, 4)
    ] + [
        {"id": f"lab{i}", "name": f"Lab {i}", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True}
        for i in range(1, 5)
    ]
    p["subjects"] = [
        {"id": "s_theory", "name": "Data Structures", "code": "DS",
         "weeklyPeriods": 1, "lecturePeriods": 1, "labPeriods": 0, "isLab": False},
    ]
    p["teachers"] = [
        {"id": "t1", "name": "Prof. Lecture",
         "availability": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
         "isMaxWeeklySourceDefined": False},
    ]
    p["teachingAssignments"] = [
        {"id": "a_lec", "teacherId": "t1", "subjectId": "s_theory",
         "semesterId": "sem3",
         "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    # All rooms are 60-capacity but lecture needs 80 → infeasible
    assert res["success"] is False, (
        "Expected infeasible: no room has capacity >= 80 for a 4-batch lecture"
    )


def test_whole_semester_lecture_succeeds_with_exactly_80_capacity():
    """
    A lecture room with capacity exactly 80 must be accepted for a 4-batch lecture.
    """
    p = _make_sem357_base()
    # Only one room with exactly 80 capacity
    p["classrooms"] = [
        {"id": "lh_exact", "name": "Hall Exact 80", "capacity": 80,
         "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True},
    ] + [
        {"id": f"lab{i}", "name": f"Lab {i}", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True}
        for i in range(1, 5)
    ]
    p["subjects"] = [
        {"id": "s_theory", "name": "Data Structures", "code": "DS",
         "weeklyPeriods": 1, "lecturePeriods": 1, "labPeriods": 0, "isLab": False},
    ]
    p["teachers"] = [
        {"id": "t1", "name": "Prof. Lecture",
         "availability": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
         "isMaxWeeklySourceDefined": False},
    ]
    p["teachingAssignments"] = [
        {"id": "a_lec", "teacherId": "t1", "subjectId": "s_theory",
         "semesterId": "sem3",
         "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is True, (
        f"Expected feasible with exactly-80 room. Violations: {res.get('violations')}"
    )
    assert res["timetable"][0]["classroomId"] == "lh_exact"


# ---------------------------------------------------------------------------
# 17. Batch-specific labs for B1/B2/B3/B4 can run simultaneously when each
#     uses a different teacher and a different lab room.
# ---------------------------------------------------------------------------

def test_batch_labs_b1_b2_b3_b4_run_in_parallel():
    """
    LAB assignments for B1/B2/B3/B4 (same semester) with distinct teachers and
    distinct lab rooms MUST be scheduled in the SAME time slot (parallel).
    This is feasible because there are no teacher, room, or student-scope conflicts.
    """
    p = _make_sem357_base()
    p["subjects"] = [
        {"id": "s_lab", "name": "OS Lab", "code": "OSL",
         "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True},
    ]
    p["teachers"] = [
        {"id": f"t{i}", "name": f"Lab Teacher {i}",
         "availability": ["MONDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 2, "maxClassesPerWeek": 10,
         "isMaxWeeklySourceDefined": False}
        for i in range(1, 5)
    ]
    # Restrict to a single time slot so all 4 MUST use it if feasible
    p["timeslots"] = [
        {"id": "ts1", "day": "MONDAY", "startTime": "09:00",
         "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True}
    ]
    p["classrooms"] = [
        {"id": f"lab{i}", "name": f"Lab {i}", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True}
        for i in range(1, 5)
    ]
    p["teachingAssignments"] = [
        {"id": f"a{i}", "teacherId": f"t{i}", "subjectId": "s_lab",
         "semesterId": "sem3", "batchId": f"sem3_b{i}",
         "classroomId": f"lab{i}", "periodsPerWeek": 1,
         "isLab": True, "classroomRequirements": []}
        for i in range(1, 5)
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is True, (
        f"B1-B4 parallel labs must be feasible. Violations: {res.get('violations')}"
    )
    assert len(res["timetable"]) == 4
    # All four must use the single available time slot
    assert all(e["timeSlotId"] == "ts1" for e in res["timetable"]), (
        f"Expected all labs in ts1 but got: {[e['timeSlotId'] for e in res['timetable']]}"
    )
    assert {e["batchId"] for e in res["timetable"]} == {
        "sem3_b1", "sem3_b2", "sem3_b3", "sem3_b4"
    }


# ---------------------------------------------------------------------------
# 18. Same teacher conflict — global (teacher cannot teach two batches at once)
# ---------------------------------------------------------------------------

def test_same_teacher_lab_b1_and_b2_same_slot_infeasible():
    """
    A single teacher assigned to BOTH B1 and B2 labs in the same semester
    cannot teach them simultaneously.  With only one time slot, this must be
    INFEASIBLE.
    """
    p = _make_sem357_base()
    p["subjects"] = [
        {"id": "s_lab", "name": "Java Lab", "code": "JL",
         "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True},
    ]
    p["teachers"] = [
        {"id": "t_single", "name": "Single Teacher",
         "availability": ["MONDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
         "isMaxWeeklySourceDefined": False},
    ]
    p["timeslots"] = [
        {"id": "ts1", "day": "MONDAY", "startTime": "09:00",
         "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True}
    ]
    p["classrooms"] = [
        {"id": "lab1", "name": "Lab 1", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True},
        {"id": "lab2", "name": "Lab 2", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True},
    ]
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t_single", "subjectId": "s_lab",
         "semesterId": "sem3", "batchId": "sem3_b1",
         "classroomId": "lab1", "periodsPerWeek": 1,
         "isLab": True, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t_single", "subjectId": "s_lab",
         "semesterId": "sem3", "batchId": "sem3_b2",
         "classroomId": "lab2", "periodsPerWeek": 1,
         "isLab": True, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is False, (
        "Same teacher for B1 and B2 labs with only one slot must be infeasible"
    )


def test_same_teacher_lab_b1_and_b2_two_slots_feasible():
    """
    Same scenario but with TWO time slots: the solver can place B1 in ts1
    and B2 in ts2 (or vice versa) — no teacher conflict.
    """
    p = _make_sem357_base()
    p["subjects"] = [
        {"id": "s_lab", "name": "Java Lab", "code": "JL",
         "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True},
    ]
    p["teachers"] = [
        {"id": "t_single", "name": "Single Teacher",
         "availability": ["MONDAY", "TUESDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 2, "maxClassesPerWeek": 10,
         "isMaxWeeklySourceDefined": False},
    ]
    p["timeslots"] = [
        {"id": "ts1", "day": "MONDAY", "startTime": "09:00",
         "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True},
        {"id": "ts2", "day": "TUESDAY", "startTime": "09:00",
         "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True},
    ]
    p["classrooms"] = [
        {"id": "lab1", "name": "Lab 1", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True},
        {"id": "lab2", "name": "Lab 2", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True},
    ]
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t_single", "subjectId": "s_lab",
         "semesterId": "sem3", "batchId": "sem3_b1",
         "classroomId": "lab1", "periodsPerWeek": 1,
         "isLab": True, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t_single", "subjectId": "s_lab",
         "semesterId": "sem3", "batchId": "sem3_b2",
         "classroomId": "lab2", "periodsPerWeek": 1,
         "isLab": True, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is True, (
        f"Two slots for single-teacher B1+B2 labs must be feasible. "
        f"Violations: {res.get('violations')}"
    )
    # Teacher must NOT be double-booked
    slots_by_teacher: dict = {}
    for e in res["timetable"]:
        slots_by_teacher.setdefault(e["teacherId"], []).append(e["timeSlotId"])
    for tid, slots in slots_by_teacher.items():
        assert len(slots) == len(set(slots)), f"Teacher {tid} double-booked: {slots}"


# ---------------------------------------------------------------------------
# 19. Same room conflict — global (two assignments cannot share a room at once)
# ---------------------------------------------------------------------------

def test_same_lab_room_for_b1_and_b2_same_slot_infeasible():
    """
    Two different batches (B1, B2) forced into the SAME lab room at the same
    timeslot must be INFEASIBLE regardless of having different teachers.
    """
    p = _make_sem357_base()
    p["subjects"] = [
        {"id": "s_lab", "name": "Network Lab", "code": "NL",
         "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True},
    ]
    p["teachers"] = [
        {"id": "t1", "name": "Teacher 1",
         "availability": ["MONDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 2, "maxClassesPerWeek": 10,
         "isMaxWeeklySourceDefined": False},
        {"id": "t2", "name": "Teacher 2",
         "availability": ["MONDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 2, "maxClassesPerWeek": 10,
         "isMaxWeeklySourceDefined": False},
    ]
    p["timeslots"] = [
        {"id": "ts1", "day": "MONDAY", "startTime": "09:00",
         "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True}
    ]
    # Only ONE lab room — both batches must use the same room → conflict
    p["classrooms"] = [
        {"id": "lab_shared", "name": "Shared Lab", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True},
    ]
    p["teachingAssignments"] = [
        {"id": "a1", "teacherId": "t1", "subjectId": "s_lab",
         "semesterId": "sem3", "batchId": "sem3_b1",
         "classroomId": "lab_shared", "periodsPerWeek": 1,
         "isLab": True, "classroomRequirements": []},
        {"id": "a2", "teacherId": "t2", "subjectId": "s_lab",
         "semesterId": "sem3", "batchId": "sem3_b2",
         "classroomId": "lab_shared", "periodsPerWeek": 1,
         "isLab": True, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is False, (
        "Two batches forced into the same lab room at the same slot must be infeasible"
    )


# ---------------------------------------------------------------------------
# 20. Lecture (batchId=NULL) blocks ALL batch labs in the same semester
#     at the same timeslot (ALL vs BATCH rule).
# ---------------------------------------------------------------------------

def test_lecture_blocks_all_batch_labs_same_slot():
    """
    A whole-semester lecture (batchId=NULL) placed at slot T prevents ANY
    batch lab from that semester running at T.
    With only 1 time slot and both a lecture and a lab assignment, the solver
    must report INFEASIBLE.
    """
    p = _make_sem357_base()
    p["subjects"] = [
        {"id": "s_theory", "name": "OS Theory", "code": "OS",
         "weeklyPeriods": 1, "lecturePeriods": 1, "labPeriods": 0, "isLab": False},
        {"id": "s_lab", "name": "OS Lab", "code": "OSL",
         "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True},
    ]
    p["teachers"] = [
        {"id": "t_theory", "name": "Theory Teacher",
         "availability": ["MONDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 2, "maxClassesPerWeek": 10,
         "isMaxWeeklySourceDefined": False},
        {"id": "t_lab", "name": "Lab Teacher",
         "availability": ["MONDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 2, "maxClassesPerWeek": 10,
         "isMaxWeeklySourceDefined": False},
    ]
    p["timeslots"] = [
        {"id": "ts1", "day": "MONDAY", "startTime": "09:00",
         "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True}
    ]
    p["classrooms"] = [
        {"id": "lh1", "name": "Lecture Hall 1", "capacity": 80,
         "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True},
        {"id": "lab1", "name": "Lab 1", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True},
    ]
    p["teachingAssignments"] = [
        # Whole-semester lecture (batchId=NULL)
        {"id": "a_lec", "teacherId": "t_theory", "subjectId": "s_theory",
         "semesterId": "sem3",
         "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        # Batch lab for B1
        {"id": "a_lab", "teacherId": "t_lab", "subjectId": "s_lab",
         "semesterId": "sem3", "batchId": "sem3_b1",
         "classroomId": "lab1", "periodsPerWeek": 1,
         "isLab": True, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is False, (
        "Lecture (ALL) and B1 lab at the only slot must be infeasible"
    )


def test_lecture_and_batch_labs_at_different_slots_feasible():
    """
    A whole-semester lecture at slot T1 and batch labs at slot T2 is FEASIBLE
    because they do not overlap.
    """
    p = _make_sem357_base()
    p["subjects"] = [
        {"id": "s_theory", "name": "OS Theory", "code": "OS",
         "weeklyPeriods": 1, "lecturePeriods": 1, "labPeriods": 0, "isLab": False},
        {"id": "s_lab", "name": "OS Lab", "code": "OSL",
         "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True},
    ]
    p["teachers"] = [
        {"id": "t_theory", "name": "Theory Teacher",
         "availability": ["MONDAY", "TUESDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 2, "maxClassesPerWeek": 10,
         "isMaxWeeklySourceDefined": False},
        {"id": "t_lab", "name": "Lab Teacher",
         "availability": ["MONDAY", "TUESDAY"],
         "preferredTimeSlots": [], "unavailableTimeSlots": [],
         "maxClassesPerDay": 2, "maxClassesPerWeek": 10,
         "isMaxWeeklySourceDefined": False},
    ]
    p["timeslots"] = [
        {"id": "ts1", "day": "MONDAY", "startTime": "09:00",
         "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True},
        {"id": "ts2", "day": "TUESDAY", "startTime": "09:00",
         "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True},
    ]
    p["classrooms"] = [
        {"id": "lh1", "name": "Lecture Hall 1", "capacity": 80,
         "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True},
        {"id": "lab1", "name": "Lab 1", "capacity": 20,
         "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True},
    ]
    p["teachingAssignments"] = [
        {"id": "a_lec", "teacherId": "t_theory", "subjectId": "s_theory",
         "semesterId": "sem3",
         "periodsPerWeek": 1, "isLab": False, "classroomRequirements": []},
        {"id": "a_lab", "teacherId": "t_lab", "subjectId": "s_lab",
         "semesterId": "sem3", "batchId": "sem3_b1",
         "classroomId": "lab1", "periodsPerWeek": 1,
         "isLab": True, "classroomRequirements": []},
    ]
    res = client.post("/generate", json=p).json()
    assert res["success"] is True, (
        f"Lecture at ts1 and lab at ts2 must be feasible. Violations: {res.get('violations')}"
    )
    slots = {e["subjectId"]: e["timeSlotId"] for e in res["timetable"]}
    assert slots["s_theory"] != slots["s_lab"], (
        "Lecture and lab must be in different slots"
    )


# ---------------------------------------------------------------------------
# 21. Full realistic scenario: Semester 3, B1-B4, lecture (weeklyPeriods=3)
#     + lab (weeklyPeriods=1 per batch) with parallel labs.
# ---------------------------------------------------------------------------

def test_full_sem3_lecture_3periods_plus_parallel_labs():
    """
    Realistic scenario for Semester 3:
      - 1 LECTURE subject: 3 periods/week, batchId=NULL, needs room capacity >= 80
      - 1 LAB subject:     1 period/week per batch (B1/B2/B3/B4), each uses own
                           teacher and lab room; all 4 labs CAN run in parallel.

    The scheduler MUST:
      1. Place 3 lecture periods (no batchId) in a large room.
      2. Place 4 lab periods in 4 separate lab rooms simultaneously.
      3. Ensure lecture periods and lab periods DO NOT overlap (ALL vs BATCH).
    """
    days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
    # 5 days × 5 periods = 25 slots (plenty of room)
    timeslots = [
        {"id": f"ts{d}p{p}", "day": day,
         "startTime": f"{8 + p}:00", "endTime": f"{9 + p}:00",
         "periodNumber": p, "isBreak": False, "isActive": True}
        for d, day in enumerate(days)
        for p in range(1, 6)
    ]
    p = {
        "semesters": [{"id": "sem3", "name": "Semester 3", "studentCount": 80}],
        "batches": [
            {"id": f"b{i}", "semesterId": "sem3", "code": f"B{i}", "studentCount": 20}
            for i in range(1, 5)
        ],
        "subjects": [
            {"id": "s_lec", "name": "Data Structures", "code": "DS",
             "weeklyPeriods": 3, "lecturePeriods": 3, "labPeriods": 0, "isLab": False},
            {"id": "s_lab", "name": "DS Lab", "code": "DSL",
             "weeklyPeriods": 1, "lecturePeriods": 0, "labPeriods": 1, "isLab": True},
        ],
        "classrooms": [
            # One large lecture hall (cap=80) — the only non-lab room
            {"id": "lh1", "name": "Lecture Hall 1", "capacity": 80,
             "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True},
            # Four lab rooms (cap=20 each)
        ] + [
            {"id": f"lab{i}", "name": f"Lab {i}", "capacity": 20,
             "type": "LAB", "equipment": [], "isLab": True, "isAvailable": True}
            for i in range(1, 5)
        ],
        "teachers": [
            # One lecture teacher
            {"id": "t_lec", "name": "Lecture Teacher",
             "availability": days,
             "preferredTimeSlots": [], "unavailableTimeSlots": [],
             "maxClassesPerDay": 4, "maxClassesPerWeek": 20,
             "isMaxWeeklySourceDefined": False},
        ] + [
            # Four lab teachers (one per batch)
            {"id": f"t_lab{i}", "name": f"Lab Teacher {i}",
             "availability": days,
             "preferredTimeSlots": [], "unavailableTimeSlots": [],
             "maxClassesPerDay": 2, "maxClassesPerWeek": 10,
             "isMaxWeeklySourceDefined": False}
            for i in range(1, 5)
        ],
        "timeslots": timeslots,
        "teachingAssignments": [
            # Whole-semester lecture (batchId absent)
            {"id": "a_lec", "teacherId": "t_lec", "subjectId": "s_lec",
             "semesterId": "sem3",
             "periodsPerWeek": 3, "isLab": False, "classroomRequirements": []},
        ] + [
            # Batch-specific labs
            {"id": f"a_lab{i}", "teacherId": f"t_lab{i}", "subjectId": "s_lab",
             "semesterId": "sem3", "batchId": f"b{i}",
             "classroomId": f"lab{i}", "periodsPerWeek": 1,
             "isLab": True, "classroomRequirements": []}
            for i in range(1, 5)
        ],
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
        "timeLimitSeconds": 20,
    }

    res = client.post("/generate", json=p).json()
    assert res["success"] is True, (
        f"Full Sem3 scenario must be feasible. "
        f"Violations: {res.get('violations')} | Error: {res.get('errorMessage')}"
    )
    entries = res["timetable"]
    # 3 lecture periods + 4 lab periods = 7 total
    assert len(entries) == 7, f"Expected 7 entries, got {len(entries)}"

    lec_entries = [e for e in entries if e["subjectId"] == "s_lec"]
    lab_entries = [e for e in entries if e["subjectId"] == "s_lab"]

    assert len(lec_entries) == 3
    assert len(lab_entries) == 4

    # All lecture entries have batchId=None
    assert all(e.get("batchId") is None for e in lec_entries), (
        "Lecture entries must have batchId=None"
    )

    # All lecture entries use the large lecture hall
    assert all(e["classroomId"] == "lh1" for e in lec_entries), (
        f"Lectures must use lh1 (cap=80), got: {[e['classroomId'] for e in lec_entries]}"
    )

    # Lecture periods must be in distinct slots
    lec_slots = [e["timeSlotId"] for e in lec_entries]
    assert len(set(lec_slots)) == 3, f"Lecture periods overlap: {lec_slots}"

    # Lab entries must cover all 4 batches
    assert {e["batchId"] for e in lab_entries} == {"b1", "b2", "b3", "b4"}

    # No lecture and lab in the same time slot (ALL vs BATCH rule)
    lab_slots = {e["timeSlotId"] for e in lab_entries}
    lec_slot_set = set(lec_slots)
    overlap = lec_slot_set & lab_slots
    assert not overlap, (
        f"Lecture and lab slots overlap at: {overlap} — violates ALL vs BATCH rule"
    )

    # No teacher double-booked
    from collections import defaultdict
    teacher_slot_map: dict = defaultdict(list)
    for e in entries:
        teacher_slot_map[e["teacherId"]].append(e["timeSlotId"])
    for tid, slots in teacher_slot_map.items():
        assert len(slots) == len(set(slots)), (
            f"Teacher {tid} is double-booked across slots: {slots}"
        )

