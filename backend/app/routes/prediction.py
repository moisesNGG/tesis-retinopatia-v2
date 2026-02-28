from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from app.models.prediction import (
    SingleModelResult,
    ConsensusResult,
    RetinalValidation,
    MultiModelPredictionResponse,
    CustomModelResponse,
)
from app.services.model_service import model_service
from collections import Counter

router = APIRouter(prefix="/predict", tags=["AI Prediction"])


@router.post("/", response_model=MultiModelPredictionResponse)
async def predict_retinopathy(image: UploadFile = File(...)):
    """Endpoint para prediccion de retinopatia diabetica con 5 modelos de IA"""

    if not image.content_type or not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    if model_service.loading:
        raise HTTPException(
            status_code=503,
            detail=f"Los modelos de IA se estan cargando ({model_service.models_loaded_count}/5). Intente de nuevo en unos segundos.",
        )

    if not model_service.loaded:
        raise HTTPException(
            status_code=503,
            detail="Los modelos de IA no pudieron cargarse. Revise los logs del servidor.",
        )

    contents = await image.read()

    raw_results = model_service.predict_all(contents)

    results = [SingleModelResult(**r) for r in raw_results]

    # Validar si es una imagen retinal
    validity = model_service.check_retinal_validity(raw_results)
    retinal_validation = RetinalValidation(**validity)

    consensus = _compute_consensus(results)

    # Grad-CAM solo si es imagen retinal
    gradcam_overlay = None
    gradcam_model = None
    if validity['is_retinal']:
        gradcam_result = model_service.predict_with_gradcam(contents)
        if gradcam_result:
            gradcam_overlay = gradcam_result['overlay_base64']
            gradcam_model = gradcam_result['gradcam_model']

    # Log de prediccion
    try:
        from app.services.prediction_logger import log_prediction
        log_prediction(
            filename=image.filename or "imagen.jpg",
            consensus_severity=consensus.severity,
            consensus_confidence=consensus.confidence,
            agreement_count=consensus.agreement_count,
            total_models=consensus.total_models,
            is_retinal=validity['is_retinal'],
            model_results=raw_results,
        )
    except Exception:
        pass  # No fallar por el logging

    return MultiModelPredictionResponse(
        results=results,
        consensus=consensus,
        image_filename=image.filename or "imagen.jpg",
        is_retinal=validity['is_retinal'],
        retinal_validation=retinal_validation,
        gradcam_overlay=gradcam_overlay,
        gradcam_model=gradcam_model,
    )


@router.post("/custom-model", response_model=CustomModelResponse)
async def predict_custom_model(image: UploadFile = File(...)):
    """Prediccion usando solo EfficientNet-B0+EA (modelo personalizado)"""

    if not image.content_type or not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    if model_service.loading:
        raise HTTPException(
            status_code=503,
            detail=f"Los modelos de IA se estan cargando ({model_service.models_loaded_count}/5).",
        )

    if not model_service.loaded:
        raise HTTPException(
            status_code=503,
            detail="Los modelos de IA no pudieron cargarse.",
        )

    contents = await image.read()

    try:
        result = model_service.predict_single_efficientnet(contents)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Validar si es retinal usando solo este modelo (criterios mas estrictos)
    import math
    probs = result.get('probabilities', [])
    confidence = result.get('confidence', 0.0)
    entropy = -sum(p * math.log(p + 1e-10) for p in probs) if probs else 0.0
    # Con un solo modelo: exigir confianza >= 60% O entropia baja
    is_retinal = confidence >= 0.60 or entropy < 1.0

    # Grad-CAM
    gradcam_overlay = None
    if is_retinal:
        gradcam_result = model_service.predict_with_gradcam(contents)
        if gradcam_result:
            gradcam_overlay = gradcam_result['overlay_base64']

    return CustomModelResponse(
        model_name=result['model_name'],
        architecture=result['architecture'],
        prediction=result['prediction'],
        confidence=result['confidence'],
        severity=result['severity'],
        probabilities=result['probabilities'],
        preprocessing=result['preprocessing'],
        gradcam_overlay=gradcam_overlay,
        is_retinal=is_retinal,
        image_filename=image.filename or "imagen.jpg",
    )


