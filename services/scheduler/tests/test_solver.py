import pytest
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
