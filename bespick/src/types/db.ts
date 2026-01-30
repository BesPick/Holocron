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
export type ActivityType =
  | 'announcements'
  | 'poll'
  | 'voting'
  | 'form'
  | 'fundraiser'
  | 'giveaway';

export type FundraiserAnonymityMode = 'anonymous' | 'user_choice';

export type FormQuestionType =
  | 'multiple_choice'
  | 'dropdown'
  | 'free_text'
  | 'user_select'
  | 'number';

export type FormSubmissionLimit = 'once' | 'unlimited';

export type FormUserFilter = {
  search?: string;
  role?: string;
  team?: string;
  group?: string;
  portfolio?: string;
  rankCategory?: string;
  rank?: string;
};

export type FormQuestion = {
  id: string;
  type: FormQuestionType;
  prompt: string;
  required?: boolean;
  allowAdditionalOptions?: boolean;
  maxSelections?: number;
  options?: string[];
  optionPrices?: Record<string, number>;
  maxLength?: number;
  userFilters?: FormUserFilter;
  minValue?: number;
  maxValue?: number;
  includeMin?: boolean;
  includeMax?: boolean;
  allowAnyNumber?: boolean;
  pricePerUnit?: number;
  priceSourceQuestionId?: string;
  priceSourceQuestionIds?: string[];
};

export type FormAnswer = {
  questionId: string;
  value: string | string[];
  displayValue?: string | string[];
};

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
  pollOriginalClosesAt?: number | null;
  votingParticipants?: VotingParticipant[];
  votingAddVotePrice?: number;
  votingRemoveVotePrice?: number;
  votingAddVoteLimit?: number | null;
  votingRemoveVoteLimit?: number | null;
  votingAllowedGroups?: string[];
  votingAllowedPortfolios?: string[];
  votingAllowUngrouped?: boolean;
  votingAllowRemovals?: boolean;
  votingLeaderboardMode?: VotingLeaderboardMode;
  votingAutoCloseAt?: number | null;
  votingOriginalAutoCloseAt?: number | null;
  formQuestions?: FormQuestion[];
  formSubmissionLimit?: FormSubmissionLimit;
  formPrice?: number | null;
  formAllowAnonymousChoice?: boolean;
  formForceAnonymous?: boolean;
  fundraiserGoal?: number | null;
  fundraiserAnonymityMode?: FundraiserAnonymityMode;
  fundraiserTotalRaised?: number | null;
  giveawayAllowMultipleEntries?: boolean;
  giveawayEntryCap?: number | null;
  giveawayWinnersCount?: number | null;
  giveawayEntryPrice?: number | null;
  giveawayIsClosed?: boolean;
  giveawayClosedAt?: number | null;
  giveawayAutoCloseAt?: number | null;
  giveawayTotalEntries?: number | null;
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

export type FormSubmissionDoc = {
  _id: Id<'formSubmissions'>;
  announcementId: Id<'announcements'>;
  userId: string;
  userName?: string | null;
  isAnonymous?: boolean;
  answers: FormAnswer[];
  createdAt: number;
  paypalOrderId?: string | null;
  paymentAmount?: number | null;
};

export type FundraiserDonationDoc = {
  _id: Id<'fundraiserDonations'>;
  announcementId: Id<'announcements'>;
  userId: string;
  userName?: string | null;
  isAnonymous: boolean;
  amount: number;
  createdAt: number;
  paypalOrderId?: string | null;
};

export type GiveawayEntryDoc = {
  _id: Id<'giveawayEntries'>;
  announcementId: Id<'announcements'>;
  userId: string;
  userName?: string | null;
  tickets: number;
  createdAt: number;
  paypalOrderId?: string | null;
  paymentAmount?: number | null;
};

export type Doc<TableName extends string> = TableName extends 'announcements'
  ? AnnouncementDoc
  : TableName extends 'pollVotes'
    ? PollVoteDoc
    : TableName extends 'formSubmissions'
      ? FormSubmissionDoc
      : TableName extends 'fundraiserDonations'
        ? FundraiserDonationDoc
        : TableName extends 'giveawayEntries'
          ? GiveawayEntryDoc
    : never;

export type StorageImage = { id: Id<'_storage'>; url: string };
