import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const TrainingCurves = ({ history, type = 'loss' }) => {
  if (!history) return <p className="text-sm text-gray-400 italic">Sin datos de entrenamiento disponibles</p>;

  const data = history.train_loss.map((_, i) => ({
    epoch: i + 1,
    train_loss: history.train_loss[i],
    val_loss: history.val_loss[i],
    train_accuracy: history.train_accuracy[i],
    val_accuracy: history.val_accuracy[i],
  }));

  if (type === 'loss') {
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Curvas de Perdida (Loss)</h4>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="epoch"
              tick={{ fontSize: 11 }}
              label={{ value: 'Epoca', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ fontSize: 12 }}
              formatter={(value) => value.toFixed(4)}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="train_loss"
              stroke="#3b82f6"
              name="Train Loss"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="val_loss"
              stroke="#ef4444"
              name="Val Loss"
              dot={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Curvas de Accuracy</h4>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="epoch"
            tick={{ fontSize: 11 }}
            label={{ value: 'Epoca', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value) => `${value.toFixed(2)}%`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="train_accuracy"
            stroke="#3b82f6"
            name="Train Acc"
            dot={false}
            strokeWidth={2}
          />
          <Line
            type="monotone"
            dataKey="val_accuracy"
            stroke="#10b981"
            name="Val Acc"
            dot={false}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrainingCurves;
