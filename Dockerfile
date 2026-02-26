# Production stage - Backend con frontend servido (MongoDB en Railway)
FROM ubuntu:22.04
WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Instalar dependencias del sistema (incluyendo OpenCV deps para ultralytics)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    python3-pip \
    libgl1 \
    libglib2.0-0 \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de backend
COPY backend/requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copiar código del backend
COPY backend/ .

# Descargar modelos desde Hugging Face (sin limite de bandwidth)
ENV HF_REPO=https://huggingface.co/Pimientos7/retinopatia-models-v2/resolve/main
RUN echo "[INFO] Descargando modelos desde Hugging Face..." && \
    mkdir -p /app/models_weights/densenet121_ea \
             /app/models_weights/efficientnet_b0_ea \
             /app/models_weights/resnet50_ea \
             /app/models_weights/vit_b16_ea \
             /app/models_weights/yolov8x_cls && \
    curl -L -o /app/models_weights/densenet121_ea/best_model.pth \
        "${HF_REPO}/densenet121_ea/best_model.pth" && \
    echo "  [OK] densenet121 descargado" && \
    curl -L -o /app/models_weights/efficientnet_b0_ea/best_model.pth \
        "${HF_REPO}/efficientnet_b0_ea/best_model.pth" && \
    echo "  [OK] efficientnet_b0 descargado" && \
    curl -L -o /app/models_weights/resnet50_ea/best_model.pth \
        "${HF_REPO}/resnet50_ea/best_model.pth" && \
    echo "  [OK] resnet50 descargado" && \
    curl -L -o /app/models_weights/vit_b16_ea/best_model.pth \
        "${HF_REPO}/vit_b16_ea/best_model.pth" && \
    echo "  [OK] vit_b16 descargado" && \
    curl -L -o /app/models_weights/yolov8x_cls/best.pt \
        "${HF_REPO}/yolov8x_cls/best.pt" && \
    echo "  [OK] yolov8x descargado" && \
    echo "[OK] Todos los modelos descargados desde Hugging Face"

# Verificacion final: asegurar que todos los modelos son binarios reales
RUN echo "[FINAL CHECK] Verificando modelos finales..." && \
    FAIL=0 && \
    for f in /app/models_weights/densenet121_ea/best_model.pth \
             /app/models_weights/efficientnet_b0_ea/best_model.pth \
             /app/models_weights/resnet50_ea/best_model.pth \
             /app/models_weights/vit_b16_ea/best_model.pth \
             /app/models_weights/yolov8x_cls/best.pt; do \
        SIZE=$(stat -c%s "$f" 2>/dev/null || echo 0); \
        echo "  $f -> ${SIZE} bytes"; \
        if [ "$SIZE" -lt 10000 ]; then \
            echo "  [ERROR] $f sigue siendo invalido"; \
            FAIL=1; \
        fi; \
    done && \
    if [ "$FAIL" = "1" ]; then \
        echo "[FATAL] No se pudieron obtener los modelos."; \
        exit 1; \
    else \
        echo "[OK] Todos los modelos verificados correctamente"; \
    fi

# Copiar frontend pre-compilado desde la carpeta public (ya compilado localmente)
COPY public/ /app/public/

# Copiar carpeta uploads (logo y recursos estáticos)
COPY uploads/ /app/uploads/

# Verificar que se copiaron los archivos del frontend
RUN echo "[FRONTEND COPY CHECK]" && ls -la /app/public/ && echo "[OK] Frontend files copiados"

# Crear script de inicio simplificado (MongoDB en Railway)
RUN cat > /start.sh << 'ENDSCRIPT'
#!/bin/bash
set -e
echo "[INFO] Iniciando FastAPI backend..."
echo "[INFO] MongoDB URL: Railway MongoDB service"
cd /app
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
ENDSCRIPT
RUN chmod +x /start.sh

# Exponer puerto
EXPOSE 8000

# Health check (start-period alto para dar tiempo a cargar modelos)
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Comando para iniciar
CMD ["/bin/bash", "/start.sh"]
