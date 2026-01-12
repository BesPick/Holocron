import type { Group, Portfolio } from '@/lib/org';

export {};

export type Roles = 'admin' | '';

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Roles;
      group?: Group | null;
      portfolio?: Portfolio | null;
    };
  }
}
