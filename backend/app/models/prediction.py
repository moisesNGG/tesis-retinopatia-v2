from pydantic import BaseModel
from typing import List, Optional


class SingleModelResult(BaseModel):
    model_name: str
    prediction: str
    confidence: float
    severity: str
    probabilities: List[float]


class ConsensusResult(BaseModel):
    prediction: str
    severity: str
    confidence: float
    agreement_count: int
    total_models: int
    recommendation: str


class RetinalValidation(BaseModel):
    is_retinal: bool
    max_confidence: float
    avg_entropy: float


class CustomModelResponse(BaseModel):
    model_name: str
    architecture: str
    prediction: str
    confidence: float
    severity: str
    probabilities: List[float]
    preprocessing: dict
    gradcam_overlay: Optional[str] = None
    is_retinal: bool
    image_filename: str


class MultiModelPredictionResponse(BaseModel):
    results: List[SingleModelResult]
    consensus: ConsensusResult
    image_filename: str
    is_retinal: bool = True
    retinal_validation: Optional[RetinalValidation] = None
    gradcam_overlay: Optional[str] = None
    gradcam_model: Optional[str] = None
