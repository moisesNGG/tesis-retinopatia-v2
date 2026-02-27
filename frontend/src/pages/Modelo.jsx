import React, { useEffect, useState } from 'react';
import Layout from '../components/layout/Layout';
import Hero from '../components/sections/Hero';
import ContentSection from '../components/sections/ContentSection';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import {
  Brain, Layers, Grid3X3, Sparkles, Eye, Zap, Network, ScanSearch, Cpu,
  TrendingUp, BarChart3, Target, ChevronRight,
} from 'lucide-react';
import { pagesAPI, modelsAPI } from '../services/api';
import TrainingCurves from '../components/charts/TrainingCurves';
import ConfusionMatrix from '../components/charts/ConfusionMatrix';
import MetricsRadar from '../components/charts/MetricsRadar';

const MODEL_ICONS = {
  densenet121_ea: Layers,
  efficientnet_b0_ea: Zap,
  resnet50_ea: Network,
  vit_b16_ea: Eye,
  yolov8x_cls: ScanSearch,
};

const MODEL_COLORS = {
  densenet121_ea: 'from-emerald-500 to-emerald-600',
  efficientnet_b0_ea: 'from-blue-500 to-blue-600',
  resnet50_ea: 'from-violet-500 to-violet-600',
  vit_b16_ea: 'from-amber-500 to-amber-600',
  yolov8x_cls: 'from-rose-500 to-rose-600',
};

