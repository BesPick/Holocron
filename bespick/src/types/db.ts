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
export type ActivityType = 'announcements' | 'poll' | 'voting' | 'form';

export type FormQuestionType =
  | 'multiple_choice'
  | 'dropdown'
  | 'free_text'
  | 'user_select';

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
  maxLength?: number;
  userFilters?: FormUserFilter;
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
  formQuestions?: FormQuestion[];
  formSubmissionLimit?: FormSubmissionLimit;
  formPrice?: number | null;
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
  answers: FormAnswer[];
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
    : never;

export type StorageImage = { id: Id<'_storage'>; url: string };
