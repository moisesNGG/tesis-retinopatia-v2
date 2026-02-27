"""
Servicio de generacion de reportes PDF para analisis de retinopatia.
Usa fpdf2 + matplotlib para generar PDFs profesionales con graficas.
"""

import io
import base64
import tempfile
import os
from datetime import datetime, timezone
from fpdf import FPDF
from PIL import Image

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np


CLASS_LABELS = [
    'No Corresponde a RD',
    'RD Leve',
    'RD Moderada',
    'RD Severa',
    'RD Proliferativa',
]

CLASS_LABELS_SHORT = ['No Corresponde', 'Leve', 'Moderada', 'Severa', 'Proliferativa']

SEVERITY_LABELS = {
    'none': 'No Corresponde a Retinopatia Diabetica',
    'mild': 'Retinopatia Diabetica Leve',
    'moderate': 'Retinopatia Diabetica Moderada',
    'severe': 'Retinopatia Diabetica Severa',
    'proliferative': 'Retinopatia Diabetica Proliferativa',
}

SEVERITY_DESCRIPTIONS = {
    'none': 'No se detectaron signos de retinopatia diabetica en la imagen analizada. '
            'Se recomienda mantener controles oftalmologicos anuales como prevencion.',
    'mild': 'Se detectaron microaneurismas u otros signos leves de retinopatia diabetica. '
            'Se recomienda seguimiento oftalmologico cada 6-12 meses y control estricto de glicemia.',
    'moderate': 'Se detectaron signos moderados como hemorragias retinales, exudados duros o '
                'algodonosos. Consulte con un oftalmologo para evaluacion detallada.',
    'severe': 'Se detectaron signos severos como hemorragias extensas, IRMA o arrosariamiento '
              'venoso. Se requiere atencion oftalmologica urgente.',
    'proliferative': 'Se detecto neovascularizacion u otros signos de retinopatia proliferativa. '
                     'Se requiere atencion oftalmologica inmediata para evaluar tratamiento con '
                     'laser o anti-VEGF.',
}

SEVERITY_COLORS = {
    'none': (34, 197, 94),
    'mild': (234, 179, 8),
    'moderate': (249, 115, 22),
    'severe': (239, 68, 68),
    'proliferative': (185, 28, 28),
}

SEVERITY_BG_COLORS = {
    'none': (220, 252, 231),
    'mild': (254, 249, 195),
    'moderate': (255, 237, 213),
    'severe': (254, 226, 226),
    'proliferative': (254, 202, 202),
}

SEVERITY_COLOR_HEX = {
    'none': '#22C55E', 'mild': '#EAB308', 'moderate': '#F97316',
    'severe': '#EF4444', 'proliferative': '#B91C1C',
}

# Colores para graficas (azul, verde, naranja, rojo, morado)
MODEL_COLORS = ['#1E40AF', '#059669', '#D97706', '#DC2626', '#7C3AED']


# ---------------------------------------------------------------------------
# Utilidad: calcular alto de imagen en mm dado el ancho deseado en mm
# ---------------------------------------------------------------------------
def _image_height_mm(image_path: str, target_width_mm: float) -> float:
    """Retorna la altura en mm que tendra la imagen al renderizarse con target_width_mm."""
    with Image.open(image_path) as img:
        w_px, h_px = img.size
    return target_width_mm * h_px / w_px


