import { useCallback, useEffect, useState } from 'react';
import * as backend from '../backend';
import type { ChatMessage } from '../components/Chat';
import type { DisasterLevel } from '../data/city';

function toChatMessage(m: backend.ChatMessageFromServer): ChatMessage {
    return {
        id: String(m.id),
        senderName: m.sender,
        senderRole: m.role,
        text: m.text,
        timestamp: backend.formatTime(m.created_at),
    };
}

export function useKaiju(loggedIn: boolean) {
    const [stocks, setStocks] = useState<backend.Stock[]>([]);
    const [transfers, setTransfers] = useState<backend.Transfer[]>([]);
    const [level, setLevel] = useState<DisasterLevel>(1);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [disasters, setDisasters] = useState<backend.Disaster[]>([]);
    const [error, setError] = useState('');

    const [notice, setNotice] = useState('');

    const reload = useCallback(async () => {
        const [s, t, l, m, d] = await Promise.allSettled([
            backend.getStocks(),
            backend.getTransfers(),
            backend.getLevel(),
            backend.getMessages(),
            backend.getDisasters(),
        ]);
        if (s.status === 'fulfilled') setStocks(s.value);
        if (t.status === 'fulfilled') setTransfers(t.value);
        if (l.status === 'fulfilled') setLevel(l.value);
        if (m.status === 'fulfilled') setMessages(m.value.map(toChatMessage));
        if (d.status === 'fulfilled') setDisasters(d.value);

        const errors: string[] = [];
        if (s.status === 'rejected') errors.push(`Stocks (GET /resources) : ${(s.reason as Error).message}`);
        if (t.status === 'rejected') errors.push(`Historique (GET /transfers) : ${(t.reason as Error).message}`);
        if (l.status === 'rejected') errors.push(`Niveau (GET /crisis-level) : ${(l.reason as Error).message}`);
        if (m.status === 'rejected') errors.push(`Chat (GET /messages) : ${(m.reason as Error).message}`);
        if (d.status === 'rejected') errors.push(`Calendrier (GET /calendar) : ${(d.reason as Error).message}`);
        setError(errors.join(' — '));
    }, []);

    useEffect(() => {
        if (loggedIn) reload();
    }, [loggedIn, reload]);

    useEffect(() => {
        if (!loggedIn) return;
        let socket: WebSocket;
        let retryTimer: number;
        let stopped = false;

        const connect = () => {
            socket = new WebSocket(backend.WS_URL);

            socket.onmessage = (e) => {
                const msg = JSON.parse(e.data);
                switch (msg.event) {
                    case 'crisis_level_alert':
                        setLevel(msg.level);
                        setNotice(`Niveau de crise passé à ${msg.level}.`);
                        break;

                    case 'transfer_departed':
                        setNotice(`Convoi parti : ${msg.resource}, de ${msg.source} vers ${msg.target}.`);
                        reload();
                        break;
                    case 'resource_update':
                        setNotice(`Transfert livré : ${msg.quantity} × ${msg.resource}, vers ${msg.target}.`);
                        reload();
                        break;
                    case 'transfer_pending':
                        setNotice(`Demande n° ${msg.id} en attente de l'accord du quartier ${msg.intermediary}.`);
                        reload();
                        break;

                    case 'transfer_conflict':
                    case 'transfer_denied':
                        setNotice(`Transfert refusé : ${msg.reason}`);
                        break;

                    case 'chat_message':
                        setMessages((list) => {
                            if (list.some((x) => x.id === String(msg.id))) return list;
                            return [...list, toChatMessage(msg)];
                        });
                        break;
                    case 'city_reset':
                        setNotice('Ville remise à zéro par le City Director.');
                        reload();
                        break;
                    case 'disaster':
                        reload();
                        break;
                }
            };

            socket.onclose = () => {
                if (!stopped) retryTimer = window.setTimeout(connect, 3000);
            };
        };

        connect();
        return () => {
            stopped = true;
            window.clearTimeout(retryTimer);
            socket.close();
        };
    }, [loggedIn, reload]);

    const convoyOnTheWay = transfers.some((t) => t.status === 'in_transit');
    useEffect(() => {
        if (!loggedIn || !convoyOnTheWay) return;
        const timer = window.setInterval(reload, 5000);
        return () => window.clearInterval(timer);
    }, [loggedIn, convoyOnTheWay, reload]);

    useEffect(() => {
        if (!notice) return;
        const timer = window.setTimeout(() => setNotice(''), 8000);
        return () => window.clearTimeout(timer);
    }, [notice]);

    return { stocks, transfers, level, messages, disasters, error, notice, reload };
}