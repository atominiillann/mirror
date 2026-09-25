import type { QuarterCode } from '../data/city';

export interface DisasterAlert {
    id: number;
    type: string;
    district: QuarterCode;
    losses: number;
    blockedSeconds: number;
    receivedAt: string;
}