"""
Servicio de generacion de reportes PDF para analisis de retinopatia.
Usa fpdf2 para generar PDFs con imagen original, Grad-CAM, diagnostico, etc.
"""

import io
import base64
import tempfile
import os
from datetime import datetime, timezone
from fpdf import FPDF
from PIL import Image


CLASS_LABELS = [
    'Sin Retinopatia',
    'RD Leve',
    'RD Moderada',
    'RD Severa',
    'RD Proliferativa',
]

SEVERITY_LABELS = {
    'none': 'Sin Retinopatia Diabetica',
    'mild': 'Retinopatia Diabetica Leve',
    'moderate': 'Retinopatia Diabetica Moderada',
    'severe': 'Retinopatia Diabetica Severa',
    'proliferative': 'Retinopatia Diabetica Proliferativa',
}

SEVERITY_DESCRIPTIONS = {
    'none': 'No se detectaron signos de retinopatia diabetica en la imagen analizada.',
    'mild': 'Se detectaron microaneurismas u otros signos leves. Se recomienda seguimiento anual.',
    'moderate': 'Se detectaron signos moderados como hemorragias o exudados. Consulte con un oftalmologo.',
    'severe': 'Se detectaron signos severos. Se requiere atencion oftalmologica urgente.',
    'proliferative': 'Se detecto neovascularizacion u otros signos proliferativos. Atencion inmediata requerida.',
}


class RetinopathyReport(FPDF):
    """PDF personalizado para reportes de retinopatia."""

    def header(self):
        self.set_font('Helvetica', 'B', 16)
        self.set_text_color(30, 64, 175)  # Azul
        self.cell(0, 10, 'RETINAIA', align='L')
        self.set_font('Helvetica', '', 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, 'Sistema de Deteccion de Retinopatia Diabetica', align='R')
        self.ln(12)
        # Linea separadora
        self.set_draw_color(30, 64, 175)
        self.set_line_width(0.5)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)

    def footer(self):
        self.set_y(-25)
        self.set_draw_color(200, 200, 200)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(3)
        self.set_font('Helvetica', 'I', 7)
        self.set_text_color(150, 150, 150)
        self.multi_cell(
            0, 3,
            'AVISO: Este reporte es generado por un sistema de IA con fines academicos. '
            'No constituye diagnostico medico. Consulte con un oftalmologo para evaluacion profesional.',
            align='C',
        )
        self.cell(0, 4, f'Pagina {self.page_no()}/{{nb}}', align='C')


