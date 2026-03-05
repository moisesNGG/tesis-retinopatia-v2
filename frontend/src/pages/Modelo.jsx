import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import Hero from '../components/sections/Hero';
import ContentSection from '../components/sections/ContentSection';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Brain, Layers, Grid3X3, Sparkles, Eye, Zap, Network, ScanSearch, Cpu,
  TrendingUp, Target, GitCompareArrows, BarChart3, LineChart as LineChartIcon,
} from 'lucide-react';
import { pagesAPI, modelsAPI } from '../services/api';
import TrainingCurves from '../components/charts/TrainingCurves';
import ConfusionMatrix from '../components/charts/ConfusionMatrix';
import MetricsRadar from '../components/charts/MetricsRadar';
import ModelComparisonBar from '../components/charts/ModelComparisonBar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, LineChart, Line,
} from 'recharts';

const MODEL_ICONS = {
  densenet121_ea: Layers,
  efficientnet_b0_ea: Zap,
  resnet50_ea: Network,
  vit_b16_ea: Eye,
  yolov8x_cls: ScanSearch,
};

const MODEL_COLORS_GRADIENT = {
  densenet121_ea: 'from-emerald-500 to-emerald-600',
  efficientnet_b0_ea: 'from-blue-500 to-blue-600',
  resnet50_ea: 'from-violet-500 to-violet-600',
  vit_b16_ea: 'from-amber-500 to-amber-600',
  yolov8x_cls: 'from-rose-500 to-rose-600',
};

const MODEL_STROKE_COLORS = {
  densenet121_ea: '#10b981',
  efficientnet_b0_ea: '#3b82f6',
  resnet50_ea: '#8b5cf6',
  vit_b16_ea: '#f59e0b',
  yolov8x_cls: '#f43f5e',
};

const COMPARE_METRICS = [
  { key: 'accuracy', label: 'Accuracy', isDirect: true },
  { key: 'f1_macro', label: 'F1 Macro' },
  { key: 'auc_macro', label: 'AUC Macro' },
  { key: 'precision_macro', label: 'Precision' },
  { key: 'recall_macro', label: 'Recall' },
  { key: 'specificity_macro', label: 'Especificidad' },
];

