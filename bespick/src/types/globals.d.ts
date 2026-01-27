import type { Group, Portfolio, Rank, RankCategory, Team } from '@/lib/org';

export {};

export type Roles =
  | 'admin'
  | 'moderator'
  | 'scheduler'
  | 'morale-member'
  | '';

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Roles;
      team?: Team | null;
      group?: Group | null;
      portfolio?: Portfolio | null;
      rankCategory?: RankCategory | null;
      rank?: Rank | null;
    };
  }
}
