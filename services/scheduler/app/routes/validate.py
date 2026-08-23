from fastapi import APIRouter
from ..models.input_models import ValidateRequest
from ..models.output_models import ValidateResponse
from ..solver.validator import TimetableValidator

router = APIRouter(tags=["Validate"])


@router.post("/validate", response_model=ValidateResponse)
def validate_timetable(request: ValidateRequest):
    validator = TimetableValidator(request)
    return validator.validate()
