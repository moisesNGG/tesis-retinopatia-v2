import React from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const CLASS_SHORT = ['Sin RD', 'Leve', 'Moderada', 'Severa', 'Prolif.'];

const MetricsRadar = ({ perClassMetrics, classNames = CLASS_SHORT }) => {
  if (!perClassMetrics) return null;

  const data = classNames.map((name, i) => ({
    class: name,
    Precision: (perClassMetrics.precision[i] * 100).toFixed(1),
    Recall: (perClassMetrics.recall[i] * 100).toFixed(1),
    F1: (perClassMetrics.f1[i] * 100).toFixed(1),
  }));

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Metricas por Clase</h4>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis dataKey="class" tick={{ fontSize: 10 }} />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 9 }}
            tickCount={5}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value) => `${value}%`}
          />
          <Radar
            name="Precision"
            dataKey="Precision"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Radar
            name="Recall"
            dataKey="Recall"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.1}
            strokeWidth={2}
          />
          <Radar
            name="F1-Score"
            dataKey="F1"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 text-xs mt-1">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> Precision
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-emerald-500 inline-block"></span> Recall
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-500 inline-block"></span> F1
        </span>
      </div>
    </div>
  );
};

export default MetricsRadar;
