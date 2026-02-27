import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image
import io
import os
import gc
import math
import threading
import traceback

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------
CLASS_LABELS = [
    'Sin Retinopatia',
    'Retinopatia Diabetica Leve',
    'Retinopatia Diabetica Moderada',
    'Retinopatia Diabetica Severa',
    'Retinopatia Diabetica Proliferativa',
]

SEVERITY_LEVELS = ['none', 'mild', 'moderate', 'severe', 'proliferative']

NUM_CLASSES = 5

# ---------------------------------------------------------------------------
# External Attention (modulo compartido por todos los modelos)
# ---------------------------------------------------------------------------
class ExternalAttention(nn.Module):
    def __init__(self, dim, num_heads=8, dim_head=64, dropout=0.):
        super().__init__()
        inner_dim = dim_head * num_heads
        self.num_heads = num_heads
        self.scale = dim_head ** -0.5

        self.to_qkv = nn.Linear(dim, inner_dim * 3, bias=False)
        self.to_out = nn.Sequential(
            nn.Linear(inner_dim, dim),
            nn.Dropout(dropout),
        )

        self.mem_k = nn.Parameter(torch.randn(num_heads, dim_head, dim_head))
        self.mem_v = nn.Parameter(torch.randn(num_heads, dim_head, dim_head))

    def forward(self, x):
        b, n, _, h = *x.shape, self.num_heads
        qkv = self.to_qkv(x).chunk(3, dim=-1)
        q, k, v = map(lambda t: t.reshape(b, n, h, -1).transpose(1, 2), qkv)

        attn = torch.einsum('bhnd,hdk->bhnk', q, self.mem_k) * self.scale
        attn = attn.softmax(dim=-1)

        out = torch.einsum('bhnk,hkd->bhnd', attn, self.mem_v)
        out = out.transpose(1, 2).reshape(b, n, -1)

        return self.to_out(out)


