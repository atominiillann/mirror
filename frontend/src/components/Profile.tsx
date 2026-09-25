import { ROLE_LABELS } from '../data/city';
import type { User } from '../types/user';
import './Profile.css';

interface ProfileProps {
    user: User;
    onLogout: () => void;
    onBackToDashboard: () => void;
}

export default function Profile({ user, onLogout, onBackToDashboard }: ProfileProps) {
    return (
        <div className="profile-container">
            <div className="profile-card">
                <div className="profile-header">
                    <div className="avatar">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h2>{user.name}</h2>
                        <p className="user-email">{user.email || `${user.name.toLowerCase()}@kaiju-response.gov`}</p>
                    </div>
                </div>

                <div className="profile-details">
                    <h3>Informations de l'agent</h3>

                    <div className="detail-item">
                        <span className="label">Rôle d'affectation :</span>
                        <span className="value role-badge">{user.role} — {ROLE_LABELS[user.role]}</span>
                    </div>

                    <div className="detail-item">
                        <span className="label">Niveau d'habilitation :</span>
                        <span className="value">
                            {user.role === 'CD' ? 'Niveau 5 (Directeur)' : 'Niveau 3 (Opérateur)'}
                        </span>
                    </div>

                    <div className="detail-item">
                        <span className="label">Statut du compte :</span>
                        <span className="value status-active">Actif · En service</span>
                    </div>
                </div>

                <div className="profile-actions">
                    <button className="btn-secondary" onClick={onBackToDashboard}>
                        Retour à la carte
                    </button>
                    <button className="btn-danger" onClick={onLogout}>
                        Se déconnecter
                    </button>
                </div>
            </div>
        </div>
    );
}