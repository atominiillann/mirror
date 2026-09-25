import { ADJACENCY, QUARTERS, type QuarterCode } from '../data/city';
import type { Stock } from '../backend';

interface Props {
  code: QuarterCode;
  /** Stocks de toute la ville, venant de GET /resources */
  stocks: Stock[];
  /** City Director au niveau 5 : le serveur n'oblige à garder que 15 % */
  loweredRetention?: boolean;
}

export default function QuarterPanel({ code, stocks, loweredRetention = false }: Props) {
  const quarter = QUARTERS[code];
  const quarterStocks = stocks.filter((s) => s.district_code === code);

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

      {quarterStocks.length === 0 ? (
        <p className="muted">Loading stocks…</p>
      ) : (
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
            {quarterStocks.map((s) => {
              // min_retention = 30 % du stock initial, calculé par le serveur
              const keep = loweredRetention ? Math.ceil(s.initial_quantity * 0.15) : s.min_retention;
              const free = Math.max(0, s.current_quantity - keep);
              return (
                <tr key={s.resource_name}>
                  <td>{s.resource_name}</td>
                  <td>
                    {s.current_quantity}
                    <span className="muted"> / {s.initial_quantity}</span>
                  </td>
                  <td className="muted">{keep}</td>
                  <td>
                    <span className="bar">
                      <span
                        className="bar-fill"
                        style={{
                          width: `${s.current_quantity > 0 ? (free / s.current_quantity) * 100 : 0}%`,
                          background: quarter.color,
                        }}
                      />
                    </span>
                    {free}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}