def generate_report(
    image_bytes: bytes,
    filename: str,
    results: list[dict],
    consensus: dict,
    is_retinal: bool,
    gradcam_overlay_b64: str | None = None,
) -> bytes:
    """
    Genera un reporte PDF completo.

    Returns:
        bytes del PDF generado
    """
    pdf = RetinopathyReport()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=30)
    pdf.add_page()

    now = datetime.now(timezone.utc)
    timestamp = now.strftime('%d/%m/%Y %H:%M UTC')

    # --- Titulo del reporte ---
    pdf.set_font('Helvetica', 'B', 14)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 8, 'Reporte de Analisis de Retinopatia Diabetica', ln=True)
    pdf.set_font('Helvetica', '', 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, f'Fecha: {timestamp}  |  Archivo: {filename}', ln=True)
    pdf.ln(5)

    # --- Warning si no es retinal ---
    if not is_retinal:
        pdf.set_fill_color(254, 226, 226)
        pdf.set_text_color(153, 27, 27)
        pdf.set_font('Helvetica', 'B', 10)
        pdf.cell(0, 8, '  ADVERTENCIA: La imagen no parece ser una retinografia valida', ln=True, fill=True)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 5, 'Los resultados pueden no ser confiables. Utilice una imagen de fondo de ojo.', ln=True)
        pdf.ln(5)

    # --- Imagenes: Original y Grad-CAM ---
    tmp_files = []
    try:
        # Imagen original
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        tmp_orig = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
        img.save(tmp_orig.name, format='JPEG', quality=85)
        tmp_files.append(tmp_orig.name)

        if gradcam_overlay_b64:
            # Grad-CAM overlay
            gradcam_bytes = base64.b64decode(gradcam_overlay_b64)
            gradcam_img = Image.open(io.BytesIO(gradcam_bytes)).convert('RGB')
            tmp_gc = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
            gradcam_img.save(tmp_gc.name, format='JPEG', quality=85)
            tmp_files.append(tmp_gc.name)

            # Lado a lado
            pdf.set_font('Helvetica', 'B', 10)
            pdf.set_text_color(30, 30, 30)
            pdf.cell(90, 6, 'Imagen Original', align='C')
            pdf.cell(90, 6, 'Mapa de Calor (Grad-CAM)', align='C')
            pdf.ln(7)
            img_y = pdf.get_y()
            pdf.image(tmp_orig.name, x=15, y=img_y, w=85)
            pdf.image(tmp_gc.name, x=110, y=img_y, w=85)
            pdf.ln(68)
        else:
            # Solo imagen original centrada
            pdf.set_font('Helvetica', 'B', 10)
            pdf.set_text_color(30, 30, 30)
            pdf.cell(0, 6, 'Imagen Analizada', align='C', ln=True)
            pdf.ln(2)
            pdf.image(tmp_orig.name, x=55, y=pdf.get_y(), w=100)
            pdf.ln(68)
    except Exception as e:
        pdf.set_font('Helvetica', 'I', 9)
        pdf.cell(0, 5, f'[No se pudo incluir la imagen: {e}]', ln=True)

    pdf.ln(5)

    # --- Diagnostico por Consenso ---
    severity = consensus.get('severity', 'none')
    severity_label = SEVERITY_LABELS.get(severity, severity)
    confidence = consensus.get('confidence', 0)
    agreement = consensus.get('agreement_count', 0)
    total = consensus.get('total_models', 5)

    # Fondo de color segun severidad
    severity_colors = {
        'none': (220, 252, 231),
        'mild': (254, 249, 195),
        'moderate': (255, 237, 213),
        'severe': (254, 226, 226),
        'proliferative': (254, 202, 202),
    }
    bg = severity_colors.get(severity, (240, 240, 240))

    pdf.set_fill_color(*bg)
    pdf.set_font('Helvetica', 'B', 12)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 10, f'  Diagnostico: {severity_label}', ln=True, fill=True)

    pdf.set_font('Helvetica', '', 10)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 7, f'  Confianza promedio: {confidence * 100:.1f}%   |   Acuerdo: {agreement}/{total} modelos', ln=True)
    pdf.ln(2)

    # Recomendacion
    recommendation = consensus.get('recommendation', '')
    if recommendation:
        pdf.set_font('Helvetica', 'I', 9)
        pdf.set_text_color(80, 80, 80)
        pdf.multi_cell(0, 5, f'Recomendacion: {recommendation}')
    pdf.ln(5)

    # --- Tabla de resultados por modelo ---
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 8, 'Resultados por Modelo', ln=True)
    pdf.ln(2)

    # Header de tabla
    pdf.set_font('Helvetica', 'B', 8)
    pdf.set_fill_color(30, 64, 175)
    pdf.set_text_color(255, 255, 255)
    col_widths = [50, 50, 25, 25, 25, 15]
    headers = ['Modelo', 'Prediccion', 'Confianza', 'Severidad', 'Max Prob', 'Clase']
    for i, h in enumerate(headers):
        pdf.cell(col_widths[i], 7, h, border=1, fill=True, align='C')
    pdf.ln()

    # Filas
    pdf.set_font('Helvetica', '', 8)
    pdf.set_text_color(30, 30, 30)
    for i, r in enumerate(results):
        fill = i % 2 == 0
        if fill:
            pdf.set_fill_color(245, 245, 245)

        probs = r.get('probabilities', [])
        max_prob = max(probs) if probs else 0
        max_class = probs.index(max_prob) if probs else 0

        row = [
            r.get('model_name', ''),
            r.get('prediction', ''),
            f"{r.get('confidence', 0) * 100:.1f}%",
            r.get('severity', ''),
            f"{max_prob * 100:.1f}%",
            str(max_class),
        ]
        for j, val in enumerate(row):
            pdf.cell(col_widths[j], 6, val, border=1, fill=fill, align='C')
        pdf.ln()

    pdf.ln(5)

    # --- Escala de severidad ---
    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 8, 'Escala de Severidad', ln=True)
    pdf.ln(2)

    scale_items = [
        ('0 - Sin RD', (34, 197, 94), 'No se observan anomalias retinales'),
        ('1 - RD Leve', (234, 179, 8), 'Microaneurismas aislados'),
        ('2 - RD Moderada', (249, 115, 22), 'Hemorragias y exudados moderados'),
        ('3 - RD Severa', (239, 68, 68), 'Hemorragias extensas, IRMA'),
        ('4 - RD Proliferativa', (185, 28, 28), 'Neovascularizacion, alto riesgo'),
    ]

    pdf.set_font('Helvetica', '', 8)
    for label, color, desc in scale_items:
        pdf.set_fill_color(*color)
        pdf.cell(5, 5, '', fill=True)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(35, 5, f'  {label}')
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 5, desc, ln=True)

    # Limpiar archivos temporales
    for tmp in tmp_files:
        try:
            os.unlink(tmp)
        except Exception:
            pass

    return pdf.output()
