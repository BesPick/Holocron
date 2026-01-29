import {
  archiveAnnouncement,
  createAnnouncement,
  getAnnouncement,
  getPoll,
  getPollVoteBreakdown,
  getForm,
  getFundraiser,
  getGiveaway,
  listAnnouncements,
  listArchived,
  listFormSubmissions,
  listScheduled,
  nextPublishAt,
  publishDue,
  purchaseVotes,
  closeGiveaway,
  enterGiveaway,
  reopenGiveaway,
  redrawGiveaway,
  removeAnnouncement,
  submitFundraiserDonation,
  submitForm,
  updateAnnouncement,
  votePoll,
  type CreateAnnouncementArgs,
  type PurchaseVotesArgs,
  type CloseGiveawayArgs,
  type EnterGiveawayArgs,
  type ReopenGiveawayArgs,
  type RedrawGiveawayArgs,
  type SubmitFundraiserDonationArgs,
  type SubmitFormArgs,
  type UpdateAnnouncementArgs,
  type VotePollArgs,
} from '@/server/services/announcements';
import { getImageUrls } from '@/server/services/storage';
import type { Identity } from './auth';
import type { Id } from '@/types/db';

export type RpcAction =
  | 'announcements.list'
  | 'announcements.listArchived'
  | 'announcements.listScheduled'
  | 'announcements.create'
  | 'announcements.update'
  | 'announcements.get'
  | 'announcements.getPoll'
  | 'announcements.getPollVoteBreakdown'
  | 'announcements.votePoll'
  | 'announcements.getForm'
  | 'announcements.submitForm'
  | 'announcements.listFormSubmissions'
  | 'announcements.getFundraiser'
  | 'announcements.submitFundraiserDonation'
  | 'announcements.getGiveaway'
  | 'announcements.enterGiveaway'
  | 'announcements.closeGiveaway'
  | 'announcements.reopenGiveaway'
  | 'announcements.redrawGiveaway'
  | 'announcements.purchaseVotes'
  | 'announcements.nextPublishAt'
  | 'announcements.publishDue'
  | 'announcements.remove'
  | 'announcements.archive'
  | 'storage.getImageUrls';

export async function handleAction(
  action: RpcAction,
  args: unknown,
  identity: Identity | null,
) {
  switch (action) {
    case 'announcements.list':
      return listAnnouncements((args as { now: number }).now);
    case 'announcements.listArchived':
      return listArchived();
    case 'announcements.listScheduled':
      return listScheduled((args as { now: number }).now);
    case 'announcements.create':
      return createAnnouncement(args as CreateAnnouncementArgs, identity);
    case 'announcements.update':
      return updateAnnouncement(args as UpdateAnnouncementArgs, identity);
    case 'announcements.get':
      return getAnnouncement((args as { id: Id<'announcements'> }).id);
    case 'announcements.getPoll':
      return getPoll(
        (args as { id: Id<'announcements'> }).id,
        identity?.userId,
      );
    case 'announcements.getPollVoteBreakdown':
      return getPollVoteBreakdown(
        (args as { id: Id<'announcements'> }).id,
        identity,
      );
    case 'announcements.votePoll':
      return votePoll(args as VotePollArgs, identity);
    case 'announcements.getForm':
      return getForm(
        (args as { id: Id<'announcements'> }).id,
        identity?.userId,
      );
    case 'announcements.getFundraiser':
      return getFundraiser(
        (args as { id: Id<'announcements'> }).id,
      );
    case 'announcements.getGiveaway':
      return getGiveaway(
        (args as { id: Id<'announcements'> }).id,
        identity,
      );
    case 'announcements.submitForm':
      return submitForm(args as SubmitFormArgs, identity);
    case 'announcements.listFormSubmissions':
      return listFormSubmissions(
        (args as { id: Id<'announcements'> }).id,
        identity,
      );
    case 'announcements.submitFundraiserDonation':
      return submitFundraiserDonation(
        args as SubmitFundraiserDonationArgs,
        identity,
      );
    case 'announcements.enterGiveaway':
      return enterGiveaway(args as EnterGiveawayArgs, identity);
    case 'announcements.closeGiveaway':
      return closeGiveaway(args as CloseGiveawayArgs, identity);
    case 'announcements.reopenGiveaway':
      return reopenGiveaway(args as ReopenGiveawayArgs, identity);
    case 'announcements.redrawGiveaway':
      return redrawGiveaway(args as RedrawGiveawayArgs, identity);
    case 'announcements.purchaseVotes':
      return purchaseVotes(args as PurchaseVotesArgs, identity);
    case 'announcements.nextPublishAt':
      return nextPublishAt((args as { now: number }).now);
    case 'announcements.publishDue':
      return publishDue((args as { now: number }).now);
    case 'announcements.remove':
      return removeAnnouncement(
        (args as { id: Id<'announcements'> }).id,
        identity,
      );
    case 'announcements.archive':
      return archiveAnnouncement(
        (args as { id: Id<'announcements'> }).id,
        identity,
      );
    case 'storage.getImageUrls':
      return getImageUrls((args as { ids: Id<'_storage'>[] }).ids ?? []);
    default:
      throw new Error('Unknown action');
  }
}
