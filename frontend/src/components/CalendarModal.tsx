import { useState } from 'react';
import * as backend from '../backend';
import type { Disaster, DisasterType } from '../backend';
import { QUARTERS, QUARTER_CODES, type QuarterCode } from '../data/city';

import './ResourceHistoryModal.css';

interface CalendarModalProps {
    isOpen: boolean;
    onClose: () => void;
    disasters: Disaster[];
}

const DISASTER_LABELS: Record<DisasterType, string> = {
    kaiju_attack: 'Attaque de kaiju',
    earthquake: 'Séisme',
    tsunami: 'Tsunami',
    fire: 'Incendie',
    flood: 'Inondation',
};

const CUTS_ROADS: DisasterType[] = ['kaiju_attack', 'earthquake', 'tsunami'];

function formatDay(iso: string): string {
    const ms = backend.parseServerDate(iso);
    if (Number.isNaN(ms)) return 'Date inconnue';
    return new Date(ms).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default function CalendarModal({ isOpen, onClose, disasters }: CalendarModalProps) {
    const [quarter, setQuarter] = useState<QuarterCode | ''>('');

    if (!isOpen) return null;

    const shown = quarter ? disasters.filter((d) => d.district === quarter) : disasters;

    const days: { day: string; items: Disaster[] }[] = [];
    for (const d of shown) {
        const day = formatDay(d.at);
        const last = days[days.length - 1];
        if (last && last.day === day) last.items.push(d);
        else days.push({ day, items: [d] });
    }

    const totalLosses = shown.reduce((sum, d) => sum + d.losses, 0);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="calendar-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h3 id="calendar-modal-title">Calendrier des catastrophes</h3>
                    <button type="button" className="close-btn" onClick={onClose} aria-label="Fermer">
                        ✕
                    </button>
                </div>

                <div className="modal-body">
                    <label className="form-field" style={{ display: 'grid', gap: '4px', marginBottom: '12px' }}>
                        <span>Quartier</span>
                        <select value={quarter} onChange={(e) => setQuarter(e.target.value as QuarterCode | '')}>
                            <option value="">Tous les quartiers</option>
                            {QUARTER_CODES.map((q) => (
                                <option key={q} value={q}>
                                    {q} · {QUARTERS[q].name}
                                </option>
                            ))}
                        </select>
                    </label>

                    {shown.length === 0 ? (
                        <div className="no-data">
                            {quarter
                                ? `Aucune catastrophe sur le quartier ${quarter}.`
                                : 'Aucune catastrophe enregistrée.'}
                        </div>
                    ) : (
                        <>
                            <p className="muted">
                                {shown.length} catastrophe{shown.length > 1 ? 's' : ''} · {totalLosses} ressources
                                détruites au total
                            </p>

                            {days.map(({ day, items }) => (
                                <section key={day} style={{ marginBottom: '16px' }}>
                                    <h4 style={{ textTransform: 'capitalize' }}>{day}</h4>
                                    <table className="history-table">
                                        <thead>
                                            <tr>
                                                <th>Heure</th>
                                                <th>Type</th>
                                                <th>Quartier</th>
                                                <th>Pertes</th>
                                                <th>Routes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((d, i) => (
                                                <tr key={`${d.at}-${i}`}>
                                                    <td>{backend.formatTime(d.at)}</td>
                                                    <td>{DISASTER_LABELS[d.type] ?? d.type}</td>
                                                    <td>
                                                        <strong>{d.district}</strong>{' '}
                                                        <span className="muted">{QUARTERS[d.district]?.name}</span>
                                                    </td>
                                                    <td>{d.losses}</td>
                                                    <td>
                                                        {CUTS_ROADS.includes(d.type) ? (
                                                            <span className="badge badge-refused">Coupées</span>
                                                        ) : (
                                                            <span className="muted">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </section>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}