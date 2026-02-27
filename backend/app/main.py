from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.routes import auth, pages, prediction, models
from pathlib import Path
import os

# Crear instancia de FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="API Backend para sistema de deteccion de retinopatia diabetica"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Eventos de inicio y cierre
@app.on_event("startup")
async def startup_event():
    """Ejecutar al iniciar la aplicacion"""
    await connect_to_mongo()

    # Cargar modelos de IA
    from app.services.model_service import model_service
    models_dir = os.environ.get("MODELS_DIR", "/app/models_weights")
    model_service.load_all_models(models_dir)

    print(f"[OK] {settings.APP_NAME} v{settings.VERSION} iniciado")

@app.on_event("shutdown")
async def shutdown_event():
    """Ejecutar al cerrar la aplicacion"""
    await close_mongo_connection()
    print("[*] Aplicacion cerrada")

# Servir archivos estáticos del frontend PRIMERO (antes de las rutas de API)
PUBLIC_DIR = Path("/app/public")
STATIC_DIR = PUBLIC_DIR / "static"

print(f"[DEBUG] Buscando frontend en: {PUBLIC_DIR}")
print(f"[DEBUG] Buscando estáticos en: {STATIC_DIR}")

if PUBLIC_DIR.exists():
    print(f"[INFO] Carpeta public encontrada: {PUBLIC_DIR}")
    files = list(PUBLIC_DIR.glob("*"))
    print(f"[INFO] Archivos en public: {[f.name for f in files]}")
    
    # Montar archivos estáticos - la carpeta STATIC_DIR se monta en /static
    if STATIC_DIR.exists():
        print(f"[INFO] Montando archivos estáticos desde: {STATIC_DIR} en /static")
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    else:
        print(f"[WARNING] Carpeta static NO encontrada en {STATIC_DIR}")
else:
    print(f"[WARNING] Carpeta public NO encontrada en {PUBLIC_DIR}")

# Montar carpeta de uploads para servir imágenes subidas
# En producción (Docker): /app/uploads
# En desarrollo local: ../uploads (relativo al backend)
UPLOADS_DIR = Path("/app/uploads") if Path("/app/uploads").exists() else Path(__file__).parent.parent.parent / "uploads"

if UPLOADS_DIR.exists():
    print(f"[INFO] Montando carpeta uploads desde: {UPLOADS_DIR} en /uploads")
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
else:
    print(f"[WARNING] Carpeta uploads NO encontrada en {UPLOADS_DIR}")
    # Crear la carpeta si no existe
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[INFO] Carpeta uploads creada en {UPLOADS_DIR}")
    app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Registrar rutas de API
app.include_router(auth.router, prefix="/api")
app.include_router(pages.router, prefix="/api")
app.include_router(prediction.router, prefix="/api")
app.include_router(models.router, prefix="/api")

# Health check
@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}

# Debug endpoint - para testear que el backend recibe requests
@app.get("/api/debug")
async def debug():
    """Debug endpoint para verificar que el backend está accesible"""
    return {
        "status": "ok",
        "message": "Backend accesible desde la URL pública",
        "origin_header": "check browser console"
    }

# SPA fallback - servir index.html para todas las rutas que no sean /api, /docs, /health, /static, /openapi.json
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Servir la aplicación React (SPA) - fallback para todas las rutas no capturadas"""
    # Excluir rutas de API y documentación
    if full_path.startswith("api/"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    if full_path in ["docs", "openapi.json", "redoc", "health"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")
    
    # Servir index.html para cualquier otra ruta (SPA)
    index_file = PUBLIC_DIR / "index.html"
    if index_file.exists():
        print(f"[DEBUG] Sirviendo index.html para ruta: /{full_path}")
        return FileResponse(index_file, media_type="text/html")
    
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Frontend index.html not found")

# Ruta raiz - servir index.html
@app.get("/")
async def root():
    """Servir el frontend React en la raiz"""
    index_file = PUBLIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file, media_type="text/html")
    
    # Fallback si no existe
    return {
        "message": f"{settings.APP_NAME} v{settings.VERSION}",
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }
