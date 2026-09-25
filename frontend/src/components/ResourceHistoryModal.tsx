import { useState } from 'react';
import { QUARTER_CODES, RESOURCE_TYPES, type QuarterCode, type ResourceType } from '../data/city';
import type { NewTransfer, TransferRecord } from '../types/resources';
import './ResourceHistoryModal.css';

interface ResourceHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    transfers?: TransferRecord[];
    onAddTransfer?: (newTransfer: NewTransfer) => void;
}

export default function ResourceHistoryModal({
    isOpen,
    onClose,
    transfers = [],
    onAddTransfer,
}: ResourceHistoryModalProps) {
    const [activeTab, setActiveTab] = useState<'transfers' | 'requests'>('transfers');

    // Formulaire pour l'envoi / demande de ressources
    const [fromQuarter, setFromQuarter] = useState<QuarterCode>('E');
    const [toQuarter, setToQuarter] = useState<QuarterCode>('A');
    const [resource, setResource] = useState<ResourceType>(RESOURCE_TYPES[0]);
    const [quantity, setQuantity] = useState<number>(1);

    if (!isOpen) return null;

    const safeTransfers = transfers || [];
    const completedTransfers = safeTransfers.filter((t) => t.status === 'approved');
    const requests = safeTransfers.filter((t) => t.status === 'pending' || t.status === 'refused');

    // Filtrer les pays pour éviter d'envoyer vers soi-même
    const availableDestinations = QUARTER_CODES.filter((code) => code !== fromQuarter);

    const handleSubmitRequest = (e: React.FormEvent) => {
        e.preventDefault();
        if (quantity <= 0) return;

        if (onAddTransfer) {
            onAddTransfer({
                fromQuarter,
                toQuarter,
                resource,
                quantity,
                status: 'pending',
                requestedBy: `Opérateur ${fromQuarter}`,
            });
        }

        // Réinitialisation / notification
        alert(`Demande d'envoi de ${quantity} x ${resource} de ${fromQuarter} vers ${toQuarter} enregistrée !`);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Flux des Ressources</h3>
                    <button className="close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                {/* Choix entre les 2 options */}
                <div className="modal-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'transfers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('transfers')}
                    >
                        1. Historique des transferts ({completedTransfers.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                        onClick={() => setActiveTab('requests')}
                    >
                        2. Demandes & Envois entre quartiers ({requests.length})
                    </button>
                </div>

                <div className="modal-body">
                    {activeTab === 'transfers' ? (
                        /* OPTION 1: Historique des transferts effectifs */
                        completedTransfers.length === 0 ? (
                            <div className="no-data">Aucun transfert effectué.</div>
                        ) : (
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Date / Heure</th>
                                        <th>Origine</th>
                                        <th>Destination</th>
                                        <th>Ressource</th>
                                        <th>Quantité</th>
                                        <th>Initié par</th>
                                        <th>Statut</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {completedTransfers.map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.timestamp}</td>
                                            <td>
                                                <strong>{item.fromQuarter}</strong>
                                            </td>
                                            <td>
                                                <strong>{item.toQuarter}</strong>
                                            </td>
                                            <td>{item.resource}</td>
                                            <td>{item.quantity}</td>
                                            <td>{item.requestedBy}</td>
                                            <td>
                                                <span className="badge badge-approved">Transféré</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        /* OPTION 2: Créer un envoi / demande entre quartiers */
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
                                            {availableDestinations.map((q) => (
                                                <option key={q} value={q}>
                                                    Quartier {q}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="form-field">
                                        <span>Type de Ressource</span>
                                        <select
                                            value={resource}
                                            onChange={(e) => setResource(e.target.value as ResourceType)}
                                        >
                                            {RESOURCE_TYPES.map((r) => (
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
                                            max={100}
                                            value={quantity}
                                            onChange={(e) => setQuantity(Number(e.target.value))}
                                            required
                                        />
                                    </label>
                                </div>

                                <button type="submit" className="submit-request-btn">
                                    Envoyer la demande
                                </button>
                            </form>

                            <hr className="divider" />

                            <h4>Demandes en cours & Historique</h4>
                            {requests.length === 0 ? (
                                <div className="no-data">Aucune demande enregistrée.</div>
                            ) : (
                                <table className="history-table">
                                    <thead>
                                        <tr>
                                            <th>Date / Heure</th>
                                            <th>Expéditeur</th>
                                            <th>Destinataire</th>
                                            <th>Ressource</th>
                                            <th>Quantité</th>
                                            <th>Demandé par</th>
                                            <th>Statut</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {requests.map((item) => (
                                            <tr key={item.id}>
                                                <td>{item.timestamp}</td>
                                                <td>
                                                    <strong>{item.fromQuarter}</strong>
                                                </td>
                                                <td>
                                                    <strong>{item.toQuarter}</strong>
                                                </td>
                                                <td>{item.resource}</td>
                                                <td>{item.quantity}</td>
                                                <td>{item.requestedBy}</td>
                                                <td>
                                                    {item.status === 'pending' && (
                                                        <span className="badge badge-pending">En attente</span>
                                                    )}
                                                    {item.status === 'refused' && (
                                                        <span className="badge badge-refused">Refusée</span>
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