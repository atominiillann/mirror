import type { QuarterCode, ResourceType } from '../data/city';

export type TransferStatus = 'approved' | 'pending' | 'refused';

/** Un transfert (ou une demande de transfert) de ressources entre deux quartiers. */
export interface TransferRecord {
    id: string;
    timestamp: string;
    fromQuarter: QuarterCode;
    toQuarter: QuarterCode;
    resource: ResourceType;
    quantity: number;
    status: TransferStatus;
    requestedBy: string;
}


export type NewTransfer = Omit<TransferRecord, 'id' | 'timestamp'>;