# ---------------------------------------------------------------------------
# Generadores de graficas
# ---------------------------------------------------------------------------
def _create_probability_chart(results: list[dict]) -> str:
    fig, ax = plt.subplots(figsize=(7.5, 3.0), dpi=150)

    n_classes = len(CLASS_LABELS_SHORT)
    n_models = len(results)
    bar_width = 0.15
    x = np.arange(n_classes)

    for i, r in enumerate(results):
        probs = r.get('probabilities', [0] * n_classes)
        probs_pct = [p * 100 for p in probs]
        offset = (i - n_models / 2 + 0.5) * bar_width
        ax.bar(x + offset, probs_pct, bar_width,
               label=r.get('model_name', f'Modelo {i+1}'),
               color=MODEL_COLORS[i % len(MODEL_COLORS)],
               alpha=0.85, edgecolor='white', linewidth=0.5)

    ax.set_xlabel('Clase', fontsize=8, fontweight='bold')
    ax.set_ylabel('Probabilidad (%)', fontsize=8, fontweight='bold')
    ax.set_title('Distribucion de Probabilidades por Modelo', fontsize=10, fontweight='bold', pad=10)
    ax.set_xticks(x)
    ax.set_xticklabels(CLASS_LABELS_SHORT, fontsize=7)
    ax.tick_params(axis='y', labelsize=7)
    ax.yaxis.set_major_formatter(mticker.PercentFormatter())
    ax.legend(fontsize=6, loc='upper right', framealpha=0.9)
    ax.set_ylim(0, 105)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

    plt.tight_layout()
    tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
    fig.savefig(tmp.name, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return tmp.name


def _create_confidence_gauge(results: list[dict], consensus_severity: str) -> str:
    fig, axes = plt.subplots(1, len(results), figsize=(7.5, 2.0), dpi=150)
    if len(results) == 1:
        axes = [axes]

    for i, (ax, r) in enumerate(zip(axes, results)):
        conf = r.get('confidence', 0)
        severity = r.get('severity', 'none')
        color = SEVERITY_COLOR_HEX.get(severity, '#6B7280')

        sizes = [conf, 1 - conf]
        colors_donut = [color, '#E5E7EB']
        ax.pie(sizes, colors=colors_donut, startangle=90,
               wedgeprops={'width': 0.3, 'edgecolor': 'white', 'linewidth': 1})

        ax.text(0, 0, f'{conf * 100:.0f}%', ha='center', va='center',
                fontsize=10, fontweight='bold', color=color)

        name = r.get('model_name', f'Modelo {i+1}')
        short_name = name.replace(' + EA', '').replace('EfficientNet-B0', 'EffNet-B0')
        ax.set_title(short_name, fontsize=6, fontweight='bold', pad=2)

    plt.suptitle('Confianza por Modelo', fontsize=9, fontweight='bold', y=1.02)
    plt.tight_layout()
    tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
    fig.savefig(tmp.name, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return tmp.name


def _create_agreement_chart(results: list[dict], consensus_severity: str) -> str:
    from collections import Counter

    fig, ax = plt.subplots(figsize=(4.0, 2.0), dpi=150)

    severities = [r.get('severity', 'none') for r in results if r.get('prediction') != 'Error']
    votes = Counter(severities)

    severity_order = ['none', 'mild', 'moderate', 'severe', 'proliferative']
    labels = []
    counts = []
    colors = []
    label_map = {
        'none': 'No Corresponde', 'mild': 'Leve', 'moderate': 'Moderada',
        'severe': 'Severa', 'proliferative': 'Proliferativa',
    }

    for sev in severity_order:
        if sev in votes:
            labels.append(label_map[sev])
            counts.append(votes[sev])
            edge_color = SEVERITY_COLOR_HEX[sev]
            if sev == consensus_severity:
                colors.append(edge_color)
            else:
                colors.append(edge_color + '60')

    bars = ax.barh(labels, counts, color=colors, edgecolor='white', linewidth=1, height=0.6)

    for bar, count in zip(bars, counts):
        ax.text(bar.get_width() + 0.1, bar.get_y() + bar.get_height() / 2,
                f'{count} {"modelo" if count == 1 else "modelos"}',
                va='center', fontsize=7, fontweight='bold')

    ax.set_xlim(0, max(counts) + 1.5)
    ax.set_title('Votacion del Ensemble', fontsize=9, fontweight='bold', pad=8)
    ax.set_xlabel('Numero de modelos', fontsize=7)
    ax.tick_params(axis='both', labelsize=7)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.xaxis.set_major_locator(mticker.MaxNLocator(integer=True))

    plt.tight_layout()
    tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
    fig.savefig(tmp.name, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return tmp.name


# ---------------------------------------------------------------------------
# Clase PDF
# ---------------------------------------------------------------------------
class RetinopathyReport(FPDF):

    def header(self):
        self.set_fill_color(30, 64, 175)
        self.rect(0, 0, 210, 3, 'F')

        self.set_y(8)
        self.set_font('Helvetica', 'B', 18)
        self.set_text_color(30, 64, 175)
        self.cell(0, 10, 'RETINAIA', align='L')
        self.set_font('Helvetica', '', 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, 'Sistema de Deteccion de Retinopatia Diabetica', align='R')
        self.ln(12)
        self.set_draw_color(30, 64, 175)
        self.set_line_width(0.8)
        self.line(10, self.get_y(), 200, self.get_y())
        self.set_line_width(0.2)
        self.set_draw_color(147, 177, 253)
        self.line(10, self.get_y() + 1, 200, self.get_y() + 1)
        self.ln(6)

    def footer(self):
        self.set_y(-20)
        self.set_draw_color(200, 200, 200)
        self.set_line_width(0.3)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(2)
        self.set_font('Helvetica', 'I', 6)
        self.set_text_color(150, 150, 150)
        self.multi_cell(
            0, 3,
            'AVISO LEGAL: Este reporte es generado automaticamente por un sistema de inteligencia '
            'artificial con fines academicos e informativos. No constituye un diagnostico medico '
            'profesional. Consulte con un oftalmologo calificado para una evaluacion clinica completa.',
            align='C',
        )
        self.set_font('Helvetica', '', 7)
        self.cell(0, 4, f'Pagina {self.page_no()}/{{nb}}', align='C')

    def section_title(self, title: str):
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(30, 64, 175)
        self.cell(0, 8, title, ln=True)
        y = self.get_y()
        self.set_draw_color(200, 215, 255)
        self.set_line_width(0.4)
        self.line(10, y, 80, y)
        self.ln(3)

    def place_image_auto(self, image_path: str, w: float, x: float = 10):
        """Inserta imagen calculando su alto real. Agrega pagina si no cabe."""
        h = _image_height_mm(image_path, w)
        # Margen inferior = 25 mm (footer)
        space_left = 297 - self.get_y() - 25
        if h > space_left:
            self.add_page()
        self.image(image_path, x=x, y=self.get_y(), w=w)
        self.set_y(self.get_y() + h + 2)


# ---------------------------------------------------------------------------
# Generador principal
# ---------------------------------------------------------------------------
def generate_report(
    image_bytes: bytes,
    filename: str,
    results: list[dict],
    consensus: dict,
    is_retinal: bool,
    gradcam_overlay_b64: str | None = None,
) -> bytes:
    pdf = RetinopathyReport()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=False, margin=25)
    pdf.add_page()

    now = datetime.now(timezone.utc)
    timestamp = now.strftime('%d/%m/%Y %H:%M UTC')

    tmp_files = []

    try:
        # =============================================
        # PAGINA 1: Info + Imagenes + Diagnostico
        # =============================================

        # Titulo
        pdf.set_font('Helvetica', 'B', 15)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 8, 'Reporte de Analisis de Retinopatia Diabetica', ln=True)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 5, f'Fecha de analisis: {timestamp}', ln=True)
        pdf.cell(0, 5, f'Archivo analizado: {filename}', ln=True)
        pdf.cell(0, 5, f'Modelos utilizados: {len(results)} (Ensemble de consenso)', ln=True)
        pdf.ln(4)

        # Warning no retinal
        if not is_retinal:
            pdf.set_fill_color(254, 226, 226)
            pdf.set_draw_color(239, 68, 68)
            pdf.set_line_width(0.5)
            y_warn = pdf.get_y()
            pdf.rect(10, y_warn, 190, 16, 'FD')
            pdf.set_xy(14, y_warn + 2)
            pdf.set_text_color(153, 27, 27)
            pdf.set_font('Helvetica', 'B', 10)
            pdf.cell(0, 5, 'ADVERTENCIA: Imagen No Retinal Detectada', ln=True)
            pdf.set_x(14)
            pdf.set_font('Helvetica', '', 8)
            pdf.cell(0, 5, 'La imagen proporcionada no parece corresponder a una retinografia. '
                     'Los resultados pueden no ser confiables.', ln=True)
            pdf.set_y(y_warn + 18)
            pdf.ln(2)

        # Imagenes
        pdf.section_title('Imagenes del Analisis')

        try:
            img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            tmp_orig = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
            img.save(tmp_orig.name, format='JPEG', quality=85)
            tmp_files.append(tmp_orig.name)

            if gradcam_overlay_b64:
                gradcam_bytes = base64.b64decode(gradcam_overlay_b64)
                gradcam_img = Image.open(io.BytesIO(gradcam_bytes)).convert('RGB')
                tmp_gc = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
                gradcam_img.save(tmp_gc.name, format='JPEG', quality=85)
                tmp_files.append(tmp_gc.name)

                # Etiquetas
                pdf.set_font('Helvetica', 'B', 9)
                pdf.set_text_color(60, 60, 60)
                pdf.cell(90, 5, 'Imagen Original', align='C')
                pdf.cell(90, 5, 'Mapa de Activacion (Grad-CAM)', align='C')
                pdf.ln(6)

                img_y = pdf.get_y()
                img_w = 85
                img_h = _image_height_mm(tmp_orig.name, img_w)

                # Marcos
                pdf.set_draw_color(200, 200, 200)
                pdf.set_line_width(0.3)
                pdf.rect(14, img_y - 1, img_w + 2, img_h + 2)
                pdf.rect(109, img_y - 1, img_w + 2, img_h + 2)

                pdf.image(tmp_orig.name, x=15, y=img_y, w=img_w)
                pdf.image(tmp_gc.name, x=110, y=img_y, w=img_w)
                pdf.set_y(img_y + img_h + 4)

                pdf.set_font('Helvetica', 'I', 7)
                pdf.set_text_color(130, 130, 130)
                pdf.cell(0, 4, 'El mapa Grad-CAM resalta las regiones mas relevantes '
                         'para la prediccion (EfficientNet-B0 + EA).', ln=True)
            else:
                pdf.set_font('Helvetica', 'B', 9)
                pdf.set_text_color(60, 60, 60)
                pdf.cell(0, 5, 'Imagen Analizada', align='C', ln=True)
                pdf.ln(2)
                img_y = pdf.get_y()
                img_w = 80
                img_h = _image_height_mm(tmp_orig.name, img_w)
                x_center = (210 - img_w) / 2
                pdf.set_draw_color(200, 200, 200)
                pdf.set_line_width(0.3)
                pdf.rect(x_center - 1, img_y - 1, img_w + 2, img_h + 2)
                pdf.image(tmp_orig.name, x=x_center, y=img_y, w=img_w)
                pdf.set_y(img_y + img_h + 4)
        except Exception as e:
            pdf.set_font('Helvetica', 'I', 9)
            pdf.set_text_color(200, 60, 60)
            pdf.cell(0, 5, f'[No se pudo incluir la imagen: {e}]', ln=True)

        pdf.ln(3)

        # Diagnostico por consenso
        severity = consensus.get('severity', 'none')
        severity_label = SEVERITY_LABELS.get(severity, severity)
        confidence = consensus.get('confidence', 0)
        agreement = consensus.get('agreement_count', 0)
        total = consensus.get('total_models', 5)
        recommendation = consensus.get('recommendation', '')

        # Si no cabe la caja de diagnostico (28mm + titulo), nueva pagina
        if pdf.get_y() + 42 > 272:
            pdf.add_page()

        pdf.section_title('Resultado del Diagnostico')

        bg = SEVERITY_BG_COLORS.get(severity, (240, 240, 240))
        sev_color = SEVERITY_COLORS.get(severity, (100, 100, 100))

        y_diag = pdf.get_y()
        pdf.set_fill_color(*bg)
        pdf.set_draw_color(*sev_color)
        pdf.set_line_width(0.6)
        pdf.rect(10, y_diag, 190, 28, 'FD')

        # Barra lateral
        pdf.set_fill_color(*sev_color)
        pdf.rect(10, y_diag, 4, 28, 'F')

        # Texto
        pdf.set_xy(18, y_diag + 3)
        pdf.set_font('Helvetica', 'B', 13)
        pdf.set_text_color(*sev_color)
        pdf.cell(0, 7, severity_label)

        pdf.set_xy(18, y_diag + 11)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(60, 60, 60)
        pdf.cell(60, 5, f'Confianza: {confidence * 100:.1f}%')
        pdf.cell(60, 5, f'Acuerdo: {agreement}/{total} modelos')
        pdf.cell(0, 5, f'Nivel: {severity.upper()}')

        pdf.set_xy(18, y_diag + 18)
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(80, 80, 80)
        desc = SEVERITY_DESCRIPTIONS.get(severity, recommendation)
        pdf.multi_cell(178, 4, desc)

        pdf.set_y(y_diag + 31)

        # =============================================
        # PAGINA 2: Graficas
        # =============================================
        pdf.add_page()

        # Grafica de confianza (donuts)
        pdf.section_title('Confianza Individual por Modelo')
        try:
            gauge_path = _create_confidence_gauge(results, severity)
            tmp_files.append(gauge_path)
            pdf.place_image_auto(gauge_path, w=190)
        except Exception as e:
            pdf.set_font('Helvetica', 'I', 8)
            pdf.cell(0, 5, f'[Error al generar grafico de confianza: {e}]', ln=True)

        pdf.ln(4)

        # Grafica de probabilidades
        pdf.section_title('Distribucion de Probabilidades')
        try:
            prob_chart_path = _create_probability_chart(results)
            tmp_files.append(prob_chart_path)
            pdf.place_image_auto(prob_chart_path, w=190)
        except Exception as e:
            pdf.set_font('Helvetica', 'I', 8)
            pdf.cell(0, 5, f'[Error al generar grafico de probabilidades: {e}]', ln=True)

        pdf.ln(4)

        # Grafico de votacion
        pdf.section_title('Votacion del Ensemble')
        try:
            vote_chart_path = _create_agreement_chart(results, severity)
            tmp_files.append(vote_chart_path)
            pdf.place_image_auto(vote_chart_path, w=120, x=45)
        except Exception as e:
            pdf.set_font('Helvetica', 'I', 8)
            pdf.cell(0, 5, f'[Error al generar grafico de votacion: {e}]', ln=True)

        # =============================================
        # PAGINA 3: Tabla + Escala + Info tecnica
        # =============================================
        pdf.add_page()

        # Tabla de resultados
        pdf.section_title('Detalle de Resultados por Modelo')

        pdf.set_font('Helvetica', 'B', 8)
        pdf.set_fill_color(30, 64, 175)
        pdf.set_text_color(255, 255, 255)
        col_widths = [42, 42, 22, 22, 22, 22, 18]
        headers = ['Modelo', 'Prediccion', 'Confianza', 'Severidad', 'P(max)', 'Clase', 'Voto']
        for i, h in enumerate(headers):
            pdf.cell(col_widths[i], 7, h, border=0, fill=True, align='C')
        pdf.ln()

        pdf.set_font('Helvetica', '', 7)
        for i, r in enumerate(results):
            fill = i % 2 == 0
            if fill:
                pdf.set_fill_color(245, 247, 255)
            else:
                pdf.set_fill_color(255, 255, 255)

            probs = r.get('probabilities', [])
            max_prob = max(probs) if probs else 0
            max_class = probs.index(max_prob) if probs else 0
            sev = r.get('severity', 'none')
            is_winner = sev == severity

            if is_winner:
                pdf.set_text_color(30, 64, 175)
                pdf.set_font('Helvetica', 'B', 7)
            else:
                pdf.set_text_color(60, 60, 60)
                pdf.set_font('Helvetica', '', 7)

            row = [
                r.get('model_name', ''),
                r.get('prediction', ''),
                f"{r.get('confidence', 0) * 100:.1f}%",
                sev,
                f"{max_prob * 100:.1f}%",
                CLASS_LABELS_SHORT[max_class] if max_class < len(CLASS_LABELS_SHORT) else str(max_class),
                'SI' if is_winner else '-',
            ]
            for j, val in enumerate(row):
                pdf.cell(col_widths[j], 6, val, border=0, fill=fill, align='C')
            pdf.ln()

        # Linea inferior de tabla
        pdf.set_draw_color(30, 64, 175)
        pdf.set_line_width(0.3)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(8)

        # Escala de clasificacion
        pdf.section_title('Escala de Clasificacion')

        scale_items = [
            ('0 - No Corresponde a RD', 'none', 'La imagen no corresponde a una retinografia'),
            ('1 - RD Leve', 'mild', 'Microaneurismas aislados'),
            ('2 - RD Moderada', 'moderate', 'Hemorragias retinales y exudados moderados'),
            ('3 - RD Severa', 'severe', 'Hemorragias extensas, IRMA, arrosariamiento venoso'),
            ('4 - RD Proliferativa', 'proliferative', 'Neovascularizacion, desprendimiento traccional'),
        ]

        for label, sev_key, desc in scale_items:
            color = SEVERITY_COLORS.get(sev_key, (100, 100, 100))
            is_current = sev_key == severity

            y_pos = pdf.get_y() + 2.5
            pdf.set_fill_color(*color)
            pdf.ellipse(12, y_pos - 1.5, 3, 3, 'F')

            pdf.set_x(17)
            if is_current:
                pdf.set_font('Helvetica', 'B', 8)
                pdf.set_text_color(*color)
                pdf.cell(30, 5, label)
                pdf.set_font('Helvetica', 'B', 8)
                pdf.cell(0, 5, f'{desc}  << RESULTADO ACTUAL', ln=True)
            else:
                pdf.set_font('Helvetica', '', 8)
                pdf.set_text_color(60, 60, 60)
                pdf.cell(30, 5, label)
                pdf.set_text_color(120, 120, 120)
                pdf.cell(0, 5, desc, ln=True)

        pdf.ln(8)

        # Informacion tecnica
        pdf.section_title('Informacion Tecnica')
        pdf.set_font('Helvetica', '', 7)
        pdf.set_text_color(100, 100, 100)
        model_names = [r.get('model_name', '') for r in results]
        pdf.cell(0, 4, f'Modelos: {", ".join(model_names)}', ln=True)
        pdf.cell(0, 4, 'Arquitectura: Ensemble de consenso (voto mayoritario '
                 'con confianza ponderada)', ln=True)
        pdf.cell(0, 4, 'Resolucion de entrada: 224x224 px | '
                 'Dataset: RD_FINAL_V50K (50,000 imagenes)', ln=True)
        pdf.cell(0, 4, f'Imagen retinal valida: {"Si" if is_retinal else "No"}', ln=True)

        return bytes(pdf.output())

    finally:
        for tmp in tmp_files:
            try:
                os.unlink(tmp)
            except Exception:
                pass
