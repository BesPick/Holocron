export type Id<Table extends string = string> = string & { __table?: Table };

export type VotingParticipant = {
  userId: string;
  firstName: string;
  lastName: string;
  group?: string | null;
  portfolio?: string | null;
  votes?: number | null;
};

export type VotingLeaderboardMode = 'all' | 'group' | 'group_portfolio';
export type ActivityStatus = 'published' | 'scheduled' | 'archived';
export type ActivityType = 'announcements' | 'poll' | 'voting';

export type AnnouncementDoc = {
  _id: Id<'announcements'>;
  title: string;
  description: string;
  eventType: ActivityType;
  createdAt: number;
  publishAt: number;
  status: ActivityStatus;
  createdBy?: string;
  updatedAt?: number;
  updatedBy?: string;
  autoDeleteAt?: number | null;
  autoArchiveAt?: number | null;
  pollQuestion?: string;
  pollOptions?: string[];
  pollAnonymous?: boolean;
  pollAllowAdditionalOptions?: boolean;
  pollMaxSelections?: number;
  pollClosesAt?: number | null;
  votingParticipants?: VotingParticipant[];
  votingAddVotePrice?: number;
  votingRemoveVotePrice?: number;
  votingAllowedGroups?: string[];
  votingAllowedPortfolios?: string[];
  votingAllowUngrouped?: boolean;
  votingAllowRemovals?: boolean;
  votingLeaderboardMode?: VotingLeaderboardMode;
  imageIds?: Id<'_storage'>[];
};

export type PollVoteDoc = {
  _id: Id<'pollVotes'>;
  announcementId: Id<'announcements'>;
  userId: string;
  userName?: string | null;
  selections: string[];
  createdAt: number;
  updatedAt: number;
};

export type Doc<TableName extends string> = TableName extends 'announcements'
  ? AnnouncementDoc
  : TableName extends 'pollVotes'
    ? PollVoteDoc
    : never;

export type StorageImage = { id: Id<'_storage'>; url: string };