const Modelo = () => {
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metricsData, setMetricsData] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

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
    } catch (err) {
      console.error('Error cargando metricas:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const summaryMetrics = [
    {
      icon: Brain,
      label: '5 Modelos',
      value: 'Ensemble',
      description: 'Ensemble de 5 arquitecturas de deep learning'
    },
    {
      icon: Grid3X3,
      label: '5 Clases',
      value: 'Multiclase',
      description: 'Clasificacion en 5 niveles de severidad'
    },
    {
      icon: Cpu,
      label: 'Entrada',
      value: '224x224',
      description: 'Resolucion de entrada de las imagenes'
    },
    {
      icon: Sparkles,
      label: 'Atencion',
      value: 'External',
      description: 'Mecanismo de atencion en 4 modelos'
    }
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

      {/* Metricas del ensemble */}
      <section className="py-12 bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
                    <p className="font-semibold text-gray-900 text-sm mb-1">
                      {metric.label}
                    </p>
                    <p className="text-xs text-gray-600">
                      {metric.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tabla comparativa de modelos */}
      {metricsData && (
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-3">
              Comparativa de Rendimiento
            </h2>
            <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto text-sm">
              Metricas de evaluacion de cada modelo sobre el conjunto de validacion (10,008 imagenes).
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Modelo</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-700">Accuracy</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-700">F1 Macro</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-700">AUC Macro</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-700">Precision</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-700">Recall</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-700">Epocas</th>
                  </tr>
                </thead>
                <tbody>
                  {modelKeys.map((key) => {
                    const m = metricsData[key];
                    const Icon = MODEL_ICONS[key] || Brain;
                    const color = MODEL_COLORS[key] || 'from-gray-500 to-gray-600';
                    const isTop = m.metrics.accuracy === Math.max(...modelKeys.map(k => metricsData[k].metrics.accuracy));
                    return (
                      <tr key={key} className={`border-b ${isTop ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 bg-gradient-to-br ${color} rounded-md flex items-center justify-center flex-shrink-0`}>
                              <Icon className="h-3.5 w-3.5 text-white" />
                            </div>
                            <span className="font-medium text-gray-900">{m.display_name}</span>
                            {isTop && <Badge className="text-[10px] bg-blue-100 text-blue-700 ml-1">Mejor</Badge>}
                          </div>
                        </td>
                        <td className="text-center py-3 px-3 font-mono font-semibold">
                          {m.metrics.accuracy.toFixed(2)}%
                        </td>
                        <td className="text-center py-3 px-3 font-mono">
                          {(m.metrics.f1_macro * 100).toFixed(2)}%
                        </td>
                        <td className="text-center py-3 px-3 font-mono">
                          {(m.metrics.auc_macro * 100).toFixed(2)}%
                        </td>
                        <td className="text-center py-3 px-3 font-mono">
                          {(m.metrics.precision_macro * 100).toFixed(2)}%
                        </td>
                        <td className="text-center py-3 px-3 font-mono">
                          {(m.metrics.recall_macro * 100).toFixed(2)}%
                        </td>
                        <td className="text-center py-3 px-3 font-mono text-gray-600">
                          {m.best_results.best_epoch || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Loading metrics */}
      {metricsLoading && !metricsData && (
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-48 w-full" />
          </div>
        </section>
      )}

      {/* Cards expandibles por modelo */}
      {metricsData && (
        <section className="py-12 bg-gradient-to-br from-gray-50 to-blue-50/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-3">
              Detalle por Modelo
            </h2>
            <p className="text-gray-600 text-center mb-8 max-w-2xl mx-auto text-sm">
              Expande cada modelo para ver curvas de entrenamiento, matriz de confusion y metricas por clase.
            </p>

            <Accordion type="single" collapsible className="space-y-4">
              {modelKeys.map((key) => {
                const m = metricsData[key];
                const Icon = MODEL_ICONS[key] || Brain;
                const color = MODEL_COLORS[key] || 'from-gray-500 to-gray-600';
                return (
                  <AccordionItem key={key} value={key} className="bg-white rounded-lg shadow-sm border">
                    <AccordionTrigger className="px-5 py-4 hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{m.display_name}</p>
                          <p className="text-xs text-gray-500">{m.architecture}</p>
                        </div>
                        <div className="ml-auto flex gap-2 mr-4">
                          <Badge variant="outline" className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {m.metrics.accuracy.toFixed(1)}%
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Target className="h-3 w-3 mr-1" />
                            F1: {(m.metrics.f1_macro * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 pb-6">
                      {/* Metricas clave */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
                        {[
                          { label: 'Accuracy', value: `${m.metrics.accuracy.toFixed(2)}%` },
                          { label: 'F1 Macro', value: `${(m.metrics.f1_macro * 100).toFixed(2)}%` },
                          { label: 'AUC Macro', value: `${(m.metrics.auc_macro * 100).toFixed(2)}%` },
                          { label: 'Precision', value: `${(m.metrics.precision_macro * 100).toFixed(2)}%` },
                          { label: 'Recall', value: `${(m.metrics.recall_macro * 100).toFixed(2)}%` },
                          { label: 'Especificidad', value: `${(m.metrics.specificity_macro * 100).toFixed(2)}%` },
                        ].map((item) => (
                          <div key={item.label} className="bg-gray-50 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-gray-500 uppercase">{item.label}</p>
                            <p className="font-bold text-sm text-gray-900">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Hiperparametros */}
                      {m.hyperparameters && (
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Hiperparametros</h4>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(m.hyperparameters).map(([k, v]) => (
                              <Badge key={k} variant="outline" className="text-xs">
                                {k}: {v}
                              </Badge>
                            ))}
                            <Badge variant="outline" className="text-xs">
                              dataset: {m.dataset}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* Curvas de entrenamiento + Metricas radar */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <TrainingCurves history={m.training_history} type="loss" />
                        <TrainingCurves history={m.training_history} type="accuracy" />
                      </div>

                      {/* Matriz de confusion + Radar */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Matriz de Confusion</h4>
                          <ConfusionMatrix matrix={m.confusion_matrix} />
                        </div>
                        <MetricsRadar perClassMetrics={m.per_class_metrics} />
                      </div>

                      {/* Tabla de metricas por clase */}
                      {m.per_class_metrics && (
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Metricas por Clase</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-2 font-semibold">Clase</th>
                                  <th className="text-center py-2 px-2 font-semibold">Precision</th>
                                  <th className="text-center py-2 px-2 font-semibold">Recall</th>
                                  <th className="text-center py-2 px-2 font-semibold">F1-Score</th>
                                  <th className="text-center py-2 px-2 font-semibold">Especificidad</th>
                                  <th className="text-center py-2 px-2 font-semibold">AUC</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(m.class_names || []).map((name, i) => (
                                  <tr key={i} className="border-b hover:bg-gray-50">
                                    <td className="py-1.5 px-2 font-medium">{name}</td>
                                    <td className="text-center py-1.5 px-2 font-mono">
                                      {(m.per_class_metrics.precision[i] * 100).toFixed(1)}%
                                    </td>
                                    <td className="text-center py-1.5 px-2 font-mono">
                                      {(m.per_class_metrics.recall[i] * 100).toFixed(1)}%
                                    </td>
                                    <td className="text-center py-1.5 px-2 font-mono">
                                      {(m.per_class_metrics.f1[i] * 100).toFixed(1)}%
                                    </td>
                                    <td className="text-center py-1.5 px-2 font-mono">
                                      {(m.per_class_metrics.specificity[i] * 100).toFixed(1)}%
                                    </td>
                                    <td className="text-center py-1.5 px-2 font-mono">
                                      {(m.per_class_metrics.auc[i] * 100).toFixed(1)}%
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        </section>
      )}

      {/* Estrategia del ensemble */}
      <section className="py-10 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Clasificacion de Severidad
          </h2>
          <p className="text-gray-600 mb-6 text-sm">
            El ensemble clasifica las imagenes en 5 categorias de severidad
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className="py-1.5 px-3 text-sm shadow-sm">
              Sin Retinopatia
            </Badge>
            <Badge variant="outline" className="py-1.5 px-3 text-sm bg-yellow-50 shadow-sm">
              RD Leve
            </Badge>
            <Badge variant="outline" className="py-1.5 px-3 text-sm bg-orange-50 shadow-sm">
              RD Moderada
            </Badge>
            <Badge variant="outline" className="py-1.5 px-3 text-sm bg-red-50 shadow-sm">
              RD Severa
            </Badge>
            <Badge variant="outline" className="py-1.5 px-3 text-sm bg-red-100 shadow-sm">
              RD Proliferativa
            </Badge>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Modelo;
