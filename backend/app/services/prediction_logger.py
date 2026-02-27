"""
Logger de predicciones: guarda cada prediccion como JSON-line con timestamp.
"""

import json
import os
from datetime import datetime, timezone


LOG_DIR = os.environ.get("PREDICTIONS_LOG_DIR", "/app/logs")


def log_prediction(
    filename: str,
    consensus_severity: str,
    consensus_confidence: float,
    agreement_count: int,
    total_models: int,
    is_retinal: bool,
    model_results: list[dict],
):
    """Guarda una linea JSON con los datos de la prediccion."""
    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = os.path.join(LOG_DIR, "predictions.jsonl")

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "filename": filename,
        "is_retinal": is_retinal,
        "consensus_severity": consensus_severity,
        "consensus_confidence": consensus_confidence,
        "agreement": f"{agreement_count}/{total_models}",
        "models": [
            {
                "name": r.get("model_name", ""),
                "severity": r.get("severity", ""),
                "confidence": r.get("confidence", 0.0),
            }
            for r in model_results
        ],
    }

    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"[WARN] No se pudo guardar log de prediccion: {e}")
