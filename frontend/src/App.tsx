import { useState } from 'react';
import './App.css';

import CalendarModal from './components/CalendarModal';
import Chat from './components/Chat';
import DisasterAlertModal from './components/DisasterAlertModal';
import Login from './components/Login';
import Profile from './components/Profile';
import QuarterPanel from './components/QuarterPanel';
import ResourceHistoryModal from './components/ResourceHistoryModal';
import TokyorkMap, { type MapMode } from './components/TokyorkMap';

import * as backend from './backend';
import {
  LEVELS,
  QUARTERS,
  QUARTER_CODES,
  ROLE_LABELS,
  type DisasterLevel,
  type QuarterCode,
} from './data/city';
import { useDisasterAlerts } from './hooks/useDisasterAlerts';
import { useKaiju } from './hooks/useKaiju';
import type { User } from './types/user';

type ViewMode = 'dashboard' | 'profile';

export default function App() {
  const [user, setUser] = useState<User | null>(() => backend.loadSession()?.user ?? null);
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');

  const [selected, setSelected] = useState<QuarterCode>(user?.quarter ?? 'X');
  const [mode, setMode] = useState<MapMode>('severity');
  const [showRoutes, setShowRoutes] = useState(true);

  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [levelError, setLevelError] = useState('');
  const [chatError, setChatError] = useState('');

  const city = useKaiju(user !== null);

  const disasterAlerts = useDisasterAlerts(user !== null);

  const cityLevel = city.level;
  const severity = Object.fromEntries(QUARTER_CODES.map((c) => [c, cityLevel])) as Record<QuarterCode, DisasterLevel>;

  const loweredRetention = user?.role === 'CD' && cityLevel === 5;

  const handleLogin = (loggedUser: User) => {
    setUser(loggedUser);
    setSelected(loggedUser.quarter ?? 'X');
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    backend.clearSession();
    setUser(null);
    setCurrentView('dashboard');
  };

  const handleLevelChange = async (level: DisasterLevel) => {
    setLevelError('');
    try {
      await backend.setLevel(level);
    } catch (err) {
      setLevelError((err as Error).message);
    }
  };

  const handleSendMessage = async (text: string) => {
    setChatError('');
    try {
      await backend.sendMessage(text);
    } catch (err) {
      setChatError(`Message non envoyé : ${(err as Error).message}`);
    }
  };

  const handleShowDisasterQuarter = (code: QuarterCode) => {
    setSelected(code);
    setCurrentView('dashboard');
    disasterAlerts.dismiss();
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const bannerText =
    city.error ||
    levelError ||
    chatError ||
    city.notice ||
    (disasterAlerts.status === 'offline' ? 'Connexion temps réel perdue : reconnexion en cours…' : '');

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

        {user.role === 'CD' && (
          <label className="field inline">
            <span>Set level</span>
            <select
              value={cityLevel}
              onChange={(e) => handleLevelChange(Number(e.target.value) as DisasterLevel)}
            >
              {([1, 2, 3, 4, 5] as DisasterLevel[]).map((l) => (
                <option key={l} value={l}>
                  {l} · {LEVELS[l].name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
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

        <button
          type="button"
          onClick={() => setIsCalendarOpen(true)}
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
          🗓️ Calendrier
        </button>

        <div className="field inline">
          <span>Role</span>
          <b>
            {user.role} — {ROLE_LABELS[user.role]}
            {user.quarter ? ` · ${user.quarter}` : ''}
          </b>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
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
            type="button"
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

      <p className="live-banner" role="status">
        {bannerText}
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
            <QuarterPanel code={selected} stocks={city.stocks} loweredRetention={loweredRetention} />
          </aside>
        </main>
      )}

      <ResourceHistoryModal
        isOpen={isResourceModalOpen}
        onClose={() => setIsResourceModalOpen(false)}
        user={user}
        stocks={city.stocks}
        transfers={city.transfers}
        onChanged={city.reload}
      />

      <CalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        disasters={city.disasters}
      />

      <DisasterAlertModal
        alert={disasterAlerts.current}
        pendingCount={disasterAlerts.pendingCount}
        onDismiss={disasterAlerts.dismiss}
        onShowQuarter={handleShowDisasterQuarter}
      />

      <Chat currentUser={{ name: user.name, role: user.role }} messages={city.messages} onSendMessage={handleSendMessage} />
    </div>
  );
}