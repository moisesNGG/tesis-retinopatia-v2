import React from 'react';

const CLASS_SHORT = ['Sin Retinopatia', 'Leve', 'Moderada', 'Severa', 'Proliferativa'];

const ConfusionMatrix = ({ matrix, classNames = CLASS_SHORT }) => {
  if (!matrix || matrix.length === 0) return null;

  // Encontrar el valor maximo para normalizar colores
  const allValues = matrix.flat();
  const maxVal = Math.max(...allValues);

  const getColor = (value) => {
    const intensity = value / maxVal;
    if (intensity > 0.7) return 'bg-blue-600 text-white';
    if (intensity > 0.4) return 'bg-blue-400 text-white';
    if (intensity > 0.2) return 'bg-blue-200 text-blue-900';
    if (intensity > 0.05) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-50 text-gray-500';
  };

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-gray-500 text-center mb-2 font-medium">
        Prediccion &rarr;
      </div>
      <div className="inline-block">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="w-20"></th>
              {classNames.map((name, i) => (
                <th key={i} className="px-1 py-1 text-[10px] text-gray-600 font-medium text-center w-16 leading-tight">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <td className="pr-2 text-[10px] text-gray-600 font-medium text-right leading-tight">
                  {classNames[i]}
                </td>
                {row.map((val, j) => (
                  <td key={j} className="p-0">
                    <div
                      className={`w-14 h-10 flex items-center justify-center text-[11px] font-mono font-semibold border border-white/50 rounded-sm ${getColor(val)}`}
                    >
                      {val}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gray-500 mt-1 -rotate-0 text-left ml-2">
        &uarr; Real
      </div>
    </div>
  );
};

export default ConfusionMatrix;
