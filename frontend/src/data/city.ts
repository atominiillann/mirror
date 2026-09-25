export type QuarterCode = 'A' | 'E' | 'W' | 'X' | 'Z';
export type Role = 'QC' | 'LC' | 'CD';
export type DisasterLevel = 1 | 2 | 3 | 4 | 5;

export const RESOURCE_TYPES = [
  'Medical personnel',
  'Rescue teams',
  'Transport vehicles',
  'Emergency shelters',
  'Food & water supplies',
  'Communication equipment',
  'Power generators',
  'Engineering crews',
  'Security units',
  'Hazmat equipment',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface Quarter {
  code: QuarterCode;
  name: string;
  color: string;
  seaAccess: boolean;
  hub: boolean;
  labelAt: { x: number; y: number };
  stock: Record<ResourceType, number>;
}

const stock = (values: number[]): Record<ResourceType, number> =>
  Object.fromEntries(RESOURCE_TYPES.map((r, i) => [r, values[i]])) as Record<ResourceType, number>;

export const QUARTERS: Record<QuarterCode, Quarter> = {
  A: {
    code: 'A',
    name: 'Apex',
    color: '#ff2740',
    seaAccess: false,
    hub: false,
    labelAt: { x: 198, y: 250 },
    stock: stock([12, 4, 6, 8, 5, 3, 7, 2, 9, 3]),
  },
  E: {
    code: 'E',
    name: 'Echo',
    color: '#19e06a',
    seaAccess: true,
    hub: false,
    labelAt: { x: 668, y: 170 },
    stock: stock([5, 9, 3, 6, 8, 7, 2, 6, 4, 5]),
  },
  W: {
    code: 'W',
    name: 'Warden',
    color: '#ff8c1a',
    seaAccess: false,
    hub: false,
    labelAt: { x: 228, y: 500 },
    stock: stock([8, 3, 10, 4, 6, 5, 9, 7, 2, 4]),
  },
  X: {
    code: 'X',
    name: 'Xeno',
    color: '#f5e70b',
    seaAccess: true,
    hub: true,
    labelAt: { x: 462, y: 355 },
    stock: stock([3, 6, 4, 10, 7, 8, 5, 4, 6, 2]),
  },
  Z: {
    code: 'Z',
    name: 'Zion',
    color: '#4bb8e8',
    seaAccess: true,
    hub: false,
    labelAt: { x: 420, y: 700 },
    stock: stock([7, 5, 7, 2, 9, 4, 6, 8, 3, 10]),
  },
};

export const QUARTER_CODES: QuarterCode[] = ['A', 'E', 'W', 'X', 'Z'];

/** Land adjacency between quarters (authoritative matrix from the rules annex). */
export const ADJACENCY: Record<QuarterCode, QuarterCode[]> = {
  A: ['E', 'W', 'X'],
  E: ['A', 'X'],
  W: ['A', 'X', 'Z'],
  X: ['A', 'E', 'W', 'Z'],
  Z: ['W', 'X'],
};

/** Quarters bordering Tokyork Bay: maritime route, higher capacity, doubled delivery time. */
export const SEA_ROUTE: QuarterCode[] = ['E', 'X', 'Z'];

export const RETENTION_RATE = 0.3;
export const RETENTION_RATE_LOWERED = 0.15;

export const minRetention = (initial: number, lowered = false): number =>
  Math.ceil(initial * (lowered ? RETENTION_RATE_LOWERED : RETENTION_RATE));

export interface LevelInfo {
  level: DisasterLevel;
  name: string;
  description: string;
  color: string;
}

export const LEVELS: Record<DisasterLevel, LevelInfo> = {
  1: {
    level: 1,
    name: 'Watch',
    description: 'Monitoring phase. No reservation allowed. Resources stay in place.',
    color: '#4ade80',
  },
  2: {
    level: 2,
    name: 'Alert',
    description: 'Reservations within own quarter only. No inter-quarter transfers.',
    color: '#facc15',
  },
  3: {
    level: 3,
    name: 'Emergency',
    description: 'Transfers between adjacent quarters authorized. QC approval required.',
    color: '#fb923c',
  },
  4: {
    level: 4,
    name: 'Critical',
    description: 'Extended transfers (adjacent + transit). LC can initiate chains. CD can requisition.',
    color: '#ef4444',
  },
  5: {
    level: 5,
    name: 'Catastrophic',
    description: 'All transfers unlocked. CD can lower retention to 15%. Maritime route prioritized.',
    color: '#a855f7',
  },
};

export interface PermissionRow {
  action: string;
  byLevel: Record<DisasterLevel, Role[] | 'all' | null>;
}

export const PERMISSIONS: PermissionRow[] = [
  { action: 'View resources', byLevel: { 1: 'all', 2: 'all', 3: 'all', 4: 'all', 5: 'all' } },
  {
    action: 'Reserve within own quarter',
    byLevel: { 1: null, 2: ['QC'], 3: ['QC'], 4: ['QC'], 5: ['QC'] },
  },
  {
    action: 'Request adjacent transfer',
    byLevel: { 1: null, 2: null, 3: ['QC'], 4: ['QC', 'LC'], 5: 'all' },
  },
  { action: 'Organize transit', byLevel: { 1: null, 2: null, 3: null, 4: ['LC'], 5: ['LC', 'CD'] } },
  { action: 'Requisition', byLevel: { 1: null, 2: null, 3: null, 4: ['CD'], 5: ['CD'] } },
  { action: 'Lower retention threshold', byLevel: { 1: null, 2: null, 3: null, 4: null, 5: ['CD'] } },
];

export const ROLE_LABELS: Record<Role, string> = {
  QC: 'Quarter Coordinator',
  LC: 'Logistics Coordinator',
  CD: 'City Director',
};

export const isAllowed = (action: string, role: Role, level: DisasterLevel): boolean => {
  const row = PERMISSIONS.find((p) => p.action === action);
  if (!row) return false;
  const allowed = row.byLevel[level];
  if (allowed === null) return false;
  if (allowed === 'all') return true;
  return allowed.includes(role);
};
