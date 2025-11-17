import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorized upload.');
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const getImageUrls = query({
  args: { ids: v.array(v.id('_storage')) },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.ids.map(async (id) => {
        const url = await ctx.storage.getUrl(id);
        return url ? { id, url } : null;
      }),
    );

    return results.filter((entry): entry is { id: Id<'_storage'>; url: string } => entry !== null);
  },
});
