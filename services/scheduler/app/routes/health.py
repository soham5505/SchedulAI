from fastapi import APIRouter
from ..models.output_models import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_health():
    return HealthResponse(
        status="ok",
        service="SchedulAI Scheduler Engine",
        version="1.0.0",
        engine="Google OR-Tools CP-SAT"
    )
