from fastapi import APIRouter, HTTPException
from ..models.input_models import GenerateRequest
from ..models.output_models import GenerateResponse
from ..solver.timetable_solver import TimetableSolver

router = APIRouter(tags=["Generate"])


@router.post("/generate", response_model=GenerateResponse)
def generate_timetable(request: GenerateRequest):
    try:
        solver = TimetableSolver(request)
        result = solver.solve()
        return result
    except Exception as e:
        return GenerateResponse(
            success=False,
            status="FAILED",
            timetable=[],
            score=0.0,
            violations=[],
            errorMessage=f"Scheduler error: {str(e)}"
        )
