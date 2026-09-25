import { useState, type FormEvent } from 'react';
import * as backend from '../backend';
import { QUARTER_CODES, type QuarterCode } from '../data/city';
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
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!email || !password || (isRegister && !name)) {
            setError('Veuillez remplir tous les champs.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            // Inscription : on crée le compte (le serveur lui donne le rôle QC), puis on se connecte
            if (isRegister) {
                await backend.register(name, email, password, quarter);
            }
            // Connexion : le serveur vérifie le mot de passe et renvoie le rôle et le quartier
            const user = await backend.login(email, password);
            onLogin(user);
        } catch (err) {
            // Message du serveur, ex. "Authentication failed: invalid credentials."
            setError((err as Error).message);
            setLoading(false);
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

                {error && (
                    <div className="login-error" role="alert">
                        {error}
                    </div>
                )}

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

                    {/* Choix de la ZONE (inscription uniquement). Plus de choix du rôle : c'est le serveur qui décide. */}
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

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Connexion…' : isRegister ? "S'inscrire" : 'Se connecter'}
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