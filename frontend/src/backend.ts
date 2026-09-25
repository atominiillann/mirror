import type { DisasterLevel, QuarterCode, Role } from './data/city';
import type { User } from './types/user';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
export const WS_URL: string = API_URL.replace(/^http/, 'ws') + '/ws';

interface Session {
    token: string;
    user: User;
}

export function loadSession(): Session | null {
    try {
        return JSON.parse(sessionStorage.getItem('kaiju') ?? 'null');
    } catch {
        return null;
    }
}

export function clearSession(): void {
    sessionStorage.removeItem('kaiju');
}

async function call<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const token = loadSession()?.token;
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
        response = await fetch(API_URL + path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new Error(
            `impossible de joindre ${API_URL} (back-end arrêté, ou adresse du site absente de CORS_ORIGINS)`,
        );
    }

    const data: unknown = await response.json().catch(() => null);

    if (response.status === 401 && token) {
        clearSession();
        window.location.reload();
    }

    if (!response.ok) {
        const detail = (data as { detail?: unknown } | null)?.detail;
        if (typeof detail === 'string') throw new Error(detail);
        if (Array.isArray(detail)) throw new Error(detail.map((d: { msg?: string }) => d.msg).join(' / '));
        throw new Error(`Erreur ${response.status}`);
    }
    return data as T;
}

export interface Stock {
    district_code: QuarterCode;
    resource_name: string;
    initial_quantity: number;
    min_retention: number;
    current_quantity: number;
}

export interface Transfer {
    id: number;
    resource: string;
    quantity: number;
    source: QuarterCode;
    target: QuarterCode;
    intermediary: QuarterCode | null;
    status: 'pending' | 'in_transit' | 'done' | 'rejected';
    arrives_at: string | null;
    created_at: string;
    requested_by?: string | null;
}

export interface NewTransfer {
    resource_type: string;
    quantity: number;
    source_quarter: QuarterCode;
    target_quarter: QuarterCode;
    use_sea_route: boolean;
    intermediary?: QuarterCode;
}

export type TransferResult =
    | { status: 'in_transit'; travel_seconds: number }
    | { status: 'pending'; id: number; message: string };

export async function login(email: string, password: string): Promise<User> {
    const r = await call<{
        access_token: string;
        username: string;
        name: string;
        role: Role;
        neighborhood_code: QuarterCode | null;
    }>('/login', 'POST', { username: email, password });

    const user: User = {
        name: r.name || r.username,
        email: r.username,
        role: r.role,
        quarter: r.neighborhood_code ?? undefined,
    };
    sessionStorage.setItem('kaiju', JSON.stringify({ token: r.access_token, user }));
    return user;
}

export function register(name: string, email: string, password: string, quarter: QuarterCode) {
    return call('/register', 'POST', { name, email, password, neighborhood_code: quarter });
}

export async function getStocks(): Promise<Stock[]> {
    const data = await call<{ resources: Stock[] }>('/resources');
    return data.resources;
}

export async function getTransfers(): Promise<Transfer[]> {
    const data = await call<{ transfers: Transfer[] }>('/transfers');
    return data.transfers;
}

export async function getLevel(): Promise<DisasterLevel> {
    const data = await call<{ level: DisasterLevel }>('/crisis-level');
    return data.level;
}

export function setLevel(level: DisasterLevel) {
    return call(`/crisis-level?level=${level}`, 'PATCH');
}

export function createTransfer(t: NewTransfer): Promise<TransferResult> {
    const { intermediary, ...rest } = t;
    return call('/transfers', 'POST', intermediary ? t : rest);
}

export function approveTransfer(id: number) {
    return call(`/transfers/${id}/approve`, 'POST');
}

export type DisasterType = 'kaiju_attack' | 'earthquake' | 'tsunami' | 'fire' | 'flood';

export interface Disaster {
    type: DisasterType;
    district: QuarterCode;
    losses: number;
    at: string;
}

export async function getDisasters(): Promise<Disaster[]> {
    const data = await call<{ disasters: Disaster[] }>('/calendar');
    return data.disasters;
}

export interface ChatMessageFromServer {
    id: number;
    sender: string;
    role: Role;
    text: string;
    created_at: string;
}

export async function getMessages(): Promise<ChatMessageFromServer[]> {
    const data = await call<{ messages: ChatMessageFromServer[] }>('/messages');
    return data.messages;
}

export function sendMessage(text: string) {
    return call<ChatMessageFromServer>('/messages', 'POST', { text });
}

export function parseServerDate(value: string): number {
    const hasZone = /Z|[+-]\d\d:\d\d$/.test(value);
    return new Date(hasZone ? value : value.slice(0, 23) + 'Z').getTime();
}

export function formatTime(value: string | null): string {
    if (!value) return '—';
    const ms = parseServerDate(value);
    return Number.isNaN(ms) ? '—' : new Date(ms).toLocaleTimeString('fr-FR');
}