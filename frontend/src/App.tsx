import { useMemo, useState } from 'react';
import './App.css';

import Chat, { type ChatMessage } from './components/Chat';
import DisasterAlertModal from './components/DisasterAlertModal';
import Login from './components/Login';
import Profile from './components/Profile';
import QuarterPanel from './components/QuarterPanel';
import ResourceHistoryModal from './components/ResourceHistoryModal';
import TokyorkMap, { type MapMode } from './components/TokyorkMap';

import {
  LEVELS,
  QUARTERS,
  QUARTER_CODES,
  ROLE_LABELS,
  type DisasterLevel,
  type QuarterCode,
  type Role,
} from './data/city';
import { useDisasterAlerts } from './hooks/useDisasterAlerts';
import type { NewTransfer, TransferRecord } from './types/resources';
import type { User } from './types/user';

const INITIAL_SEVERITY: Record<QuarterCode, DisasterLevel> = {
  A: 1,
  E: 2,
  W: 1,
  X: 3,
  Z: 2,
};

// Transferts d'exemple, cohérents avec les règles (quartiers adjacents, niveaux, seuils de rétention)
const INITIAL_TRANSFERS: TransferRecord[] = [
  {
    id: 'tr-1',
    timestamp: '10:15',
    fromQuarter: 'X',
    toQuarter: 'A',
    resource: 'Medical personnel',
    quantity: 2,
    status: 'approved',
    requestedBy: 'Opérateur X',
  },
  {
    id: 'tr-2',
    timestamp: '10:22',
    fromQuarter: 'Z',
    toQuarter: 'W',
    resource: 'Food & water supplies',
    quantity: 4,
    status: 'refused', // Z est en niveau 2 : pas de transfert entre quartiers
    requestedBy: 'Opérateur Z',
  },
  {
    id: 'tr-3',
    timestamp: '10:31',
    fromQuarter: 'X',
    toQuarter: 'E',
    resource: 'Communication equipment',
    quantity: 3,
    status: 'pending',
    requestedBy: 'Opérateur X',
  },
];

