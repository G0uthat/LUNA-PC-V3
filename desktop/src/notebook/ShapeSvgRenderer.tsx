import React from 'react';
import { ShapeCanvasObject } from '../types';

function buildPolygonPoints(sides: number, star = false): string {
  const total = star ? sides * 2 : sides;
  const pts: string[] = [];
  for (let i = 0; i < total; i++) {
    const angle = (i * Math.PI * 2) / total - Math.PI / 2;
    const scale = star && i % 2 === 1 ? 0.44 : 1;
    const x = 50 + Math.cos(angle) * 46 * scale;
    const y = 50 + Math.sin(angle) * 46 * scale;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

const PENTAGON_PTS = buildPolygonPoints(5, false);
const HEXAGON_PTS = buildPolygonPoints(6, false);
const STAR_PTS = buildPolygonPoints(5, true);

export const ShapeSvgRenderer: React.FC<{ obj: ShapeCanvasObject }> = ({ obj }) => {
  const dash =
    obj.lineStyle === 'dashed'
      ? '8 5'
      : obj.lineStyle === 'dotted'
        ? '2 5'
        : undefined;

  const fill = obj.fillColor && obj.fillColor !== 'transparent' ? obj.fillColor : 'none';

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full h-full overflow-visible pointer-events-none"
    >
      {obj.shape === 'rect' && (
        <rect
          x="2"
          y="2"
          width="96"
          height="96"
          rx={Math.min(48, (obj.borderRadius ?? 10) * 0.6)}
          fill={fill}
          stroke={obj.strokeColor}
          strokeWidth={obj.strokeWidth}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {obj.shape === 'ellipse' && (
        <ellipse
          cx="50"
          cy="50"
          rx="47"
          ry="47"
          fill={fill}
          stroke={obj.strokeColor}
          strokeWidth={obj.strokeWidth}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {obj.shape === 'triangle' && (
        <polygon
          points="50,4 96,95 4,95"
          fill={fill}
          stroke={obj.strokeColor}
          strokeWidth={obj.strokeWidth}
          strokeLinejoin="round"
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {obj.shape === 'diamond' && (
        <polygon
          points="50,4 96,50 50,96 4,50"
          fill={fill}
          stroke={obj.strokeColor}
          strokeWidth={obj.strokeWidth}
          strokeLinejoin="round"
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {obj.shape === 'pentagon' && (
        <polygon
          points={PENTAGON_PTS}
          fill={fill}
          stroke={obj.strokeColor}
          strokeWidth={obj.strokeWidth}
          strokeLinejoin="round"
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {obj.shape === 'hexagon' && (
        <polygon
          points={HEXAGON_PTS}
          fill={fill}
          stroke={obj.strokeColor}
          strokeWidth={obj.strokeWidth}
          strokeLinejoin="round"
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {obj.shape === 'star' && (
        <polygon
          points={STAR_PTS}
          fill={fill}
          stroke={obj.strokeColor}
          strokeWidth={obj.strokeWidth}
          strokeLinejoin="round"
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {obj.shape === 'line' && (
        <line
          x1="2"
          y1="50"
          x2="98"
          y2="50"
          stroke={obj.strokeColor}
          strokeWidth={Math.max(2, obj.strokeWidth)}
          strokeLinecap="round"
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {obj.shape === 'arrow' && (
        <g>
          <line
            x1="2"
            y1="50"
            x2="92"
            y2="50"
            stroke={obj.strokeColor}
            strokeWidth={Math.max(2, obj.strokeWidth)}
            strokeLinecap="round"
            strokeDasharray={dash}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points="78,26 96,50 78,74"
            fill="none"
            stroke={obj.strokeColor}
            strokeWidth={Math.max(2, obj.strokeWidth)}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </svg>
  );
};
