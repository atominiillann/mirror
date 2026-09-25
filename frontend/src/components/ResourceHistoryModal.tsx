import { useState, type FormEvent } from 'react';
import * as backend from '../backend';
import type { Stock, Transfer } from '../backend';
import { ADJACENCY, QUARTER_CODES, type QuarterCode } from '../data/city';
import type { User } from '../types/user';
import './ResourceHistoryModal.css';

interface ResourceHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    stocks: Stock[];
    transfers: Transfer[];
    /** À appeler après un envoi ou une approbation, pour recharger les données */
    onChanged: () => void;
}

const STATUS_LABELS: Record<Transfer['status'], string> = {
    pending: 'En attente',
    in_transit: 'En route',
    done: 'Livré',
    rejected: 'Annulé',
};

export default function ResourceHistoryModal({
    isOpen,
    onClose,
    user,
    stocks,
    transfers,
    onChanged,
}: ResourceHistoryModalProps) {
    const [activeTab, setActiveTab] = useState<'transfers' | 'requests'>('transfers');

    // Formulaire. Règle du serveur : un QC demande des ressources VERS son propre quartier,
    // donc la destination est son quartier et la source un voisin.
    const home: QuarterCode = user.quarter ?? 'A';
    const [fromQuarter, setFromQuarter] = useState<QuarterCode>(ADJACENCY[home][0]);
    const [toQuarter, setToQuarter] = useState<QuarterCode>(home);
    const [resource, setResource] = useState('');
    const [quantity, setQuantity] = useState<number>(1);
    const [intermediary, setIntermediary] = useState<QuarterCode | ''>('');
    const [useSeaRoute, setUseSeaRoute] = useState(false);

    // Réponse du serveur
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [sending, setSending] = useState(false);

    if (!isOpen) return null;

    // Noms des ressources tels qu'en base (et pas RESOURCE_TYPES) : sinon "Source resource not found"
    const resourceNames = [...new Set(stocks.map((s) => s.resource_name))];
    const selectedResource = resource || resourceNames[0] || '';

    const history = transfers.filter((t) => t.status !== 'pending');
    const requests = transfers.filter((t) => t.status === 'pending');

    // Le QC du quartier de passage, ou le City Director, peut approuver une demande
    const canApprove = (t: Transfer) => user.role === 'CD' || user.quarter === t.intermediary;

    const handleSubmitRequest = async (e: FormEvent) => {
        e.preventDefault();
        setSending(true);
        setError('');
        setSuccess('');
        try {
            // C'est le serveur qui applique toutes les règles : niveau, rôle, voisins, rétention...
            const result = await backend.createTransfer({
                resource_type: selectedResource,
                quantity,
                source_quarter: fromQuarter,
                target_quarter: toQuarter,
                use_sea_route: useSeaRoute,
                intermediary: intermediary || undefined,
            });
            setSuccess(
                result.status === 'pending'
                    ? result.message
                    : `Convoi parti : arrivée dans ${result.travel_seconds} secondes.`,
            );
            onChanged();
        } catch (err) {
            setError((err as Error).message); // message exact du serveur
        }
        setSending(false);
    };

    const handleApprove = async (id: number) => {
        setError('');
        try {
            await backend.approveTransfer(id);
            onChanged();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="resource-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h3 id="resource-modal-title">Flux des Ressources</h3>
                    <button type="button" className="close-btn" onClick={onClose} aria-label="Fermer">
                        ✕
                    </button>
                </div>

                {/* Choix entre les 2 options */}
                <div className="modal-tabs">
                    <button
                        type="button"
                        className={`tab-btn ${activeTab === 'transfers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('transfers')}
                    >
                        1. Historique des transferts ({history.length})
                    </button>
                    <button
                        type="button"
                        className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                    >
                        2. Demandes & Envois entre quartiers ({requests.length})
                    </button>
                </div>

                <div className="modal-body">
                    {activeTab === 'transfers' ? (
                        /* OPTION 1 : historique venant de GET /transfers */
                        history.length === 0 ? (
                            <div className="no-data">Aucun transfert effectué.</div>
                        ) : (
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Heure</th>
                                        <th>Origine</th>
                                        <th>Destination</th>
                                        <th>Ressource</th>
                                        <th>Quantité</th>
                                        <th>Statut</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((t) => (
                                        <tr key={t.id}>
                                            <td>{backend.formatTime(t.created_at)}</td>
                                            <td><strong>{t.source}</strong></td>
                                            <td><strong>{t.target}</strong></td>
                                            <td>{t.resource}</td>
                                            <td>{t.quantity}</td>
                                            <td>
                                                <span className={`badge ${t.status === 'done' ? 'badge-approved' : t.status === 'rejected' ? 'badge-refused' : 'badge-pending'}`}>
                                                    {STATUS_LABELS[t.status]}
                                                    {t.status === 'in_transit' && ` · arrivée ${backend.formatTime(t.arrives_at)}`}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        /* OPTION 2 : nouveau transfert (POST /transfers) + demandes en attente */
                        <div className="requests-container">
                            <form onSubmit={handleSubmitRequest} className="request-form">
                                <h4>Nouveau transfert de ressources</h4>
                                <div className="form-grid">
                                    <label className="form-field">
                                        <span>Quartier Expéditeur (Source)</span>
                                        <select
                                            value={fromQuarter}
                                            onChange={(e) => {
                                                const newFrom = e.target.value as QuarterCode;
                                                setFromQuarter(newFrom);
                                                // Ajuster le quartier de destination si identique
                                                if (toQuarter === newFrom) {
                                                    const other = QUARTER_CODES.find((c) => c !== newFrom);
                                                    if (other) setToQuarter(other);
                                                }
                                            }}
                                        >
                                            {QUARTER_CODES.map((q) => (
                                                <option key={q} value={q}>
                                                    Quartier {q}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="form-field">
                                        <span>Quartier Destinataire</span>
                                        <select
                                            value={toQuarter}
                                            onChange={(e) => setToQuarter(e.target.value as QuarterCode)}
                                        >
                                            {QUARTER_CODES.filter((q) => q !== fromQuarter).map((q) => (
                                                <option key={q} value={q}>
                                                    Quartier {q}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="form-field">
                                        <span>Type de Ressource</span>
                                        <select
                                            value={selectedResource}
                                            onChange={(e) => setResource(e.target.value)}
                                        >
                                            {resourceNames.map((r) => (
                                                <option key={r} value={r}>
                                                    {r}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="form-field">
                                        <span>Quantité</span>
                                        <input
                                            type="number"
                                            min={1}
                                            value={quantity}
                                            onChange={(e) => setQuantity(Number(e.target.value))}
                                            required
                                        />
                                    </label>

                                    {/* Pour deux quartiers non voisins : passer par un quartier voisin des deux */}
                                    <label className="form-field">
                                        <span>Quartier de passage (si non voisins)</span>
                                        <select
                                            value={intermediary}
                                            onChange={(e) => setIntermediary(e.target.value as QuarterCode | '')}
                                        >
                                            <option value="">Aucun</option>
                                            {QUARTER_CODES.filter((q) => q !== fromQuarter && q !== toQuarter).map((q) => (
                                                <option key={q} value={q}>
                                                    Quartier {q}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="form-field">
                                        <span>Route maritime (trajet 2 × plus long)</span>
                                        <input
                                            type="checkbox"
                                            checked={useSeaRoute}
                                            onChange={(e) => setUseSeaRoute(e.target.checked)}
                                        />
                                    </label>
                                </div>

                                {/* Réponse du serveur : refus (avec la règle en cause) ou succès */}
                                {error && (
                                    <p role="alert" style={{ color: '#ff9aa6', whiteSpace: 'pre-line' }}>
                                        {error}
                                    </p>
                                )}
                                {success && (
                                    <p role="status" style={{ color: '#63d5ff' }}>
                                        {success}
                                    </p>
                                )}

                                <button type="submit" className="submit-request-btn" disabled={sending}>
                                    {sending ? 'Envoi…' : 'Envoyer la demande'}
                                </button>
                            </form>

                            <hr className="divider" />

                            <h4>Demandes en attente d'accord</h4>
                            {requests.length === 0 ? (
                                <div className="no-data">Aucune demande en attente.</div>
                            ) : (
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Heure</th>
                                            <th>Expéditeur</th>
                                            <th>Destinataire</th>
                                            <th>Via</th>
                                            <th>Ressource</th>
                                            <th>Quantité</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {requests.map((t) => (
                                            <tr key={t.id}>
                                                <td>{backend.formatTime(t.created_at)}</td>
                                                <td><strong>{t.source}</strong></td>
                                                <td><strong>{t.target}</strong></td>
                                                <td>{t.intermediary}</td>
                                                <td>{t.resource}</td>
                                                <td>{t.quantity}</td>
                                                <td>
                                                    {canApprove(t) ? (
                                                        <button
                                                            type="button"
                                                            className="submit-request-btn"
                                                            onClick={() => handleApprove(t.id)}
                                                        >
                                                            Approuver
                                                        </button>
                                                    ) : (
                                                        <span className="badge badge-pending">
                                                            Attend {t.intermediary}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}