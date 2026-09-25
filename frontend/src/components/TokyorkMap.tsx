import { useState } from 'react';
import {
  ADJACENCY,
  LEVELS,
  QUARTERS,
  QUARTER_CODES,
  SEA_ROUTE,
  type DisasterLevel,
  type QuarterCode,
} from '../data/city';
import { BAY_PATH, MAP_VIEWBOX, QUARTER_PATHS } from '../data/mapPaths';
import './TokyorkMap.css';

export type MapMode = 'severity' | 'quarter';

interface Props {
  severity: Record<QuarterCode, DisasterLevel>;
  selected: QuarterCode | null;
  onSelect: (code: QuarterCode) => void;
  mode: MapMode;
  showRoutes: boolean;
}

const SEA_HUB = { x: 780, y: 560 };

export default function TokyorkMap({ severity, selected, onSelect, mode, showRoutes }: Props) {
  const [hovered, setHovered] = useState<QuarterCode | null>(null);

  const fillOf = (code: QuarterCode) =>
    mode === 'severity' ? LEVELS[severity[code]].color : QUARTERS[code].color;

  const landLinks = QUARTER_CODES.flatMap((from) =>
    ADJACENCY[from].filter((to) => to > from).map((to) => [from, to] as const),
  );

  return (
    <div className="map-wrap">
      <svg viewBox={MAP_VIEWBOX} className="map-svg" role="img" aria-label="Map of Tokyork">
        <defs>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="976" height="972" fill="#0b1020" />
        <path d={BAY_PATH} className="bay" />

        {QUARTER_CODES.map((code) => {
          const active = selected === code;
          const level = severity[code];
          return (
            <path
              key={code}
              d={QUARTER_PATHS[code]}
              className={[
                'quarter',
                active ? 'is-selected' : '',
                hovered === code ? 'is-hovered' : '',
                level >= 4 ? 'is-critical' : '',
              ].join(' ')}
              fill={fillOf(code)}
              filter={active || level >= 4 ? 'url(#glow)' : undefined}
              tabIndex={0}
              role="button"
              aria-label={`${QUARTERS[code].name} — level ${level} ${LEVELS[level].name}`}
              onClick={() => onSelect(code)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(code)}
              onMouseEnter={() => setHovered(code)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {showRoutes && (
          <g className="routes">
            {landLinks.map(([from, to]) => (
              <line
                key={`${from}${to}`}
                x1={QUARTERS[from].labelAt.x}
                y1={QUARTERS[from].labelAt.y}
                x2={QUARTERS[to].labelAt.x}
                y2={QUARTERS[to].labelAt.y}
                className="route-land"
              />
            ))}
            {SEA_ROUTE.map((code) => (
              <line
                key={`sea-${code}`}
                x1={QUARTERS[code].labelAt.x}
                y1={QUARTERS[code].labelAt.y}
                x2={SEA_HUB.x}
                y2={SEA_HUB.y}
                className="route-sea"
              />
            ))}
            <circle cx={SEA_HUB.x} cy={SEA_HUB.y} r="16" className="sea-hub" />
            <text x={SEA_HUB.x} y={SEA_HUB.y + 42} className="sea-label">
              Tokyork Bay
            </text>
          </g>
        )}

        {QUARTER_CODES.map((code) => {
          const q = QUARTERS[code];
          return (
            <g
              key={`label-${code}`}
              className="label"
              onClick={() => onSelect(code)}
              onMouseEnter={() => setHovered(code)}
              onMouseLeave={() => setHovered(null)}
            >
              <text x={q.labelAt.x} y={q.labelAt.y} className="label-code">
                {code}
              </text>
              <text x={q.labelAt.x} y={q.labelAt.y + 34} className="label-name">
                {q.name.toUpperCase()}
              </text>
              <text x={q.labelAt.x} y={q.labelAt.y + 62} className="label-level">
                LVL {severity[code]} · {LEVELS[severity[code]].name}
              </text>
            </g>
          );
        })}
      </svg>

      <ul className="map-legend">
        {Object.values(LEVELS).map((l) => (
          <li key={l.level}>
            <span className="dot" style={{ background: l.color }} />
            {l.level} · {l.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
