import React, { useState } from 'react';
import { QUARTER_CODES, ROLE_LABELS, type QuarterCode, type Role } from '../data/city';
import type { User } from '../types/user';
import './Login.css';

interface LoginProps {
    onLogin: (user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
    // Mode : 'login' ou 'register'
    const [isRegister, setIsRegister] = useState(false);

    // Champs du formulaire
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [quarter, setQuarter] = useState<QuarterCode>('A');
    const [role, setRole] = useState<Role>('QC');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (isRegister) {
            // Validation Inscription
            if (!name || !email || !password) {
                setError('Veuillez remplir tous les champs.');
                return;
            }
            onLogin({
                name: name,
                email: email,
                role: role,
                quarter: quarter,
            });
        } else {
            // Validation Connexion
            if (!email || !password) {
                setError('Veuillez remplir tous les champs.');
                return;
            }
            // Pas encore de back-end pour retrouver le rôle du compte :
            // on démarre en QC (modifiable ensuite dans la barre du haut).
            onLogin({
                name: email.split('@')[0] || 'Opérateur',
                email: email,
                role: 'QC',
            });
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="brand">
                    KAIJU_<span>&lt; CRISIS MANAGER /&gt;</span>
                </div>
                <h2>{isRegister ? 'Créer un Compte' : 'Connexion au Système'}</h2>
                <p className="muted">
                    {isRegister
                        ? 'Enregistrement d’un nouvel agent d’intervention.'
                        : 'Accès restreint aux autorités de régulation de crise.'}
                </p>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    {/* Champ NOM (affiché uniquement lors de l'inscription) */}
                    {isRegister && (
                        <label className="field-group">
                            <span>Nom</span>
                            <input
                                type="text"
                                placeholder="Agent Dupont"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </label>
                    )}

                    {/* Champ E-MAIL */}
                    <label className="field-group">
                        <span>E-mail</span>
                        <input
                            type="email"
                            placeholder="agent@kaiju-response.gov"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </label>

                    {/* Champ MOT DE PASSE */}
                    <label className="field-group">
                        <span>Mot de passe</span>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </label>

                    {/* Choix du RÔLE (affiché uniquement lors de l'inscription) */}
                    {isRegister && (
                        <label className="field-group">
                            <span>Rôle</span>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value as Role)}
                            >
                                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                                    <option key={r} value={r}>
                                        {r} — {ROLE_LABELS[r]}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {/* Choix de la ZONE (affiché uniquement lors de l'inscription) */}
                    {isRegister && (
                        <label className="field-group">
                            <span>Zone d'affectation</span>
                            <select
                                value={quarter}
                                onChange={(e) => setQuarter(e.target.value as QuarterCode)}
                            >
                                {QUARTER_CODES.map((code) => (
                                    <option key={code} value={code}>
                                        Zone {code}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    <button type="submit" className="login-btn">
                        {isRegister ? "S'inscrire" : 'Se connecter'}
                    </button>
                </form>

                {/* Lien de bascule entre Login et Register */}
                <div className="toggle-auth">
                    <span>
                        {isRegister ? 'Déjà un compte ?' : "Vous n'avez pas de compte ?"}
                    </span>
                    <button
                        type="button"
                        className="toggle-auth-btn"
                        onClick={() => {
                            setIsRegister(!isRegister);
                            setError('');
                        }}
                    >
                        {isRegister ? 'Se connecter' : "S'inscrire"}
                    </button>
                </div>
            </div>
        </div>
    );
}