const Modelo = () => {
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metricsData, setMetricsData] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  // Explorar modelo individual
  const [selectedModel, setSelectedModel] = useState('');
  // Versus
  const [vsModelA, setVsModelA] = useState('');
  const [vsModelB, setVsModelB] = useState('__all__');
  const [vsMetric, setVsMetric] = useState('accuracy');

  useEffect(() => {
    fetchPageData();
    fetchMetrics();
  }, []);

  const fetchPageData = async () => {
    try {
      setLoading(true);
      const data = await pagesAPI.getBySlug('modelo');
      setPageData(data);
    } catch (err) {
      console.error(err);
      setPageData({
        title: 'Conoce Nuestros Modelos',
        subtitle: 'Metricas de entrenamiento y rendimiento de los 5 modelos de IA',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      setMetricsLoading(true);
      const data = await modelsAPI.getAllMetrics();
      setMetricsData(data);
      const keys = Object.keys(data);
      if (keys.length > 0) {
        setSelectedModel(keys[0]);
        setVsModelA(keys[0]);
      }
    } catch (err) {
      console.error('Error cargando metricas:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const summaryMetrics = [
    { icon: Brain, label: '5 Modelos', value: 'Ensemble', description: 'Ensemble de 5 arquitecturas de deep learning' },
    { icon: Grid3X3, label: '5 Clases', value: 'Multiclase', description: 'Clasificacion en 5 niveles de severidad' },
    { icon: Cpu, label: 'Entrada', value: '224x224', description: 'Resolucion de entrada de las imagenes' },
    { icon: Sparkles, label: 'Atencion', value: 'External', description: 'Mecanismo de atencion en 4 modelos' },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="container py-12 space-y-8">
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  const modelKeys = metricsData ? Object.keys(metricsData) : [];
  const currentModel = metricsData && selectedModel ? metricsData[selectedModel] : null;

  // Datos para el versus
  const buildVsData = () => {
    if (!metricsData || !vsModelA) return [];
    const metricConf = COMPARE_METRICS.find(m => m.key === vsMetric);
    if (vsModelB === '__all__') {
      return modelKeys.map(key => {
        const m = metricsData[key];
        const val = metricConf?.isDirect ? m.metrics[vsMetric] : m.metrics[vsMetric] * 100;
        return {
          name: m.display_name.replace(' + EA', '+EA'),
          value: parseFloat(val.toFixed(2)),
          fill: MODEL_STROKE_COLORS[key],
        };
      });
    } else {
      const a = metricsData[vsModelA];
      const b = metricsData[vsModelB];
      if (!a || !b) return [];
      return COMPARE_METRICS.map(mc => {
        const valA = mc.isDirect ? a.metrics[mc.key] : a.metrics[mc.key] * 100;
        const valB = mc.isDirect ? b.metrics[mc.key] : b.metrics[mc.key] * 100;
        return {
          metric: mc.label,
          [a.display_name]: parseFloat(valA.toFixed(2)),
          [b.display_name]: parseFloat(valB.toFixed(2)),
        };
      });
    }
  };

  // Curvas de entrenamiento superpuestas para versus
  const buildVsTrainingData = () => {
    if (!metricsData) return [];
    const keysToCompare = vsModelB === '__all__'
      ? modelKeys.filter(k => metricsData[k].training_history)
      : [vsModelA, vsModelB].filter(k => metricsData[k]?.training_history);

    if (keysToCompare.length === 0) return [];

    const maxEpochs = Math.max(...keysToCompare.map(k => metricsData[k].training_history?.val_accuracy?.length || 0));
    const data = [];
    for (let i = 0; i < maxEpochs; i++) {
      const point = { epoch: i + 1 };
      keysToCompare.forEach(k => {
        const h = metricsData[k].training_history;
        if (h && h.val_accuracy && i < h.val_accuracy.length) {
          point[metricsData[k].display_name] = h.val_accuracy[i];
        }
      });
      data.push(point);
    }
    return { data, keys: keysToCompare };
  };

  return (
    <Layout>
      <Hero
        title={pageData.title}
        subtitle={pageData.subtitle}
        image={pageData.heroImage}
        imageStyle={pageData.heroImageStyle || 'cover'}
        ctaText="Probar el Modelo"
        ctaLink="/proceso"
      />

      {/* Caracteristicas del sistema */}
      <section className="py-12 bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Caracteristicas del Sistema
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryMetrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <Card key={index} className="text-center shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="mx-auto w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-2">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-blue-600">
                      {metric.value}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="font-semibold text-gray-900 text-sm mb-1">{metric.label}</p>
                    <p className="text-xs text-gray-600">{metric.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tabla comparativa */}
      {metricsData && (
        <section className="py-12 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-3">
              Comparativa de Rendimiento
            </h2>
            <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto text-sm">
              Metricas de evaluacion de cada modelo sobre el conjunto de validacion (50,000 imagenes).
            </p>
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Modelo</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700">Accuracy</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700">F1</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700">AUC</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700">Precision</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700">Recall</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-700">Epocas</th>
                  </tr>
                </thead>
                <tbody>
                  {modelKeys.map((key) => {
                    const m = metricsData[key];
                    const Icon = MODEL_ICONS[key] || Brain;
                    const color = MODEL_COLORS_GRADIENT[key] || 'from-gray-500 to-gray-600';
                    const isTop = m.metrics.accuracy === Math.max(...modelKeys.map(k => metricsData[k].metrics.accuracy));
                    return (
                      <tr key={key} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 bg-gradient-to-br ${color} rounded flex items-center justify-center flex-shrink-0`}>
                              <Icon className="h-3 w-3 text-white" />
                            </div>
                            <span className="font-medium text-gray-900 text-xs sm:text-sm">{m.display_name}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-2 font-mono font-semibold text-xs sm:text-sm">{m.metrics.accuracy.toFixed(2)}%</td>
                        <td className="text-center py-3 px-2 font-mono text-xs sm:text-sm">{(m.metrics.f1_macro * 100).toFixed(2)}%</td>
                        <td className="text-center py-3 px-2 font-mono text-xs sm:text-sm">{(m.metrics.auc_macro * 100).toFixed(2)}%</td>
                        <td className="text-center py-3 px-2 font-mono text-xs sm:text-sm">{(m.metrics.precision_macro * 100).toFixed(2)}%</td>
                        <td className="text-center py-3 px-2 font-mono text-xs sm:text-sm">{(m.metrics.recall_macro * 100).toFixed(2)}%</td>
                        <td className="text-center py-3 px-2 font-mono text-gray-600 text-xs sm:text-sm">{m.best_results.best_epoch || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {metricsLoading && !metricsData && (
        <section className="py-12 bg-white">
          <div className="max-w-6xl mx-auto px-4 space-y-4">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-48 w-full" />
          </div>
        </section>
      )}

      {/* === SECCION PRINCIPAL: Tabs con Explorar Modelo / Versus === */}
      {metricsData && (
        <section className="py-12 bg-gradient-to-br from-gray-50 to-blue-50/30">
          <div className="max-w-6xl mx-auto px-4">
            <Tabs defaultValue="explorar" className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Analisis de Modelos
                </h2>
                <TabsList className="self-start">
                  <TabsTrigger value="explorar" className="gap-1.5">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Explorar Modelo
                  </TabsTrigger>
                  <TabsTrigger value="versus" className="gap-1.5">
                    <GitCompareArrows className="h-3.5 w-3.5" />
                    Versus
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ====== TAB: EXPLORAR MODELO ====== */}
              <TabsContent value="explorar">
                {/* Selector de modelo */}
                <div className="mb-6">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Selecciona un modelo</label>
                  <div className="flex flex-wrap gap-2">
                    {modelKeys.map((key) => {
                      const m = metricsData[key];
                      const Icon = MODEL_ICONS[key] || Brain;
                      const isActive = selectedModel === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedModel(key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                            isActive
                              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {m.display_name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Contenido del modelo seleccionado */}
                {currentModel && (
                  <div className="space-y-6">
                    {/* Metricas clave */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          {(() => { const Icon = MODEL_ICONS[selectedModel] || Brain; const color = MODEL_COLORS_GRADIENT[selectedModel]; return (
                            <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                          ); })()}
                          <div>
                            <CardTitle className="text-lg">{currentModel.display_name}</CardTitle>
                            <p className="text-xs text-gray-500">{currentModel.architecture}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                          {[
                            { label: 'Accuracy', value: `${currentModel.metrics.accuracy.toFixed(2)}%` },
                            { label: 'F1 Macro', value: `${(currentModel.metrics.f1_macro * 100).toFixed(2)}%` },
                            { label: 'AUC Macro', value: `${(currentModel.metrics.auc_macro * 100).toFixed(2)}%` },
                            { label: 'Precision', value: `${(currentModel.metrics.precision_macro * 100).toFixed(2)}%` },
                            { label: 'Recall', value: `${(currentModel.metrics.recall_macro * 100).toFixed(2)}%` },
                            { label: 'Especif.', value: `${(currentModel.metrics.specificity_macro * 100).toFixed(2)}%` },
                          ].map((item) => (
                            <div key={item.label} className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-[10px] text-gray-500 uppercase">{item.label}</p>
                              <p className="font-bold text-sm text-gray-900">{item.value}</p>
                            </div>
                          ))}
                        </div>
                        {/* Hiperparametros */}
                        <div className="flex flex-wrap gap-1.5">
                          {currentModel.hyperparameters && Object.entries(currentModel.hyperparameters).map(([k, v]) => (
                            <Badge key={k} variant="outline" className="text-[11px]">{k}: {v}</Badge>
                          ))}
                          <Badge variant="outline" className="text-[11px]">dataset: {currentModel.dataset}</Badge>
                          {currentModel.best_results.best_epoch && (
                            <Badge variant="outline" className="text-[11px]">mejor epoca: {currentModel.best_results.best_epoch}</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Curvas de entrenamiento */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <TrainingCurves history={currentModel.training_history} type="loss" />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <TrainingCurves history={currentModel.training_history} type="accuracy" />
                        </CardContent>
                      </Card>
                    </div>

                    {/* Matriz de confusion + Radar */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Matriz de Confusion</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ConfusionMatrix matrix={currentModel.confusion_matrix} />
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <MetricsRadar perClassMetrics={currentModel.per_class_metrics} />
                        </CardContent>
                      </Card>
                    </div>

                    {/* Tabla metricas por clase */}
                    {currentModel.per_class_metrics && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Metricas por Clase</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto -mx-6 px-6">
                            <table className="w-full text-xs min-w-[500px]">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-2 font-semibold">Clase</th>
                                  <th className="text-center py-2 px-2 font-semibold">Precision</th>
                                  <th className="text-center py-2 px-2 font-semibold">Recall</th>
                                  <th className="text-center py-2 px-2 font-semibold">F1-Score</th>
                                  <th className="text-center py-2 px-2 font-semibold">Especif.</th>
                                  <th className="text-center py-2 px-2 font-semibold">AUC</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(currentModel.class_names || []).map((name, i) => (
                                  <tr key={i} className="border-b hover:bg-gray-50">
                                    <td className="py-1.5 px-2 font-medium">{name}</td>
                                    <td className="text-center py-1.5 px-2 font-mono">{(currentModel.per_class_metrics.precision[i] * 100).toFixed(1)}%</td>
                                    <td className="text-center py-1.5 px-2 font-mono">{(currentModel.per_class_metrics.recall[i] * 100).toFixed(1)}%</td>
                                    <td className="text-center py-1.5 px-2 font-mono">{(currentModel.per_class_metrics.f1[i] * 100).toFixed(1)}%</td>
                                    <td className="text-center py-1.5 px-2 font-mono">{(currentModel.per_class_metrics.specificity[i] * 100).toFixed(1)}%</td>
                                    <td className="text-center py-1.5 px-2 font-mono">{(currentModel.per_class_metrics.auc[i] * 100).toFixed(1)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* ====== TAB: VERSUS ====== */}
              <TabsContent value="versus">
                {/* Selectores */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Modelo A</label>
                    <Select value={vsModelA} onValueChange={setVsModelA}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Seleccionar modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelKeys.map(key => (
                          <SelectItem key={key} value={key}>{metricsData[key].display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Comparar con</label>
                    <Select value={vsModelB} onValueChange={setVsModelB}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos los modelos</SelectItem>
                        {modelKeys.filter(k => k !== vsModelA).map(key => (
                          <SelectItem key={key} value={key}>{metricsData[key].display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Metrica</label>
                    <Select value={vsMetric} onValueChange={setVsMetric}>
                      <SelectTrigger className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPARE_METRICS.map(m => (
                          <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Grafica de comparacion */}
                <Card className="mb-6">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      {vsModelB === '__all__'
                        ? `Comparativa: ${COMPARE_METRICS.find(m => m.key === vsMetric)?.label || vsMetric}`
                        : `${metricsData[vsModelA]?.display_name} vs ${metricsData[vsModelB]?.display_name}`
                      }
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {vsModelB === '__all__' ? (
                      /* Barras horizontales: todos los modelos en una metrica */
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={buildVsData()} layout="vertical" margin={{ left: 10, right: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                          <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => `${v}%`} />
                          <Bar dataKey="value" name={COMPARE_METRICS.find(m => m.key === vsMetric)?.label} radius={[0, 4, 4, 0]} barSize={28}>
                            {buildVsData().map((entry, i) => (
                              <rect key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      /* Barras agrupadas: dos modelos en todas las metricas */
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={buildVsData()} margin={{ left: 10, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                          <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => `${v}%`} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey={metricsData[vsModelA]?.display_name} fill={MODEL_STROKE_COLORS[vsModelA]} radius={[4, 4, 0, 0]} barSize={24} />
                          <Bar dataKey={metricsData[vsModelB]?.display_name} fill={MODEL_STROKE_COLORS[vsModelB]} radius={[4, 4, 0, 0]} barSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Curvas de entrenamiento superpuestas */}
                {(() => {
                  const vsTraining = buildVsTrainingData();
                  if (!vsTraining.data || vsTraining.data.length === 0) return null;
                  return (
                    <Card className="mb-6">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <LineChartIcon className="h-4 w-4" />
                          Curvas de Accuracy (Validacion)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={vsTraining.data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="epoch" tick={{ fontSize: 11 }} label={{ value: 'Epoca', position: 'insideBottomRight', offset: -5, fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} domain={[40, 100]} unit="%" />
                            <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => `${v?.toFixed(2)}%`} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {vsTraining.keys.map(key => (
                              <Line
                                key={key}
                                type="monotone"
                                dataKey={metricsData[key].display_name}
                                stroke={MODEL_STROKE_COLORS[key]}
                                dot={false}
                                strokeWidth={2}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Tabla comparativa rapida */}
                {vsModelB !== '__all__' && metricsData[vsModelA] && metricsData[vsModelB] && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Comparacion Detallada</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto -mx-6 px-6">
                        <table className="w-full text-xs min-w-[400px]">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-semibold">Metrica</th>
                              <th className="text-center py-2 px-2 font-semibold">{metricsData[vsModelA].display_name}</th>
                              <th className="text-center py-2 px-2 font-semibold">{metricsData[vsModelB].display_name}</th>
                              <th className="text-center py-2 px-2 font-semibold">Diferencia</th>
                            </tr>
                          </thead>
                          <tbody>
                            {COMPARE_METRICS.map(mc => {
                              const a = mc.isDirect ? metricsData[vsModelA].metrics[mc.key] : metricsData[vsModelA].metrics[mc.key] * 100;
                              const b = mc.isDirect ? metricsData[vsModelB].metrics[mc.key] : metricsData[vsModelB].metrics[mc.key] * 100;
                              const diff = a - b;
                              return (
                                <tr key={mc.key} className="border-b hover:bg-gray-50">
                                  <td className="py-1.5 px-2 font-medium">{mc.label}</td>
                                  <td className={`text-center py-1.5 px-2 font-mono ${diff >= 0 ? 'font-semibold' : ''}`}>{a.toFixed(2)}%</td>
                                  <td className={`text-center py-1.5 px-2 font-mono ${diff < 0 ? 'font-semibold' : ''}`}>{b.toFixed(2)}%</td>
                                  <td className={`text-center py-1.5 px-2 font-mono ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    {diff > 0 ? '+' : ''}{diff.toFixed(2)}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </section>
      )}

      {/* Estrategia del ensemble */}
      <section className="py-10 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-4">
            Estrategia de Consenso
          </h2>
          <Card className="shadow-md">
            <CardContent className="pt-6">
              <p className="text-gray-700 text-sm leading-relaxed">
                Los 5 modelos analizan la imagen simultaneamente. El diagnostico final se determina por <strong>voto de consenso</strong> — la clasificacion mas votada es el resultado, con la confianza promedio de los modelos que coinciden. Este enfoque reduce el riesgo de error de cualquier modelo individual y proporciona un diagnostico mas robusto.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CMS content sections */}
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

      {/* Clasificacion de severidad */}
      <section className="py-10 bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Clasificacion de Severidad
          </h2>
          <p className="text-gray-600 mb-6 text-sm">
            El ensemble clasifica las imagenes en 5 categorias de severidad
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className="py-1.5 px-3 text-sm shadow-sm">Sin RD</Badge>
            <Badge variant="outline" className="py-1.5 px-3 text-sm bg-yellow-50 shadow-sm">RD Leve</Badge>
            <Badge variant="outline" className="py-1.5 px-3 text-sm bg-orange-50 shadow-sm">RD Moderada</Badge>
            <Badge variant="outline" className="py-1.5 px-3 text-sm bg-red-50 shadow-sm">RD Severa</Badge>
            <Badge variant="outline" className="py-1.5 px-3 text-sm bg-red-100 shadow-sm">RD Proliferativa</Badge>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Modelo;