# ---------------------------------------------------------------------------
# DenseNet121 + 10 Conv Layers + External Attention
# Canales: 1024->896->768->640->512->448->384->320->256->256->256
# ---------------------------------------------------------------------------
class DenseNet121WithExternalAttention(nn.Module):
    def __init__(self, num_classes=NUM_CLASSES, pretrained=False):
        super().__init__()
        densenet = models.densenet121(weights=None)
        self.features = densenet.features  # output: 1024 channels

        self.extra_conv1 = nn.Sequential(nn.Conv2d(1024, 896, 3, padding=1), nn.BatchNorm2d(896), nn.ReLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv2 = nn.Sequential(nn.Conv2d(896, 768, 3, padding=1), nn.BatchNorm2d(768), nn.ReLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv3 = nn.Sequential(nn.Conv2d(768, 640, 3, padding=1), nn.BatchNorm2d(640), nn.ReLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv4 = nn.Sequential(nn.Conv2d(640, 512, 3, padding=1), nn.BatchNorm2d(512), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv5 = nn.Sequential(nn.Conv2d(512, 448, 3, padding=1), nn.BatchNorm2d(448), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv6 = nn.Sequential(nn.Conv2d(448, 384, 3, padding=1), nn.BatchNorm2d(384), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv7 = nn.Sequential(nn.Conv2d(384, 320, 3, padding=1), nn.BatchNorm2d(320), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv8 = nn.Sequential(nn.Conv2d(320, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv9 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv10 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True))

        self.gap = nn.AdaptiveAvgPool2d((1, 1))
        self.external_attention = ExternalAttention(dim=256, num_heads=8, dim_head=32, dropout=0.1)
        self.classifier = nn.Sequential(nn.Linear(256, 512), nn.ReLU(inplace=True), nn.Dropout(0.5), nn.Linear(512, num_classes))

    def forward(self, x):
        x = self.features(x)
        x = self.extra_conv1(x)
        x = self.extra_conv2(x)
        x = self.extra_conv3(x)
        x = self.extra_conv4(x)
        x = self.extra_conv5(x)
        x = self.extra_conv6(x)
        x = self.extra_conv7(x)
        x = self.extra_conv8(x)
        x = self.extra_conv9(x)
        x = self.extra_conv10(x)
        x = self.gap(x).flatten(1)
        x = x.unsqueeze(1)
        x = self.external_attention(x)
        x = x.squeeze(1)
        return self.classifier(x)


# ---------------------------------------------------------------------------
# EfficientNet-B0 + 10 Conv Layers + External Attention (SiLU activation)
# Canales: 1280->640->448->320->256->256->256->256->256->256->256
# ---------------------------------------------------------------------------
class EfficientNetB0WithExternalAttention(nn.Module):
    def __init__(self, num_classes=NUM_CLASSES, pretrained=False):
        super().__init__()
        efficientnet = models.efficientnet_b0(weights=None)
        self.features = efficientnet.features  # output: 1280 channels

        self.extra_conv1 = nn.Sequential(nn.Conv2d(1280, 640, 3, padding=1), nn.BatchNorm2d(640), nn.SiLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv2 = nn.Sequential(nn.Conv2d(640, 448, 3, padding=1), nn.BatchNorm2d(448), nn.SiLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv3 = nn.Sequential(nn.Conv2d(448, 320, 3, padding=1), nn.BatchNorm2d(320), nn.SiLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv4 = nn.Sequential(nn.Conv2d(320, 256, 3, padding=1), nn.BatchNorm2d(256), nn.SiLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv5 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.SiLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv6 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.SiLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv7 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.SiLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv8 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.SiLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv9 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.SiLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv10 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.SiLU(inplace=True))

        self.gap = nn.AdaptiveAvgPool2d((1, 1))
        self.external_attention = ExternalAttention(dim=256, num_heads=8, dim_head=32, dropout=0.1)
        self.classifier = nn.Sequential(nn.Linear(256, 512), nn.SiLU(inplace=True), nn.Dropout(0.5), nn.Linear(512, num_classes))

    def forward(self, x):
        x = self.features(x)
        x = self.extra_conv1(x)
        x = self.extra_conv2(x)
        x = self.extra_conv3(x)
        x = self.extra_conv4(x)
        x = self.extra_conv5(x)
        x = self.extra_conv6(x)
        x = self.extra_conv7(x)
        x = self.extra_conv8(x)
        x = self.extra_conv9(x)
        x = self.extra_conv10(x)
        x = self.gap(x).flatten(1)
        x = x.unsqueeze(1)
        x = self.external_attention(x)
        x = x.squeeze(1)
        return self.classifier(x)


# ---------------------------------------------------------------------------
# ResNet50 + 10 Conv Layers + External Attention
# Backbone usa atributos directos (conv1, bn1, layer1..4) en vez de nn.Sequential
# Canales: 2048->1024->768->640->512->448->384->320->256->256->256
# ---------------------------------------------------------------------------
class ResNet50WithExternalAttention(nn.Module):
    def __init__(self, num_classes=NUM_CLASSES, pretrained=False):
        super().__init__()
        resnet = models.resnet50(weights=None)
        # Guardar las capas del backbone como atributos directos para que
        # las keys del state_dict coincidan (conv1, bn1, layer1, etc.)
        self.conv1 = resnet.conv1
        self.bn1 = resnet.bn1
        self.relu = resnet.relu
        self.maxpool = resnet.maxpool
        self.layer1 = resnet.layer1
        self.layer2 = resnet.layer2
        self.layer3 = resnet.layer3
        self.layer4 = resnet.layer4

        self.extra_conv1 = nn.Sequential(nn.Conv2d(2048, 1024, 3, padding=1), nn.BatchNorm2d(1024), nn.ReLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv2 = nn.Sequential(nn.Conv2d(1024, 768, 3, padding=1), nn.BatchNorm2d(768), nn.ReLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv3 = nn.Sequential(nn.Conv2d(768, 640, 3, padding=1), nn.BatchNorm2d(640), nn.ReLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv4 = nn.Sequential(nn.Conv2d(640, 512, 3, padding=1), nn.BatchNorm2d(512), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv5 = nn.Sequential(nn.Conv2d(512, 448, 3, padding=1), nn.BatchNorm2d(448), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv6 = nn.Sequential(nn.Conv2d(448, 384, 3, padding=1), nn.BatchNorm2d(384), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv7 = nn.Sequential(nn.Conv2d(384, 320, 3, padding=1), nn.BatchNorm2d(320), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv8 = nn.Sequential(nn.Conv2d(320, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv9 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv10 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True))

        self.gap = nn.AdaptiveAvgPool2d((1, 1))
        self.external_attention = ExternalAttention(dim=256, num_heads=8, dim_head=32, dropout=0.1)
        self.classifier = nn.Sequential(nn.Linear(256, 512), nn.ReLU(inplace=True), nn.Dropout(0.5), nn.Linear(512, num_classes))

    def forward(self, x):
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)
        x = self.extra_conv1(x)
        x = self.extra_conv2(x)
        x = self.extra_conv3(x)
        x = self.extra_conv4(x)
        x = self.extra_conv5(x)
        x = self.extra_conv6(x)
        x = self.extra_conv7(x)
        x = self.extra_conv8(x)
        x = self.extra_conv9(x)
        x = self.extra_conv10(x)
        x = self.gap(x).flatten(1)
        x = x.unsqueeze(1)
        x = self.external_attention(x)
        x = x.squeeze(1)
        return self.classifier(x)


# ---------------------------------------------------------------------------
# ViT-B/16 + 10 Conv Layers + External Attention
# Toma la salida 768-dim del ViT, proyecta espacialmente a un feature map,
# luego pasa por 10 conv layers + EA + classifier
# Canales: 768->640->512->448->384->320->256->256->256->256->256
# ---------------------------------------------------------------------------
class ViTB16WithExternalAttention(nn.Module):
    def __init__(self, num_classes=NUM_CLASSES, pretrained=False):
        super().__init__()
        from torchvision.models import vit_b_16
        vit = vit_b_16(weights=None)
        # Backbone ViT (sin la cabeza de clasificacion)
        self.class_token = vit.class_token
        self.conv_proj = vit.conv_proj
        self.encoder = vit.encoder

        # Proyeccion espacial: Linear(768, 768) para reconstruir feature map
        self.spatial_proj = nn.Sequential(nn.Linear(768, 768))

        # 10 Conv layers: 768 -> ... -> 256
        self.extra_conv1 = nn.Sequential(nn.Conv2d(768, 640, 3, padding=1), nn.BatchNorm2d(640), nn.ReLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv2 = nn.Sequential(nn.Conv2d(640, 512, 3, padding=1), nn.BatchNorm2d(512), nn.ReLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv3 = nn.Sequential(nn.Conv2d(512, 448, 3, padding=1), nn.BatchNorm2d(448), nn.ReLU(inplace=True), nn.Dropout2d(0.3))
        self.extra_conv4 = nn.Sequential(nn.Conv2d(448, 384, 3, padding=1), nn.BatchNorm2d(384), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv5 = nn.Sequential(nn.Conv2d(384, 320, 3, padding=1), nn.BatchNorm2d(320), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv6 = nn.Sequential(nn.Conv2d(320, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv7 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv8 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv9 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True), nn.Dropout2d(0.2))
        self.extra_conv10 = nn.Sequential(nn.Conv2d(256, 256, 3, padding=1), nn.BatchNorm2d(256), nn.ReLU(inplace=True))

        self.gap = nn.AdaptiveAvgPool2d((1, 1))
        self.external_attention = ExternalAttention(dim=256, num_heads=8, dim_head=32, dropout=0.1)
        self.classifier = nn.Sequential(nn.Linear(256, 512), nn.ReLU(inplace=True), nn.Dropout(0.5), nn.Linear(512, num_classes))

    def forward(self, x):
        # ViT backbone (reproduce la logica interna de vit_b_16.forward)
        # 1) Patch embedding via conv_proj
        x = self.conv_proj(x)  # [B, 768, 14, 14]
        b, c, h, w = x.shape
        x = x.flatten(2).transpose(1, 2)  # [B, 196, 768]

        # 2) Prepend class token
        cls_token = self.class_token.expand(b, -1, -1)  # [B, 1, 768]
        x = torch.cat([cls_token, x], dim=1)  # [B, 197, 768]

        # 3) Encoder (positional embedding incluido dentro)
        x = self.encoder(x)  # [B, 197, 768]

        # 4) Tomar solo los patch tokens (excluir CLS) y proyectar
        patch_tokens = x[:, 1:, :]  # [B, 196, 768]
        patch_tokens = self.spatial_proj(patch_tokens)  # [B, 196, 768]

        # 5) Reshape a feature map 2D: [B, 768, 14, 14]
        x = patch_tokens.transpose(1, 2).reshape(b, -1, h, w)

        # 6) Conv layers
        x = self.extra_conv1(x)
        x = self.extra_conv2(x)
        x = self.extra_conv3(x)
        x = self.extra_conv4(x)
        x = self.extra_conv5(x)
        x = self.extra_conv6(x)
        x = self.extra_conv7(x)
        x = self.extra_conv8(x)
        x = self.extra_conv9(x)
        x = self.extra_conv10(x)

        # 7) GAP + EA + Classifier
        x = self.gap(x).flatten(1)
        x = x.unsqueeze(1)
        x = self.external_attention(x)
        x = x.squeeze(1)
        return self.classifier(x)


# ---------------------------------------------------------------------------
# Preprocessing
# ---------------------------------------------------------------------------
_IMAGENET_MEAN = [0.485, 0.456, 0.406]
_IMAGENET_STD = [0.229, 0.224, 0.225]

_inference_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=_IMAGENET_MEAN, std=_IMAGENET_STD),
])


def preprocess_image(image_bytes: bytes) -> torch.Tensor:
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    return _inference_transform(img).unsqueeze(0)  # [1, 3, 224, 224]


# ---------------------------------------------------------------------------
# ModelService singleton
# ---------------------------------------------------------------------------
class ModelService:
    def __init__(self):
        self.models: dict = {}
        self.loaded = False
        self.loading = False
        self.models_loaded_count = 0
        self.device = torch.device('cpu')

    def load_all_models(self, models_dir: str):
        """Carga modelos en un thread de fondo para no bloquear el startup del servidor."""
        self.loading = True
        thread = threading.Thread(target=self._load_models_sync, args=(models_dir,), daemon=True)
        thread.start()

    def _load_models_sync(self, models_dir: str):
        print(f"[ModelService] Cargando modelos en background desde {models_dir} ...")

        model_configs = [
            {
                'name': 'DenseNet121 + EA',
                'class': DenseNet121WithExternalAttention,
                'path': os.path.join(models_dir, 'densenet121_ea', 'best_model.pth'),
                'checkpoint_key': 'model_state_dict',
            },
            {
                'name': 'EfficientNet-B0 + EA',
                'class': EfficientNetB0WithExternalAttention,
                'path': os.path.join(models_dir, 'efficientnet_b0_ea', 'best_model.pth'),
                'checkpoint_key': 'model_state_dict',
            },
            {
                'name': 'ResNet50 + EA',
                'class': ResNet50WithExternalAttention,
                'path': os.path.join(models_dir, 'resnet50_ea', 'best_model.pth'),
                'checkpoint_key': 'model_state_dict',
            },
            {
                'name': 'ViT-B/16 + EA',
                'class': ViTB16WithExternalAttention,
                'path': os.path.join(models_dir, 'vit_b16_ea', 'best_model.pth'),
                'checkpoint_key': 'model_state_dict',
            },
            {
                'name': 'YOLOv8x-cls',
                'path': os.path.join(models_dir, 'yolov8x_cls', 'best.pt'),
                'checkpoint_key': 'yolo',
            },
        ]

        for cfg in model_configs:
            try:
                if not os.path.exists(cfg['path']):
                    print(f"  [WARN] No se encontro {cfg['path']}, saltando {cfg['name']}")
                    continue

                if cfg['checkpoint_key'] == 'yolo':
                    self._load_yolo(cfg)
                else:
                    self._load_pytorch(cfg)

                self.models_loaded_count = len(self.models)
                print(f"  [OK] {cfg['name']} cargado ({self.models_loaded_count}/5)")
                # Liberar memoria entre cargas
                gc.collect()
            except Exception:
                print(f"  [ERROR] Fallo al cargar {cfg['name']}:")
                traceback.print_exc()
                gc.collect()

        self.loaded = len(self.models) > 0
        self.loading = False
        print(f"[ModelService] {len(self.models)} modelos cargados correctamente")

    def _load_pytorch(self, cfg: dict):
        model = cfg['class'](num_classes=NUM_CLASSES, pretrained=False)
        checkpoint = torch.load(cfg['path'], map_location=self.device, weights_only=False)
        state_dict = checkpoint[cfg['checkpoint_key']]

        try:
            model.load_state_dict(state_dict)
        except RuntimeError:
            print(f"  [WARN] load_state_dict fallo para {cfg['name']}, intentando strict=False...")
            result = model.load_state_dict(state_dict, strict=False)
            if result.missing_keys:
                print(f"    Missing keys: {result.missing_keys[:5]}...")
            if result.unexpected_keys:
                print(f"    Unexpected keys: {result.unexpected_keys[:5]}...")

        del checkpoint, state_dict
        gc.collect()
        model.to(self.device)
        model.eval()
        self.models[cfg['name']] = {'model': model, 'type': 'pytorch'}

    def _load_yolo(self, cfg: dict):
        from ultralytics import YOLO
        model = YOLO(cfg['path'])
        self.models[cfg['name']] = {'model': model, 'type': 'yolo'}

    def predict_all(self, image_bytes: bytes) -> list[dict]:
        results = []
        input_tensor = preprocess_image(image_bytes)
        pil_image = Image.open(io.BytesIO(image_bytes)).convert('RGB')

        for name, info in self.models.items():
            try:
                if info['type'] == 'pytorch':
                    result = self._predict_pytorch(info['model'], input_tensor)
                else:
                    result = self._predict_yolo(info['model'], pil_image)

                result['model_name'] = name
                results.append(result)
            except Exception:
                print(f"  [ERROR] Prediccion fallo para {name}:")
                traceback.print_exc()
                results.append({
                    'model_name': name,
                    'prediction': 'Error',
                    'confidence': 0.0,
                    'severity': 'none',
                    'probabilities': [0.0] * NUM_CLASSES,
                })

        return results

    def _predict_pytorch(self, model: nn.Module, input_tensor: torch.Tensor) -> dict:
        with torch.no_grad():
            logits = model(input_tensor.to(self.device))
            probs = F.softmax(logits, dim=1).squeeze(0)
            confidence, class_idx = probs.max(0)

        idx = class_idx.item()
        return {
            'prediction': CLASS_LABELS[idx],
            'confidence': round(confidence.item(), 4),
            'severity': SEVERITY_LEVELS[idx],
            'probabilities': [round(p.item(), 4) for p in probs],
        }

    def _predict_yolo(self, model, pil_image: Image.Image) -> dict:
        results = model.predict(pil_image, imgsz=224, verbose=False)
        probs = results[0].probs

        idx = probs.top1
        confidence = probs.top1conf.item()
        all_probs = probs.data.tolist()

        return {
            'prediction': CLASS_LABELS[idx],
            'confidence': round(confidence, 4),
            'severity': SEVERITY_LEVELS[idx],
            'probabilities': [round(p, 4) for p in all_probs],
        }

    # -------------------------------------------------------------------
    # Deteccion de imagen no-retinal
    # -------------------------------------------------------------------
    def check_retinal_validity(self, results: list[dict]) -> dict:
        """
        Determina si la imagen es una retinografia valida.
        Criterios: max_confidence < 0.45 Y avg_entropy > 1.3 => no retinal.
        """
        valid = [r for r in results if r.get('prediction') != 'Error']
        if not valid:
            return {'is_retinal': False, 'max_confidence': 0.0, 'avg_entropy': 0.0}

        max_confidence = max(r['confidence'] for r in valid)

        entropies = []
        for r in valid:
            probs = r.get('probabilities', [])
            if probs:
                entropy = -sum(p * math.log(p + 1e-10) for p in probs)
                entropies.append(entropy)

        avg_entropy = sum(entropies) / len(entropies) if entropies else 0.0

        is_retinal = not (max_confidence < 0.45 and avg_entropy > 1.3)

        return {
            'is_retinal': is_retinal,
            'max_confidence': round(max_confidence, 4),
            'avg_entropy': round(avg_entropy, 4),
        }

    # -------------------------------------------------------------------
    # Grad-CAM con EfficientNet-B0+EA
    # -------------------------------------------------------------------
    def predict_with_gradcam(self, image_bytes: bytes) -> dict | None:
        """
        Ejecuta Grad-CAM sobre EfficientNet-B0+EA y retorna overlay base64.
        """
        model_name = 'EfficientNet-B0 + EA'
        if model_name not in self.models:
            print(f"[WARN] {model_name} no disponible para Grad-CAM")
            return None

        try:
            from app.services.gradcam_service import generate_heatmap_overlay

            model = self.models[model_name]['model']
            input_tensor = preprocess_image(image_bytes)

            overlay_b64, pred_class = generate_heatmap_overlay(
                model, input_tensor, image_bytes
            )

            return {
                'overlay_base64': overlay_b64,
                'gradcam_model': model_name,
                'gradcam_class': CLASS_LABELS[pred_class],
            }
        except Exception:
            print("[ERROR] Fallo al generar Grad-CAM:")
            traceback.print_exc()
            return None


# Singleton
model_service = ModelService()
