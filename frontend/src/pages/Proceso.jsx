import React, { useState, useRef, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';

import {
  Upload, Image as ImageIcon, AlertCircle, CheckCircle2, Loader2,
  ShieldCheck, Info, Download, RotateCcw, AlertTriangle, Activity, Eye,
  Swords, Crown, TrendingUp, TrendingDown, Minus, Cpu,
} from 'lucide-react';
import { pagesAPI, predictionAPI } from '../services/api';
import Hero from '../components/sections/Hero';
import ContentSection from '../components/sections/ContentSection';

const CLASS_LABELS = [
  'Sin RD',
  'RD Leve',
  'RD Moderada',
  'RD Severa',
  'RD Proliferativa',
];

const CLASS_COLORS = [
  { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50' },
  { bg: 'bg-yellow-500', text: 'text-yellow-700', light: 'bg-yellow-50' },
  { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50' },
  { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' },
  { bg: 'bg-red-700', text: 'text-red-900', light: 'bg-red-100' },
];

const Proceso = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pageData, setPageData] = useState(null);
  const [progressValue, setProgressValue] = useState(0);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [consentChoice, setConsentChoice] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [customResult, setCustomResult] = useState(null);
  const [analyzingCustom, setAnalyzingCustom] = useState(false);
  const [customProgressValue, setCustomProgressValue] = useState(0);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPageData();
  }, []);

  const fetchPageData = async () => {
    try {
      const data = await pagesAPI.getBySlug('proceso');
      setPageData(data);
    } catch (err) {
      console.error('Error cargando datos del CMS:', err);
      setPageData({
        title: 'Proceso de Analisis',
        subtitle: 'Sube una imagen de fondo de ojo para detectar signos de retinopatia diabetica'
      });
    }
  };

  const handleUploadClick = () => {
    if (consentAccepted) {
      fileInputRef.current?.click();
    } else {
      setConsentChoice(null);
      setShowConsentDialog(true);
    }
  };

  const handleConsentAccept = () => {
    setConsentAccepted(true);
    setShowConsentDialog(false);
    setConsentChoice(null);
    setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleConsentReject = () => {
    setShowConsentDialog(false);
    setConsentChoice(null);
    window.location.href = '/';
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Por favor selecciona un archivo de imagen valido');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo es demasiado grande. Tamano maximo: 10MB');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setResult(null);
      setCustomResult(null);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('Por favor selecciona una imagen primero');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);
    setProgressValue(10);

    const progressInterval = setInterval(() => {
      setProgressValue((prev) => (prev < 85 ? prev + 5 : prev));
    }, 800);

    try {
      const data = await predictionAPI.analyze(selectedFile);
      setProgressValue(100);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Error al analizar la imagen. Por favor intenta de nuevo.');
      console.error(err);
    } finally {
      clearInterval(progressInterval);
      setAnalyzing(false);
    }
  };

  const handleAnalyzeCustom = async () => {
    if (!selectedFile) {
      setError('Por favor selecciona una imagen primero');
      return;
    }

    setAnalyzingCustom(true);
    setError(null);
    setCustomResult(null);
    setCustomProgressValue(10);

    const progressInterval = setInterval(() => {
      setCustomProgressValue((prev) => (prev < 85 ? prev + 7 : prev));
    }, 600);

    try {
      const data = await predictionAPI.analyzeCustomModel(selectedFile);
      setCustomProgressValue(100);
      setCustomResult(data);
    } catch (err) {
      setError(err.message || 'Error al analizar con modelo personalizado.');
      console.error(err);
    } finally {
      clearInterval(progressInterval);
      setAnalyzingCustom(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedFile) return;
    setDownloadingPdf(true);
    try {
      const blob = await predictionAPI.downloadReport(selectedFile);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reporte_retinopatia.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Error al generar el reporte PDF. Intenta de nuevo.');
      console.error(err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const resetAnalysis = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setCustomResult(null);
    setError(null);
    setProgressValue(0);
    setCustomProgressValue(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      none: 'bg-green-100 text-green-800',
      mild: 'bg-yellow-100 text-yellow-800',
      moderate: 'bg-orange-100 text-orange-800',
      severe: 'bg-red-100 text-red-800',
      proliferative: 'bg-red-200 text-red-900'
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityLabel = (severity) => {
    const labels = {
      none: 'Sin RD',
      mild: 'Leve',
      moderate: 'Moderada',
      severe: 'Severa',
      proliferative: 'Proliferativa'
    };
    return labels[severity] || severity;
  };

  if (!pageData) {
    return <Layout><div className="container py-12">Cargando...</div></Layout>;
  }

  return (
    <Layout>
      {pageData.heroImage && (
        <Hero
          title={pageData.title}
          subtitle={pageData.subtitle}
          image={pageData.heroImage}
          imageStyle={pageData.heroImageStyle || 'cover'}
          ctaText="Comenzar Analisis"
          ctaLink="#analizar"
        />
      )}

      {pageData.sections && pageData.sections.length > 0 && (
        <div className="bg-gradient-to-b from-white to-gray-50">
          {pageData.sections
            .sort((a, b) => a.order - b.order)
            .map((section, index) => (
              <ContentSection
                key={section._id || index}
                title={section.title}
                content={section.content}
                image={section.image}
                imageStyle={section.imageStyle || 'cover'}
                layout={section.layout || 'horizontal'}
                imagePosition={index % 2 === 0 ? 'right' : 'left'}
              />
            ))}
        </div>
      )}

      <div id="analizar" className="bg-gradient-to-b from-blue-50 to-white py-8">
        <div className="container max-w-5xl mx-auto">
          {!pageData.heroImage && (
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-3">
                {pageData.title}
              </h1>
              <p className="text-lg text-gray-600">
                {pageData.subtitle}
              </p>
            </div>
          )}

          {/* Upload Area */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle>Subir Imagen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>
                    Imagen de fondo de ojo en JPG o PNG (max 10MB). Sera analizada por 5 modelos de IA simultaneamente.
                  </p>
                </div>

                {!preview ? (
                  <div
                    onClick={handleUploadClick}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-blue-500 transition-colors cursor-pointer"
                  >
                    <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p className="text-gray-600 mb-1">
                      Haz clic para seleccionar una imagen
                    </p>
                    <p className="text-sm text-gray-500">
                      o arrastra y suelta aqui
                    </p>
                    {consentAccepted && (
                      <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Terminos y condiciones aceptados
                      </p>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-auto max-h-96 object-contain mx-auto"
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-3">
                        <Button
                          onClick={handleAnalyze}
                          disabled={analyzing || analyzingCustom}
                          className="flex-1"
                          size="lg"
                        >
                          {analyzing ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Analizando...
                            </>
                          ) : (
                            <>
                              <ImageIcon className="mr-2 h-4 w-4" />
                              Analizar Imagen
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={resetAnalysis}
                          variant="outline"
                          disabled={analyzing || analyzingCustom}
                          size="lg"
                        >
                          Cambiar Imagen
                        </Button>
                      </div>
                      <Button
                        onClick={handleAnalyzeCustom}
                        disabled={analyzing || analyzingCustom}
                        variant="outline"
                        size="lg"
                        className="w-full border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                      >
                        {analyzingCustom ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analizando con modelo personalizado...
                          </>
                        ) : (
                          <>
                            <Cpu className="mr-2 h-4 w-4" />
                            Analisis con Modelo Personalizado
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Progress */}
          {analyzing && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 text-center font-medium">
                    Analizando imagen con 5 modelos de IA...
                  </p>
                  <Progress value={progressValue} className="w-full" />
                  <p className="text-xs text-gray-400 text-center">
                    Este proceso puede tardar 15-30 segundos (incluye generacion de mapa de calor)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress: Modelo Personalizado */}
          {analyzingCustom && (
            <Card className="mb-6 border-indigo-200">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <p className="text-sm text-indigo-700 text-center font-medium">
                    Analizando imagen con EfficientNet-B0 + EA...
                  </p>
                  <Progress value={customProgressValue} className="w-full" />
                  <p className="text-xs text-gray-400 text-center">
                    Modelo personalizado con Grad-CAM (10-20 segundos)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Resultados: Modelo Personalizado */}
          {customResult && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="h-5 w-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-indigo-900">Resultado del Modelo Personalizado</h2>
              </div>

              {/* Warning: No es retinografia */}
              {!customResult.is_retinal && (
                <Alert variant="destructive" className="border-2">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertDescription className="text-sm">
                    <strong>Esta imagen no parece ser una retinografia valida.</strong>
                    <br />
                    El modelo detecto baja confianza ({(customResult.confidence * 100).toFixed(1)}%).
                    Los resultados pueden no ser confiables.
                  </AlertDescription>
                </Alert>
              )}

              {/* Grid 2x2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Panel 1: Imagen original */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Imagen Original
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={preview}
                        alt="Imagen original"
                        className="w-full h-auto max-h-64 object-contain mx-auto"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Panel 2: Grad-CAM */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Mapa de Calor (Grad-CAM)
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {customResult.model_name}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg overflow-hidden bg-gray-100">
                      {customResult.gradcam_overlay ? (
                        <img
                          src={`data:image/jpeg;base64,${customResult.gradcam_overlay}`}
                          alt="Grad-CAM heatmap"
                          className="w-full h-auto max-h-64 object-contain mx-auto"
                        />
                      ) : (
                        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                          Mapa de calor no disponible
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">
                      Las zonas rojas/amarillas indican las regiones que mas influyeron en la prediccion.
                    </p>
                  </CardContent>
                </Card>

                {/* Panel 3: Barras de probabilidad por clase */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Probabilidades por Clase
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {CLASS_LABELS.map((label, i) => {
                        const prob = customResult.probabilities?.[i] || 0;
                        const pct = (prob * 100).toFixed(1);
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-24 text-right flex-shrink-0">
                              {label}
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${CLASS_COLORS[i].bg}`}
                                style={{ width: `${Math.max(prob * 100, 0.5)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-12 text-right font-mono">
                              {pct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2">Modelo unico: {customResult.model_name}</p>
                  </CardContent>
                </Card>

                {/* Panel 4: Diagnostico */}
                <Card className="border-2 border-indigo-200">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Diagnostico Individual</CardTitle>
                      <Cpu className="h-5 w-5 text-indigo-600" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Badge className={`text-base py-1.5 px-4 ${getSeverityColor(customResult.severity)}`}>
                      {customResult.prediction}
                    </Badge>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-500 text-xs">Confianza</p>
                      <p className="font-bold text-gray-900">
                        {(customResult.confidence * 100).toFixed(1)}%
                      </p>
                    </div>

                    {/* Info de preprocesamiento */}
                    <div className="bg-indigo-50 rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-indigo-800">Preprocesamiento</p>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-indigo-700">
                        <span>Entrada: {customResult.preprocessing?.input_size}</span>
                        <span>Color: {customResult.preprocessing?.color_space}</span>
                        <span>Normalizacion: {customResult.preprocessing?.normalization}</span>
                      </div>
                    </div>

                    {/* Info de arquitectura */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Arquitectura</p>
                      <p className="text-[11px] text-gray-600">{customResult.architecture}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Disclaimer */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-900">
                <strong>Importante:</strong> Este resultado proviene de un unico modelo de IA
                y tiene fines academicos. No sustituye el diagnostico de un profesional medico.
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-5">
              {/* Warning: No es retinografia */}
              {!result.is_retinal && (
                <Alert variant="destructive" className="border-2">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertDescription className="text-sm">
                    <strong>Esta imagen no parece ser una retinografia valida.</strong>
                    <br />
                    El sistema detecto baja confianza en todos los modelos (max: {(result.retinal_validation?.max_confidence * 100 || 0).toFixed(1)}%)
                    y alta entropia promedio ({result.retinal_validation?.avg_entropy?.toFixed(2) || '0'}).
                    Los resultados pueden no ser confiables. Utilice una imagen de fondo de ojo.
                  </AlertDescription>
                </Alert>
              )}

              {/* Grid 2x2: Imagen original + Grad-CAM + Barras + Diagnostico */}
              {result.is_retinal && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Panel 1: Imagen original */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Imagen Original
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={preview}
                          alt="Imagen original"
                          className="w-full h-auto max-h-64 object-contain mx-auto"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Panel 2: Grad-CAM */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Mapa de Calor (Grad-CAM)
                        {result.gradcam_model && (
                          <Badge variant="outline" className="text-[10px] ml-auto">
                            {result.gradcam_model}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg overflow-hidden bg-gray-100">
                        {result.gradcam_overlay ? (
                          <img
                            src={`data:image/jpeg;base64,${result.gradcam_overlay}`}
                            alt="Grad-CAM heatmap"
                            className="w-full h-auto max-h-64 object-contain mx-auto"
                          />
                        ) : (
                          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                            Mapa de calor no disponible
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-2">
                        Las zonas rojas/amarillas indican las regiones que mas influyeron en la prediccion del modelo.
                      </p>
                    </CardContent>
                  </Card>

                  {/* Panel 3: Barras de probabilidades (consenso) */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Probabilidades por Clase
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {CLASS_LABELS.map((label, i) => {
                          // Promediar probabilidades de todos los modelos para esta clase
                          const avgProb = result.results.reduce(
                            (sum, r) => sum + (r.probabilities?.[i] || 0), 0
                          ) / result.results.length;
                          const pct = (avgProb * 100).toFixed(1);
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 w-24 text-right flex-shrink-0">
                                {label}
                              </span>
                              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${CLASS_COLORS[i].bg}`}
                                  style={{ width: `${Math.max(avgProb * 100, 0.5)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 w-12 text-right font-mono">
                                {pct}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2">Promedio de los 5 modelos</p>
                    </CardContent>
                  </Card>

                  {/* Panel 4: Diagnostico */}
                  <Card className="border-2 border-blue-200">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Diagnostico por Consenso</CardTitle>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Badge className={`text-base py-1.5 px-4 ${getSeverityColor(result.consensus.severity)}`}>
                        {result.consensus.prediction}
                      </Badge>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-gray-500 text-xs">Confianza</p>
                          <p className="font-bold text-gray-900">
                            {(result.consensus.confidence * 100).toFixed(1)}%
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-2">
                          <p className="text-gray-500 text-xs">Acuerdo</p>
                          <p className="font-bold text-gray-900">
                            {result.consensus.agreement_count}/{result.consensus.total_models} modelos
                          </p>
                        </div>
                      </div>
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {result.consensus.recommendation}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Si no es retinal, mostrar solo consenso simple */}
              {!result.is_retinal && (
                <Card className="border border-gray-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Resultado (no confiable)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Badge className={`text-base py-1.5 px-4 ${getSeverityColor(result.consensus.severity)}`}>
                      {result.consensus.prediction}
                    </Badge>
                    <p className="text-sm text-gray-600">
                      Confianza: {(result.consensus.confidence * 100).toFixed(1)}% |
                      Acuerdo: {result.consensus.agreement_count}/{result.consensus.total_models} modelos
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* === VERSUS: EfficientNet-B0 vs Todos === */}
              {result.is_retinal && (() => {
                const PRIMARY_MODEL = 'EfficientNet-B0 + EA';
                const primary = result.results.find(r => r.model_name === PRIMARY_MODEL);
                const others = result.results.filter(r => r.model_name !== PRIMARY_MODEL && r.prediction !== 'Error');

                if (!primary || others.length === 0) return null;

                const getDiffIcon = (diff) => {
                  if (diff > 5) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
                  if (diff < -5) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
                  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
                };

                const getDiffColor = (diff) => {
                  if (diff > 5) return 'text-green-600';
                  if (diff < -5) return 'text-red-600';
                  return 'text-gray-500';
                };

                return (
                  <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 via-white to-indigo-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Swords className="h-5 w-5 text-blue-600" />
                        EfficientNet-B0 + EA vs Todos los Modelos
                      </CardTitle>
                      <p className="text-xs text-gray-500">
                        Comparacion de confianza del modelo principal contra cada modelo del ensemble
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Modelo principal destacado */}
                      <div className="bg-blue-600 text-white rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Crown className="h-5 w-5 text-yellow-300" />
                            <div>
                              <p className="font-bold text-sm">{primary.model_name}</p>
                              <p className="text-blue-200 text-xs">Modelo principal del sistema</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">{(primary.confidence * 100).toFixed(1)}%</p>
                            <Badge className={`text-[10px] ${
                              primary.severity === 'none' ? 'bg-green-500' :
                              primary.severity === 'mild' ? 'bg-yellow-500' :
                              primary.severity === 'moderate' ? 'bg-orange-500' :
                              primary.severity === 'severe' ? 'bg-red-500' :
                              'bg-red-700'
                            } text-white border-0`}>
                              {primary.prediction}
                            </Badge>
                          </div>
                        </div>
                        {/* Barras de probabilidad del principal */}
                        <div className="mt-3 space-y-1">
                          {primary.probabilities && primary.probabilities.map((prob, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[10px] text-blue-200 w-20 text-right flex-shrink-0">
                                {CLASS_LABELS[i]}
                              </span>
                              <div className="flex-1 bg-blue-500/40 rounded-full h-2 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-white/80 transition-all"
                                  style={{ width: `${Math.max(prob * 100, 0.5)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-blue-100 w-10 text-right font-mono">
                                {(prob * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Comparaciones individuales */}
                      <div className="space-y-3">
                        {others.map((other) => {
                          const diff = ((primary.confidence - other.confidence) * 100);
                          const sameResult = primary.severity === other.severity;

                          return (
                            <div key={other.model_name} className="border rounded-xl p-3 bg-white hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${sameResult ? 'bg-green-500' : 'bg-red-500'}`} />
                                  <span className="font-semibold text-sm text-gray-800">{other.model_name}</span>
                                  {sameResult && (
                                    <Badge variant="outline" className="text-[9px] border-green-300 text-green-700 bg-green-50">
                                      Coincide
                                    </Badge>
                                  )}
                                  {!sameResult && (
                                    <Badge variant="outline" className="text-[9px] border-red-300 text-red-700 bg-red-50">
                                      Difiere
                                    </Badge>
                                  )}
                                </div>
                                <Badge className={`text-[10px] ${getSeverityColor(other.severity)}`}>
                                  {getSeverityLabel(other.severity)}
                                </Badge>
                              </div>

                              {/* Barra comparativa */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-blue-600 font-semibold w-16 flex-shrink-0">EffNet-B0</span>
                                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-blue-500 transition-all"
                                      style={{ width: `${primary.confidence * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono text-blue-700 w-12 text-right">
                                    {(primary.confidence * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-500 w-16 flex-shrink-0 truncate" title={other.model_name}>
                                    {other.model_name.replace(' + EA', '').replace('EfficientNet-B0', 'EffNet')}
                                  </span>
                                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-gray-400 transition-all"
                                      style={{ width: `${other.confidence * 100}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-mono text-gray-600 w-12 text-right">
                                    {(other.confidence * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>

                              {/* Diferencia */}
                              <div className="flex items-center justify-end gap-1 mt-1.5">
                                {getDiffIcon(diff)}
                                <span className={`text-[11px] font-semibold ${getDiffColor(diff)}`}>
                                  {diff > 0 ? '+' : ''}{diff.toFixed(1)}% vs {other.model_name.replace(' + EA', '')}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Resumen del versus */}
                      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                        <div className="flex items-center gap-4 flex-wrap">
                          <span>
                            <strong className="text-gray-900">Coincidencias:</strong>{' '}
                            {others.filter(o => o.severity === primary.severity).length}/{others.length} modelos
                          </span>
                          <span>
                            <strong className="text-gray-900">Confianza promedio resto:</strong>{' '}
                            {(others.reduce((s, o) => s + o.confidence, 0) / others.length * 100).toFixed(1)}%
                          </span>
                          <span>
                            <strong className="text-gray-900">Ventaja promedio:</strong>{' '}
                            <span className={getDiffColor((primary.confidence - others.reduce((s, o) => s + o.confidence, 0) / others.length) * 100)}>
                              {((primary.confidence - others.reduce((s, o) => s + o.confidence, 0) / others.length) * 100) > 0 ? '+' : ''}
                              {((primary.confidence - others.reduce((s, o) => s + o.confidence, 0) / others.length) * 100).toFixed(1)}%
                            </span>
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Detalle por modelo */}
              <Card className="border-2 border-indigo-200 bg-indigo-50/30">
                <Accordion type="single" collapsible>
                  <AccordionItem value="model-details" className="border-none">
                    <AccordionTrigger className="px-5 py-4 hover:no-underline">
                      <div className="text-left">
                        <p className="text-base font-bold text-indigo-900">
                          Resultados Detallados por Modelo
                        </p>
                        <p className="text-xs text-indigo-600 font-normal">
                          Ver prediccion individual de cada uno de los {result.results.length} modelos
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {result.results.map((r) => (
                          <Card key={r.model_name} className="overflow-hidden bg-white">
                            <CardHeader className="pb-2 pt-4 px-4">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm text-gray-900">{r.model_name}</span>
                                <Badge className={`text-xs ${getSeverityColor(r.severity)}`}>
                                  {getSeverityLabel(r.severity)}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Confianza: {(r.confidence * 100).toFixed(1)}%
                              </p>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 pt-1">
                              <div className="space-y-1.5">
                                {r.probabilities && r.probabilities.map((prob, i) => {
                                  const pct = (prob * 100).toFixed(1);
                                  return (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="text-[11px] text-gray-500 w-20 text-right flex-shrink-0 truncate">
                                        {CLASS_LABELS[i]}
                                      </span>
                                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${CLASS_COLORS[i].bg}`}
                                          style={{ width: `${Math.max(prob * 100, 0.5)}%` }}
                                        />
                                      </div>
                                      <span className="text-[11px] text-gray-600 w-11 text-right flex-shrink-0 font-mono">
                                        {pct}%
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>

              {/* Disclaimer */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-900">
                <strong>Importante:</strong> Estos resultados son generados por
                sistemas de IA y tienen fines academicos. No sustituyen el diagnostico
                de un profesional medico. Consulta con un oftalmologo para una
                evaluacion completa.
              </div>

              {/* Botones de accion */}
              <div className="flex gap-3">
                <Button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="flex-1"
                  variant="default"
                >
                  {downloadingPdf ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando PDF...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar Reporte PDF
                    </>
                  )}
                </Button>
                <Button onClick={resetAnalysis} variant="outline" className="flex-1">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Analizar Nueva Imagen
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog de Consentimiento */}
      <Dialog open={showConsentDialog} onOpenChange={(open) => {
        if (!open) setShowConsentDialog(false);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
              Terminos y Condiciones de Uso
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 pr-2">
            <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 text-base">
                  1. Finalidad y alcance del sistema
                </h3>
                <p>
                  RETINAIA es una plataforma de investigacion en inteligencia artificial aplicada al analisis de imagenes medicas. Su proposito es evaluar el desempeno de modelos de aprendizaje profundo en la clasificacion multietapa de retinopatia diabetica dentro de un entorno experimental. Se trata de una herramienta metodologica para validacion tecnica y analisis comparativo de algoritmos. No es un producto sanitario certificado ni esta habilitada para uso clinico. Su utilizacion se limita a contextos academicos y de investigacion.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2 text-base">
                  2. Privacidad, tratamiento y uso de imagenes
                </h3>
                <p>
                  Las imagenes cargadas se procesan unicamente durante la sesion activa para generar un resultado inmediato. No se almacenan de forma permanente ni se integran en bases de datos. El tratamiento se realiza bajo principios de confidencialidad, minimizacion de datos y uso restringido al proposito declarado. El usuario declara contar con autorizacion para utilizar las imagenes proporcionadas. La plataforma respeta estandares eticos aplicables a la investigacion con datos medicos.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2 text-base">
                  3. Advertencias y limitaciones de responsabilidad
                </h3>
                <p>
                  Los resultados corresponden a estimaciones algoritmicas sujetas a posibles margenes de error. No constituyen diagnostico medico ni reemplazan la evaluacion de un profesional de la salud. La plataforma no emite recomendaciones clinicas ni debe utilizarse para la toma de decisiones medicas. El usuario reconoce el caracter experimental del sistema y sus limitaciones tecnicas. El uso de la herramienta implica la aceptacion de estas condiciones.
                </p>
              </div>
            </div>

            <div className="border-t mt-6 pt-4 space-y-3">
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  consentChoice === 'accept'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setConsentChoice('accept')}
              >
                <div className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  consentChoice === 'accept'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {consentChoice === 'accept' && (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  )}
                </div>
                <span className="text-sm text-gray-700">
                  Acepto todos los terminos y condiciones descritos anteriormente
                </span>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  consentChoice === 'reject'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setConsentChoice('reject')}
              >
                <div className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  consentChoice === 'reject'
                    ? 'border-red-500 bg-red-500'
                    : 'border-gray-300'
                }`}>
                  {consentChoice === 'reject' && (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  )}
                </div>
                <span className="text-sm text-gray-700">
                  No acepto los terminos y deseo abandonar la plataforma
                </span>
              </label>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 border-t pt-4">
            <Button
              onClick={consentChoice === 'accept' ? handleConsentAccept : handleConsentReject}
              disabled={!consentChoice}
              className={`w-full ${
                consentChoice === 'accept'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : consentChoice === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : ''
              }`}
            >
              {consentChoice === 'accept'
                ? 'Continuar'
                : consentChoice === 'reject'
                ? 'Abandonar plataforma'
                : 'Selecciona una opcion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Proceso;
