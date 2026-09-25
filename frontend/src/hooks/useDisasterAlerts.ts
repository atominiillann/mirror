import { useCallback, useEffect, useState } from 'react';
import { QUARTER_CODES, type QuarterCode } from '../data/city';
import type { DisasterAlert } from '../types/disasters';

const WS_URL: string = import.meta.env.VITE_WS_URL ?? `ws://${window.location.hostname}:3000/ws`;

const RECONNECT_DELAY_MS = 3000;

export type SocketStatus = 'connecting' | 'online' | 'offline';

let nextAlertId = 1;

function parseDisasterMessage(raw: unknown): DisasterAlert | null {
    if (typeof raw !== 'string') return null;

    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof data !== 'object' || data === null) return null;

    const message = data as Record<string, unknown>;
    if (message.event !== 'disaster') return null;
    if (!QUARTER_CODES.includes(message.district as QuarterCode)) return null;

    return {
        id: nextAlertId++,
        type: String(message.type),
        district: message.district as QuarterCode,
        losses: Number(message.losses) || 0,
        blockedSeconds: Number(message.blocked_seconds) || 0,
        receivedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };
}

export function useDisasterAlerts(enabled: boolean) {
    const [queue, setQueue] = useState<DisasterAlert[]>([]);
    const [status, setStatus] = useState<SocketStatus>('connecting');

    useEffect(() => {
        if (!enabled) return;

        let socket: WebSocket;
        let retryTimer: number | undefined;
        let stopped = false;

        const connect = () => {
            socket = new WebSocket(WS_URL);
            socket.onopen = () => setStatus('online');
            socket.onmessage = (event) => {
                const alert = parseDisasterMessage(event.data);
                if (alert) setQueue((current) => [...current, alert]);
            };
            socket.onclose = () => {
                if (stopped) return;
                setStatus('offline');
                retryTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
            };
        };

        setStatus('connecting');
        connect();

        return () => {
            stopped = true;
            window.clearTimeout(retryTimer);
            const current = socket;
            current.onmessage = null;
            if (current.readyState === WebSocket.CONNECTING) {
                current.onopen = () => current.close();
            } else {
                current.close();
            }
            setQueue([]);
        };
    }, [enabled]);

    const dismiss = useCallback(() => setQueue((current) => current.slice(1)), []);

    return {
        current: queue[0] ?? null,
        pendingCount: Math.max(queue.length - 1, 0),
        status,
        dismiss,
    };
}