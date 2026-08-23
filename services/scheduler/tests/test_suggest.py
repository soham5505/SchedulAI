from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_suggest_alternative_slots():
    payload = {
        "entryId": "entry1",
        "targetTimeSlotId": "ts2",
        "targetClassroomId": "c1",
        "currentTimetable": [
            {
                "id": "entry1",
                "semesterId": "sem1",
                "subjectId": "s1",
                "teacherId": "t1",
                "classroomId": "c1",
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
                "preferredTimeSlots": ["ts2"],
                "unavailableTimeSlots": [],
                "maxClassesPerDay": 4,
                "maxClassesPerWeek": 20
            }
        ],
        "subjects": [
            {"id": "s1", "name": "Algorithms", "code": "CS101", "weeklyPeriods": 3, "lecturePeriods": 3, "labPeriods": 0, "isLab": False}
        ],
        "classrooms": [
            {"id": "c1", "name": "Room 101", "capacity": 50, "type": "LECTURE", "equipment": [], "isLab": False, "isAvailable": True}
        ],
        "semesters": [
            {"id": "sem1", "name": "CS 3", "studentCount": 30}
        ],
        "timeslots": [
            {"id": "ts1", "day": "MONDAY", "startTime": "09:00", "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True},
            {"id": "ts2", "day": "MONDAY", "startTime": "10:00", "endTime": "11:00", "periodNumber": 2, "isBreak": False, "isActive": True},
            {"id": "ts3", "day": "TUESDAY", "startTime": "09:00", "endTime": "10:00", "periodNumber": 1, "isBreak": False, "isActive": True}
        ],
        "teachingAssignments": [
            {"id": "a1", "teacherId": "t1", "subjectId": "s1", "semesterId": "sem1", "classroomRequirements": [], "periodsPerWeek": 1, "isLab": False}
        ]
    }

    response = client.post("/suggest", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert len(data["suggestions"]) > 0
