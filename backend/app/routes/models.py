"""
Endpoint de metricas de modelos de entrenamiento.
Sirve los JSONs de backend/data/model_metrics/.
"""

import json
import os
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/models", tags=["Model Metrics"])

# Buscar el directorio de metricas
_METRICS_DIRS = [
    os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'model_metrics'),  # desarrollo
    '/app/data/model_metrics',  # produccion Docker
]

MODEL_KEYS = [
    'densenet121_ea',
    'efficientnet_b0_ea',
    'resnet50_ea',
    'vit_b16_ea',
    'yolov8x_cls',
]


def _get_metrics_dir() -> str:
    for d in _METRICS_DIRS:
        resolved = os.path.abspath(d)
        if os.path.isdir(resolved):
            return resolved
    raise FileNotFoundError("Directorio de metricas no encontrado")


def _load_metric(model_key: str) -> dict:
    metrics_dir = _get_metrics_dir()
    path = os.path.join(metrics_dir, f'{model_key}.json')
    if not os.path.exists(path):
        raise FileNotFoundError(f"Metricas no encontradas para {model_key}")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


@router.get("/metrics")
async def get_all_metrics():
    """Retorna metricas de todos los modelos."""
    try:
        all_metrics = {}
        for key in MODEL_KEYS:
            try:
                all_metrics[key] = _load_metric(key)
            except FileNotFoundError:
                continue
        return all_metrics
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/metrics/{model_key}")
async def get_model_metrics(model_key: str):
    """Retorna metricas de un modelo especifico."""
    if model_key not in MODEL_KEYS:
        raise HTTPException(
            status_code=404,
            detail=f"Modelo '{model_key}' no encontrado. Modelos disponibles: {MODEL_KEYS}",
        )
    try:
        return _load_metric(model_key)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
