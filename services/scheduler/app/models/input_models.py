from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DayOfWeek(str, Enum):
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"


class RoomType(str, Enum):
    LECTURE = "LECTURE"
    LAB = "LAB"
    SEMINAR = "SEMINAR"
    OTHER = "OTHER"


class PeriodType(str, Enum):
    LECTURE = "LECTURE"
    LAB = "LAB"
    TUTORIAL = "TUTORIAL"
    SEMINAR = "SEMINAR"


class TeacherInput(BaseModel):
    id: str
    name: str
    availability: List[DayOfWeek] = Field(default_factory=lambda: [
        DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY
    ])
    preferredTimeSlots: List[str] = Field(default_factory=list)
    unavailableTimeSlots: List[str] = Field(default_factory=list)
    maxClassesPerDay: int = Field(default=4, ge=1, le=10)
    maxClassesPerWeek: int = Field(default=20, ge=1, le=40)
    isMaxWeeklySourceDefined: bool = Field(default=False, description="True if maxClassesPerWeek comes from source data, False if it's a default value")


class SubjectInput(BaseModel):
    id: str
    name: str
    code: str
    weeklyPeriods: int = Field(default=4, ge=1, le=20)
    lecturePeriods: int = Field(default=3, ge=0, le=20)
    labPeriods: int = Field(default=1, ge=0, le=20)
    isLab: bool = False


class ClassroomInput(BaseModel):
    id: str
    name: str
    building: Optional[str] = ""
    roomNumber: Optional[str] = ""
    capacity: int = Field(default=40, ge=1)
    type: RoomType = RoomType.LECTURE
    equipment: List[str] = Field(default_factory=list)
    isLab: bool = False
    isAvailable: bool = True


class SemesterInput(BaseModel):
    id: str
    name: str
    studentCount: int = Field(default=30, ge=1)


class BatchInput(BaseModel):
    id: str
    semesterId: str
    code: str
    studentCount: int = Field(default=30, ge=1)


class TimeSlotInput(BaseModel):
    id: str
    day: DayOfWeek
    startTime: str
    endTime: str
    periodNumber: int
    isBreak: bool = False
    isActive: bool = True
    label: Optional[str] = None


class RoomBlockInput(BaseModel):
    """A recurring room reservation expressed in teaching-period numbers.

    The reservation owner is retained for display/auditing, but generation
    treats every block as unavailable to every department.
    """
    id: Optional[str] = None
    classroomId: str
    departmentId: Optional[str] = None
    dayOfWeek: DayOfWeek
    startPeriod: int = Field(ge=1)
    duration: int = Field(ge=1)
    reason: Optional[str] = None


class AssignmentInput(BaseModel):
    id: str
    teacherId: str
    subjectId: str
    semesterId: str
    batchId: Optional[str] = None
    classroomId: Optional[str] = None
    classroomRequirements: List[str] = Field(default_factory=list)
    periodsPerWeek: int = Field(default=4, ge=1, le=20)
    isLab: bool = False


class HardConstraintsInput(BaseModel):
    enforceTeacherConflicts: bool = True
    enforceClassroomConflicts: bool = True
    enforceSemesterConflicts: bool = True
    enforceTeacherAvailability: bool = True
    enforceClassroomCapacity: bool = True
    enforceLabCompatibility: bool = True
    enforceWeeklyPeriodRequirements: bool = True
    enforceTeacherWorkloadLimits: bool = True


class SoftConstraintsInput(BaseModel):
    avoidEarlyMorning: int = Field(default=5, ge=0, le=10)
    avoidFridayAfternoon: int = Field(default=4, ge=0, le=10)
    avoidTeacherGaps: int = Field(default=6, ge=0, le=10)
    preferConsecutiveClasses: int = Field(default=4, ge=0, le=10)
    balanceTeacherWorkload: int = Field(default=7, ge=0, le=10)
    balanceStudentWorkload: int = Field(default=6, ge=0, le=10)
    avoidUnnecessaryClassroomChanges: int = Field(default=5, ge=0, le=10)
    preferTeacherPreferredPeriods: int = Field(default=7, ge=0, le=10)
    preferPreferredClassrooms: int = Field(default=4, ge=0, le=10)
    avoidExcessiveConsecutiveClasses: int = Field(default=6, ge=0, le=10)
    spreadSubjects: int = Field(default=7, ge=0, le=10)


class GenerateRequest(BaseModel):
    teachers: List[TeacherInput]
    subjects: List[SubjectInput]
    classrooms: List[ClassroomInput]
    semesters: List[SemesterInput]
    batches: List[BatchInput] = Field(default_factory=list)
    timeslots: List[TimeSlotInput]
    roomBlocks: List[RoomBlockInput] = Field(default_factory=list)
    teachingAssignments: List[AssignmentInput]
    hardConstraints: Optional[HardConstraintsInput] = Field(default_factory=HardConstraintsInput)
    softConstraints: Optional[SoftConstraintsInput] = Field(default_factory=SoftConstraintsInput)
    preferences: Optional[Dict[str, Any]] = Field(default_factory=dict)
    timeLimitSeconds: Optional[int] = Field(default=60, ge=5, le=300)


class ExistingTimetableEntryInput(BaseModel):
    id: Optional[str] = None
    assignmentId: Optional[str] = None
    semesterId: str
    batchId: Optional[str] = None
    subjectId: str
    teacherId: str
    classroomId: str
    timeSlotId: str
    day: DayOfWeek
    startTime: str
    endTime: str
    periodType: PeriodType = PeriodType.LECTURE


class ValidateRequest(BaseModel):
    timetable: List[ExistingTimetableEntryInput]
    teachers: List[TeacherInput]
    subjects: List[SubjectInput]
    classrooms: List[ClassroomInput]
    semesters: List[SemesterInput]
    batches: List[BatchInput] = Field(default_factory=list)
    timeslots: List[TimeSlotInput]
    teachingAssignments: List[AssignmentInput]


class SuggestRequest(BaseModel):
    entryId: str
    targetTimeSlotId: str
    targetClassroomId: Optional[str] = None
    currentTimetable: List[ExistingTimetableEntryInput]
    teachers: List[TeacherInput]
    subjects: List[SubjectInput]
    classrooms: List[ClassroomInput]
    semesters: List[SemesterInput]
    batches: List[BatchInput] = Field(default_factory=list)
    timeslots: List[TimeSlotInput]
    teachingAssignments: List[AssignmentInput]
