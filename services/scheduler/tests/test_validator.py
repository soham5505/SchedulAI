from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_validator_detects_conflicts():
    payload = {
        "timetable": [
            {
                "semesterId": "sem1",
                "subjectId": "s1",
                "teacherId": "t1",
                "classroomId": "c1",
                "timeSlotId": "ts1",
                "day": "MONDAY",
                "startTime": "09:00",
                "endTime": "10:00",
                "periodType": "LECTURE"
            },
            {
                "semesterId": "sem2",
                "subjectId": "s2",
                "teacherId": "t1",  # Same teacher at same time -> conflict!
                "classroomId": "c2",
                "timeSlotId": "ts1",
                "day": "MONDAY",
                "startTime": "09:00",
                "endTime": "10:00",
                "periodType": "LECTURE"
            }
        ],
        "teachers": [
            {
                "id": "t1",
                "name": "Dr. Alan Turing",
                "availability": ["MONDAY", "TUESDAY"],
                "preferredTimeSlots": [],
                "unavailableTimeSlots": [],
                "maxClassesPerDay": 4,
                "maxClassesPerWeek": 20
            }
        ],
        "subjects": [
            {"id": "s1", "name": "Algorithms", "code": "CS101", "weeklyPeriods": 3, "lecturePeriods": 3, "labPeriods": 0, "isLab": False},
            {"id": "s2", "name": "Security", "code": "CS102", "weeklyPeriods": 3, "lecturePeriods": 3, "labPeriods": 0, "isLab": False}
        ],
        "classrooms": [
            {"id": "c1", "name": "Room 1", "capacity": 50, "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True},
            {"id": "c2", "name": "Room 2", "capacity": 50, "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True}
        ],
        "semesters": [
            {"id": "sem1", "name": "Sem 1", "studentCount": 30},
            {"id": "sem2", "name": "Sem 2", "studentCount": 30}
        ],
        "timeslots": [
            {"id": "ts1", "day": "MONDAY", "startTime": "09:00", "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True}
        ],
        "teachingAssignments": []
    }

    response = client.post("/validate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["isValid"] is False
    assert any(v["type"] == "TEACHER_CONFLICT" for v in data["violations"])
