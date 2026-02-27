import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const METRIC_LABELS = {
  accuracy: 'Accuracy',
  f1_macro: 'F1 Macro',
  auc_macro: 'AUC Macro',
  precision_macro: 'Precision',
  recall_macro: 'Recall',
  specificity_macro: 'Especificidad',
};

const MODEL_BAR_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#f43f5e', // rose
];

const ModelComparisonBar = ({ models, metric = 'accuracy' }) => {
  if (!models || models.length === 0) return null;

  const data = models.map((m, i) => {
    const val = metric === 'accuracy'
      ? m.metrics[metric]
      : m.metrics[metric] * 100;
    return {
      name: m.display_name.replace(' + EA', '+EA').replace('-B0', '-B0').replace('YOLOv8x-cls', 'YOLOv8x'),
      value: parseFloat(val.toFixed(2)),
      fill: MODEL_BAR_COLORS[i % MODEL_BAR_COLORS.length],
    };
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11 }}
            width={110}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value) => `${value}%`}
            labelStyle={{ fontWeight: 'bold' }}
          />
          <Bar
            dataKey="value"
            name={METRIC_LABELS[metric] || metric}
            radius={[0, 4, 4, 0]}
            barSize={28}
          >
            {data.map((entry, i) => (
              <rect key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export { METRIC_LABELS };
export default ModelComparisonBar;
