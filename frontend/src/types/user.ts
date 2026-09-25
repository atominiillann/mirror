import type { QuarterCode, Role } from '../data/city';


export interface User {
    name: string;
    email: string;
    role: Role;
    quarter?: QuarterCode;
}