type ViewMode = 'dashboard' | 'profile';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');

  const [severity, setSeverity] = useState(INITIAL_SEVERITY);
  const [selected, setSelected] = useState<QuarterCode>('X');
  const [mode, setMode] = useState<MapMode>('severity');
  const [showRoutes, setShowRoutes] = useState(true);
  const [loweredRetention, setLoweredRetention] = useState(false);

  // Le rôle est celui de l'utilisateur connecté : une seule source de vérité,
  // donc la barre du haut, le profil et le chat affichent toujours le même.
  const role: Role = user?.role ?? 'QC';
  const changeRole = (newRole: Role) =>
    setUser((current) => (current ? { ...current, role: newRole } : current));

  // ÉTAT HISTORIQUE DES RESSOURCES
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [transfers, setTransfers] = useState<TransferRecord[]>(INITIAL_TRANSFERS);

  // ÉTAT DU CHAT
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // ALERTES CATASTROPHES (WebSocket du back-end), actives seulement une fois connecté
  const disasterAlerts = useDisasterAlerts(user !== null);

  const cityLevel = useMemo(
    () => Math.max(...QUARTER_CODES.map((c) => severity[c])) as DisasterLevel,
    [severity],
  );

  const setQuarterLevel = (code: QuarterCode, level: DisasterLevel) =>
    setSeverity((s) => ({ ...s, [code]: level }));

  const canLowerRetention = role === 'CD' && cityLevel === 5;

  const handleLogin = (loggedUser: User) => {
    setUser(loggedUser);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('dashboard');
  };

  const handleSendMessage = (text: string) => {
    if (!user) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderName: user.name,
      senderRole: role,
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleAddTransfer = (newTransfer: NewTransfer) => {
    const record: TransferRecord = {
      ...newTransfer,
      id: `tr-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setTransfers((prev) => [...prev, record]);
  };

  // « Voir sur la carte » : on revient au tableau de bord, quartier touché sélectionné
  const handleShowDisasterQuarter = (code: QuarterCode) => {
    setSelected(code);
    setCurrentView('dashboard');
    disasterAlerts.dismiss();
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <div
          className="brand"
          style={{ cursor: 'pointer' }}
          onClick={() => setCurrentView('dashboard')}
        >
          KAIJU_<span>&lt; CRISIS MANAGER /&gt;</span>
        </div>

        <div
          className="city-level"
          style={{ borderColor: LEVELS[cityLevel].color, color: LEVELS[cityLevel].color }}
        >
          CITY LEVEL {cityLevel} · {LEVELS[cityLevel].name}
        </div>

        {/* Bouton Historique des ressources */}
        <button
          onClick={() => setIsResourceModalOpen(true)}
          style={{
            background: '#101a33',
            border: '1px solid #2b3a63',
            color: '#63d5ff',
            padding: '6px 12px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          📦 Flux Ressources
        </button>

        <label className="field inline">
          <span>Role</span>
          <select value={role} onChange={(e) => changeRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {r} — {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentView(currentView === 'profile' ? 'dashboard' : 'profile')}
            style={{
              background: currentView === 'profile' ? '#1d2c52' : 'transparent',
              border: '1px solid #2b3a63',
              color: '#e8f0ff',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            👤 {user.name}
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 39, 64, 0.4)',
              color: '#ff6b7d',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Bandeau visible seulement si la connexion aux alertes est perdue */}
      <p className="live-banner" role="status">
        {disasterAlerts.status === 'offline' &&
          'Alertes catastrophes hors ligne : reconnexion automatique en cours…'}
      </p>

      {currentView === 'profile' ? (
        <Profile
          user={user}
          onLogout={handleLogout}
          onBackToDashboard={() => setCurrentView('dashboard')}
        />
      ) : (
        <main className="layout">
          <section className="map-col">
            <div className="map-toolbar">
              <div className="segmented">
                <button
                  className={mode === 'severity' ? 'on' : ''}
                  onClick={() => setMode('severity')}
                >
                  Severity view
                </button>
                <button className={mode === 'quarter' ? 'on' : ''} onClick={() => setMode('quarter')}>
                  Quarter view
                </button>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showRoutes}
                  onChange={(e) => setShowRoutes(e.target.checked)}
                />
                Routes &amp; maritime lanes
              </label>
              <label className="check" title="City Director only, at level 5">
                <input
                  type="checkbox"
                  checked={loweredRetention}
                  disabled={!canLowerRetention}
                  onChange={(e) => setLoweredRetention(e.target.checked)}
                />
                Lower retention to 15%
              </label>
            </div>

            <TokyorkMap
              severity={severity}
              selected={selected}
              onSelect={setSelected}
              mode={mode}
              showRoutes={showRoutes}
            />

            <div className="quarter-chips">
              {QUARTER_CODES.map((c) => (
                <button
                  key={c}
                  className={`chip ${selected === c ? 'on' : ''}`}
                  style={{ borderColor: QUARTERS[c].color }}
                  onClick={() => setSelected(c)}
                >
                  <b>{c}</b> {QUARTERS[c].name}
                  <span className="chip-lvl" style={{ background: LEVELS[severity[c]].color }}>
                    {severity[c]}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <aside className="side-col">
            <QuarterPanel
              code={selected}
              level={severity[selected]}
              role={role}
              loweredRetention={loweredRetention && canLowerRetention}
              onLevelChange={(l) => setQuarterLevel(selected, l)}
            />
          </aside>
        </main>
      )}

      <ResourceHistoryModal
        isOpen={isResourceModalOpen}
        onClose={() => setIsResourceModalOpen(false)}
        transfers={transfers}
        onAddTransfer={handleAddTransfer}
      />

      <DisasterAlertModal
        alert={disasterAlerts.current}
        pendingCount={disasterAlerts.pendingCount}
        onDismiss={disasterAlerts.dismiss}
        onShowQuarter={handleShowDisasterQuarter}
      />

      <Chat currentUser={{ name: user.name, role }} messages={messages} onSendMessage={handleSendMessage} />
    </div>
  );
}