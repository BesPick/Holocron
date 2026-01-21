import type { Group, Portfolio } from '@/lib/org';
import type { VotingLeaderboardMode } from '@/types/db';

export type VotingParticipant = {
  userId: string;
  firstName: string;
  lastName: string;
  group?: Group | null;
  portfolio?: Portfolio | null;
  votes: number;
};

export type VotingRosterEntry = VotingParticipant & {
  group: Group | null;
  portfolio: Portfolio | null;
};

export type { VotingLeaderboardMode };
