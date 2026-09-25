import { useEffect, useRef } from 'react';
import { QUARTERS, type QuarterCode } from '../data/city';
import type { DisasterAlert } from '../types/disasters';
import './DisasterAlertModal.css';

const DISASTER_LABELS: Record<string, { label: string; icon: string }> = {
    kaiju_attack: { label: 'Attaque de kaiju', icon: '🦖' },
    earthquake: { label: 'Séisme', icon: '🏚️' },
    tsunami: { label: 'Tsunami', icon: '🌊' },
    fire: { label: 'Incendie', icon: '🔥' },
    flood: { label: 'Inondation', icon: '💧' },
};

function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    if (minutes === 0) return `${rest} s`;
    return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} s`;
}

const plural = (n: number) => (n > 1 ? 's' : '');

interface Props {
    alert: DisasterAlert | null;
    pendingCount: number;
    onDismiss: () => void;
    onShowQuarter: (code: QuarterCode) => void;
}

export default function DisasterAlertModal({ alert, pendingCount, onDismiss, onShowQuarter }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const mainButtonRef = useRef<HTMLButtonElement>(null);
    const alertId = alert?.id ?? null;

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (alertId === null) {
            if (dialog.open) dialog.close();
            return;
        }

        if (dialog.open) dialog.close();
        dialog.showModal();
        mainButtonRef.current?.focus();
    }, [alertId]);

    const info = alert ? (DISASTER_LABELS[alert.type] ?? { label: alert.type, icon: '⚠️' }) : null;
    const quarter = alert ? QUARTERS[alert.district] : null;

    return (
        <dialog
            ref={dialogRef}
            className="disaster-dialog"
            role="alertdialog"
            aria-labelledby="disaster-title"
            aria-describedby="disaster-details"
            onCancel={(e) => {

                e.preventDefault();
                onDismiss();
            }}
        >
            {alert && info && quarter && (
                <>
                    <div className="disaster-hazard" aria-hidden="true" />

                    <header className="disaster-head">
                        <span className="disaster-icon" aria-hidden="true">
                            {info.icon}
                        </span>
                        <div>
                            <h2 id="disaster-title">
                                {info.label} à {quarter.name}
                            </h2>
                            <p className="disaster-time">Alerte reçue à {alert.receivedAt}</p>
                        </div>
                        <span className="disaster-quarter" style={{ background: quarter.color }} aria-hidden="true">
                            {alert.district}
                        </span>
                    </header>

                    <div id="disaster-details" className="disaster-details">
                        <p>
                            {alert.losses === 0 ? (
                                'Aucune ressource détruite.'
                            ) : (
                                <>
                                    <strong>{alert.losses}</strong>{' '}
                                    {`unité${plural(alert.losses)} de ressources détruite${plural(alert.losses)} dans le quartier.`}
                                </>
                            )}
                        </p>
                        <p>
                            {alert.blockedSeconds > 0 ? (
                                <>
                                    Routes terrestres coupées pendant <strong>{formatDuration(alert.blockedSeconds)}</strong> : aucun
                                    transfert par la route vers ou depuis {quarter.name}.
                                </>
                            ) : (
                                'Les routes restent praticables.'
                            )}
                        </p>
                    </div>

                    <footer className="disaster-actions">
                        {pendingCount > 0 && (
                            <p className="disaster-queue">
                                {pendingCount} autre{plural(pendingCount)} alerte{plural(pendingCount)} en attente
                            </p>
                        )}
                        <button type="button" className="disaster-btn secondary" onClick={onDismiss}>
                            Fermer
                        </button>
                        <button
                            ref={mainButtonRef}
                            type="button"
                            className="disaster-btn primary"
                            onClick={() => onShowQuarter(alert.district)}
                        >
                            Voir sur la carte
                        </button>
                    </footer>
                </>
            )}
        </dialog>
    );
}