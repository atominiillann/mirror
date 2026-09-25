import {
  ADJACENCY,
  QUARTERS,
  RESOURCE_TYPES,
  minRetention,
  type DisasterLevel,
  type QuarterCode,
  type Role,
} from '../data/city';

interface Props {
  code: QuarterCode;
  loweredRetention?: boolean;
  // Props rendues optionnelles (?) pour éviter les erreurs dans le composant parent :
  level?: DisasterLevel;
  role?: Role;
  onLevelChange?: (level: DisasterLevel) => void;
}

export default function QuarterPanel({ code, loweredRetention = false }: Props) {
  const quarter = QUARTERS[code];

  return (
    <section className="panel">
      <header className="panel-head">
        <span className="badge" style={{ background: quarter.color }}>
          {code}
        </span>
        <div>
          <h2>{quarter.name}</h2>
          <p className="muted">
            {quarter.seaAccess ? 'Bay access' : 'Landlocked'}
            {quarter.hub ? ' · central hub' : ''} · borders {ADJACENCY[code].join(', ')}
          </p>
        </div>
      </header>

      <h3>Resources {loweredRetention ? '(retention lowered to 15%)' : '(retention 30%)'}</h3>
      <table className="res-table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Stock</th>
            <th>Retained</th>
            <th>Transferable</th>
          </tr>
        </thead>
        <tbody>
          {RESOURCE_TYPES.map((r) => {
            const total = quarter.stock[r];
            const keep = minRetention(total, loweredRetention);
            const free = total - keep;
            return (
              <tr key={r}>
                <td>{r}</td>
                <td>{total}</td>
                <td className="muted">{keep}</td>
                <td>
                  <span className="bar">
                    <span
                      className="bar-fill"
                      style={{ width: `${(free / total) * 100}%`, background: quarter.color }}
                    />
                  </span>
                  {free}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}