@router.post("/report")
async def generate_pdf_report(image: UploadFile = File(...)):
    """Genera un reporte PDF con el analisis completo de la imagen."""

    if not image.content_type or not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    if model_service.loading:
        raise HTTPException(
            status_code=503,
            detail=f"Los modelos de IA se estan cargando ({model_service.models_loaded_count}/5).",
        )

    if not model_service.loaded:
        raise HTTPException(
            status_code=503,
            detail="Los modelos de IA no pudieron cargarse.",
        )

    contents = await image.read()

    try:
        # Ejecutar prediccion completa
        raw_results = model_service.predict_all(contents)
        results = [SingleModelResult(**r) for r in raw_results]
        validity = model_service.check_retinal_validity(raw_results)
        consensus = _compute_consensus(results)

        # Grad-CAM
        gradcam_overlay_b64 = None
        if validity['is_retinal']:
            try:
                gradcam_result = model_service.predict_with_gradcam(contents)
                if gradcam_result:
                    gradcam_overlay_b64 = gradcam_result['overlay_base64']
            except Exception as e:
                print(f"[WARN] Grad-CAM fallo en reporte, continuando sin heatmap: {e}")

        # Generar PDF
        from app.services.pdf_service import generate_report as build_pdf
        pdf_bytes = build_pdf(
            image_bytes=contents,
            filename=image.filename or "imagen.jpg",
            results=raw_results,
            consensus={
                'prediction': consensus.prediction,
                'severity': consensus.severity,
                'confidence': consensus.confidence,
                'agreement_count': consensus.agreement_count,
                'total_models': consensus.total_models,
                'recommendation': consensus.recommendation,
            },
            is_retinal=validity['is_retinal'],
            gradcam_overlay_b64=gradcam_overlay_b64,
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="reporte_retinopatia.pdf"'
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al generar el reporte: {str(e)}")


def _compute_consensus(results: list[SingleModelResult]) -> ConsensusResult:
    valid = [r for r in results if r.prediction != 'Error']
    total = len(results)

    if not valid:
        return ConsensusResult(
            prediction='Error',
            severity='none',
            confidence=0.0,
            agreement_count=0,
            total_models=total,
            recommendation='No se pudo realizar el analisis. Intente de nuevo.',
        )

    votes = Counter(r.severity for r in valid)
    winner_severity, agreement_count = votes.most_common(1)[0]

    winners = [r for r in valid if r.severity == winner_severity]
    avg_confidence = sum(r.confidence for r in winners) / len(winners)

    winner_idx = ['none', 'mild', 'moderate', 'severe', 'proliferative'].index(winner_severity)
    from app.services.model_service import CLASS_LABELS
    prediction = CLASS_LABELS[winner_idx]

    return ConsensusResult(
        prediction=prediction,
        severity=winner_severity,
        confidence=round(avg_confidence, 4),
        agreement_count=agreement_count,
        total_models=total,
        recommendation=_get_recommendation(winner_severity),
    )


def _get_recommendation(severity: str) -> str:
    recommendations = {
        'none': 'La imagen no corresponde a una retinografia. Suba una imagen de fondo de ojo para obtener un diagnostico.',
        'mild': 'Se detectaron signos leves de retinopatia diabetica. Consulte con su oftalmologo para evaluacion y seguimiento.',
        'moderate': 'Se detectaron signos moderados de retinopatia diabetica. Se recomienda consulta con oftalmologo a la brevedad.',
        'severe': 'Se detectaron signos severos de retinopatia diabetica. Se requiere atencion oftalmologica urgente.',
        'proliferative': 'Se detecto retinopatia diabetica proliferativa. Se requiere atencion oftalmologica inmediata.',
    }
    return recommendations.get(severity, 'Consulte con un especialista para evaluacion.')
