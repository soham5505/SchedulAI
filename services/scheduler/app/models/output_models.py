from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from .input_models import DayOfWeek, PeriodType, TimeSlotInput, ClassroomInput


class TimetableEntryOutput(BaseModel):
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


class ViolationOutput(BaseModel):
    type: str
    severity: str = "ERROR"  # "ERROR" or "WARNING"
    message: str
    entityType: Optional[str] = None
    entityId: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class GenerateResponse(BaseModel):
    success: bool
    status: str  # "COMPLETED", "FAILED", "PENDING"
    timetable: List[TimetableEntryOutput] = Field(default_factory=list)
    score: float = 0.0
    violations: List[ViolationOutput] = Field(default_factory=list)
    statistics: Dict[str, Any] = Field(default_factory=dict)
    errorMessage: Optional[str] = None


class ValidateResponse(BaseModel):
    isValid: bool
    violations: List[ViolationOutput] = Field(default_factory=list)
    stats: Dict[str, Any] = Field(default_factory=dict)


class SlotSuggestionOutput(BaseModel):
    timeSlotId: str
    timeSlot: TimeSlotInput
    classroomId: str
    classroom: ClassroomInput
    score: float
    reason: str


class SuggestResponse(BaseModel):
    valid: bool
    conflicts: List[ViolationOutput] = Field(default_factory=list)
    suggestions: List[SlotSuggestionOutput] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    service: str = "SchedulAI Scheduler Engine"
    version: str = "1.0.0"
    engine: str = "Google OR-Tools CP-SAT"
