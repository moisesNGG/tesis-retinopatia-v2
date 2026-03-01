from fastapi import APIRouter, HTTPException, UploadFile, File, status
from typing import List
from app.models.page import PageCreate, PageUpdate, PageInDB
from app.core.database import get_database
from datetime import datetime
from bson import ObjectId
from pathlib import Path
from uuid import uuid4
import shutil

router = APIRouter(prefix="/pages", tags=["Pages"])

def page_helper(page) -> dict:
    """Helper para convertir documento de MongoDB a dict"""
    return {
        "_id": str(page["_id"]),
        "slug": page["slug"],
        "title": page["title"],
        "subtitle": page.get("subtitle", ""),
        "heroImage": page.get("heroImage"),
        "heroImageStyle": page.get("heroImageStyle", "cover"),
        "sections": page.get("sections", []),
        "metaDescription": page.get("metaDescription", ""),
        "isPublished": page.get("isPublished", True),
        "createdAt": page.get("createdAt"),
        "updatedAt": page.get("updatedAt")
    }

@router.get("/", response_model=List[dict])
async def get_all_pages():
    """Obtener todas las páginas"""
    db = get_database()
    pages = []

    cursor = db.pages.find({"isPublished": True})
    async for page in cursor:
        pages.append(page_helper(page))

    return pages

@router.get("/{slug}", response_model=dict)
async def get_page_by_slug(slug: str):
    """Obtener página por slug"""
    db = get_database()

    page = await db.pages.find_one({"slug": slug})

    if not page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Página con slug '{slug}' no encontrada"
        )

    return page_helper(page)

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_page(page_data: PageCreate):
    """Crear nueva página"""
    db = get_database()

    # Verificar si ya existe una página con ese slug
    existing_page = await db.pages.find_one({"slug": page_data.slug})
    if existing_page:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ya existe una página con el slug '{page_data.slug}'"
        )

    # Crear página
    page_dict = page_data.model_dump()
    page_dict["createdAt"] = datetime.utcnow()
    page_dict["updatedAt"] = datetime.utcnow()

    result = await db.pages.insert_one(page_dict)
    created_page = await db.pages.find_one({"_id": result.inserted_id})

    return page_helper(created_page)

@router.put("/{slug}", response_model=dict)
async def update_page(slug: str, page_data: PageUpdate):
    """Actualizar página existente"""
    db = get_database()

    # Verificar que la página existe
    existing_page = await db.pages.find_one({"slug": slug})
    if not existing_page:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Página con slug '{slug}' no encontrada"
        )

    # Actualizar solo los campos proporcionados
    update_data = {k: v for k, v in page_data.model_dump(exclude_unset=True).items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow()

    await db.pages.update_one(
        {"slug": slug},
        {"$set": update_data}
    )

    updated_page = await db.pages.find_one({"slug": slug})
    return page_helper(updated_page)

@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(slug: str):
    """Eliminar página"""
    db = get_database()

    result = await db.pages.delete_one({"slug": slug})

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Página con slug '{slug}' no encontrada"
        )

    return None


ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
UPLOADS_DIR = Path("/app/uploads") if Path("/app/uploads").exists() else Path(__file__).resolve().parent.parent.parent / "uploads"


@router.post("/upload", response_model=dict)
async def upload_image(file: UploadFile = File(...)):
    """Subir una imagen para usar en el CMS"""
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tipo de archivo no permitido: {file.content_type}. Solo se permiten: jpg, png, webp, gif"
        )

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # Generar nombre único preservando la extensión original
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    safe_name = Path(file.filename).stem.replace(" ", "-") if file.filename else "imagen"
    unique_name = f"{uuid4().hex[:8]}_{safe_name}{ext}"
    dest = UPLOADS_DIR / unique_name

    with open(dest, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {"url": f"/uploads/{unique_name}"}
