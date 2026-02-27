"""
Grad-CAM: Visualizacion de las regiones de interes del modelo EfficientNet-B0+EA.
Genera un heatmap superpuesto sobre la imagen original.
"""

import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image
import io
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.cm as cm


class GradCAM:
    """Grad-CAM para EfficientNet-B0+EA, target layer: extra_conv10."""

    def __init__(self, model, target_layer_name='extra_conv10'):
        self.model = model
        self.gradients = None
        self.activations = None
        self._hooks = []

        # Registrar hooks en la capa objetivo (guardar handles para limpiar despues)
        target_layer = getattr(model, target_layer_name)
        self._hooks.append(target_layer.register_forward_hook(self._save_activation))
        self._hooks.append(target_layer.register_full_backward_hook(self._save_gradient))

    def remove_hooks(self):
        """Elimina los hooks registrados para evitar acumulacion."""
        for hook in self._hooks:
            hook.remove()
        self._hooks.clear()

    def _save_activation(self, module, input, output):
        self.activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate(self, input_tensor, target_class=None):
        """
        Genera el heatmap Grad-CAM.

        Args:
            input_tensor: Tensor [1, 3, 224, 224] preprocesado
            target_class: Clase objetivo (None = clase predicha)

        Returns:
            heatmap: numpy array [H, W] normalizado 0-1
            predicted_class: indice de la clase predicha
        """
        self.model.eval()

        # Forward pass con gradientes habilitados
        input_tensor.requires_grad_(True)
        output = self.model(input_tensor)

        if target_class is None:
            target_class = output.argmax(dim=1).item()

        # Backward pass
        self.model.zero_grad()
        target_score = output[0, target_class]
        target_score.backward()

        # Calcular pesos (global average pooling de gradientes)
        weights = self.gradients.mean(dim=[2, 3], keepdim=True)  # [1, C, 1, 1]

        # Combinacion lineal ponderada de activaciones
        cam = (weights * self.activations).sum(dim=1, keepdim=True)  # [1, 1, H, W]
        cam = F.relu(cam)  # Solo valores positivos

        # Normalizar a [0, 1]
        cam = cam.squeeze().cpu().numpy()
        if cam.max() > 0:
            cam = (cam - cam.min()) / (cam.max() - cam.min())

        return cam, target_class


def generate_heatmap_overlay(
    model,
    input_tensor: torch.Tensor,
    original_image_bytes: bytes,
    target_class: int = None,
    alpha: float = 0.5,
) -> tuple[str, int]:
    """
    Genera un overlay Grad-CAM sobre la imagen original.

    Args:
        model: Modelo EfficientNet-B0+EA
        input_tensor: Tensor preprocesado [1, 3, 224, 224]
        original_image_bytes: Bytes de la imagen original
        target_class: Clase para Grad-CAM (None = predicha)
        alpha: Transparencia del heatmap (0-1)

    Returns:
        overlay_base64: Imagen overlay codificada en base64
        predicted_class: Indice de la clase predicha
    """
    gradcam = GradCAM(model, target_layer_name='extra_conv10')
    try:
        heatmap, predicted_class = gradcam.generate(input_tensor, target_class)
    finally:
        gradcam.remove_hooks()

    # Abrir imagen original y redimensionar
    original = Image.open(io.BytesIO(original_image_bytes)).convert('RGB')
    orig_w, orig_h = original.size

    # Redimensionar heatmap al tamano de la imagen original
    heatmap_resized = np.array(
        Image.fromarray((heatmap * 255).astype(np.uint8)).resize(
            (orig_w, orig_h), Image.BILINEAR
        )
    ) / 255.0

    # Aplicar colormap jet
    colormap = matplotlib.colormaps['jet']
    heatmap_colored = colormap(heatmap_resized)[:, :, :3]  # RGB, sin alpha
    heatmap_colored = (heatmap_colored * 255).astype(np.uint8)

    # Superponer sobre imagen original
    original_np = np.array(original)
    overlay = (original_np * (1 - alpha) + heatmap_colored * alpha).astype(np.uint8)

    # Convertir a base64
    overlay_image = Image.fromarray(overlay)
    buffer = io.BytesIO()
    overlay_image.save(buffer, format='JPEG', quality=90)
    overlay_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return overlay_base64, predicted_class
