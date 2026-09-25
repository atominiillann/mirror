import React, { useState } from 'react';
import type { Role } from '../data/city';
import './Chat.css';

export interface ChatMessage {
    id: string;
    senderName: string;
    senderRole: Role;
    text: string;
    timestamp: string;
}

interface ChatProps {
    currentUser: { name: string; role: Role };
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
}

export default function Chat({ currentUser, messages, onSendMessage }: ChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [inputMessage, setInputMessage] = useState('');

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim()) return;

        onSendMessage(inputMessage.trim());
        setInputMessage('');
    };

    return (
        <div className={`chat-widget ${isOpen ? 'open' : 'closed'}`}>

            <div className="chat-header" onClick={() => setIsOpen(!isOpen)}>
                <div className="chat-title">
                    <span className="live-indicator">●</span> CHAT ALL — Fréquence Opérationnelle
                </div>
                <button className="toggle-btn">{isOpen ? '▼' : '▲'}</button>
            </div>


            {isOpen && (
                <div className="chat-body">
                    <div className="messages-list">
                        {messages.length === 0 ? (
                            <div className="no-messages">Aucun message. Canal sécurisé ouvert.</div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`message-item ${msg.senderName === currentUser.name ? 'own-message' : ''
                                        }`}
                                >
                                    <div className="message-meta">
                                        <span className="sender-role">[{msg.senderRole}]</span>
                                        <span className="sender-name">{msg.senderName}</span>
                                        <span className="timestamp">{msg.timestamp}</span>
                                    </div>
                                    <div className="message-text">{msg.text}</div>
                                </div>
                            ))
                        )}
                    </div>

                    <form onSubmit={handleSend} className="chat-input-form">
                        <input
                            type="text"
                            placeholder="Envoyer un message au canal général..."
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                        />
                        <button type="submit">Envoyer</button>
                    </form>
                </div>
            )}
        </div>
    );
}