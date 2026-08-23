from fastapi import APIRouter
from ..models.input_models import SuggestRequest
from ..models.output_models import SuggestResponse
from ..solver.suggest import SlotSuggester

router = APIRouter(tags=["Suggest"])


@router.post("/suggest", response_model=SuggestResponse)
def suggest_alternatives(request: SuggestRequest):
    suggester = SlotSuggester(request)
    return suggester.suggest()
