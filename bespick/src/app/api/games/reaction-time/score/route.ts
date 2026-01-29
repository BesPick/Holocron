import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { reactionTimeScores } from '@/server/db/schema';
import { requireIdentity } from '@/server/auth';

type ScorePayload = {
  score?: number;
  averageTime?: number;
  bestTime?: number;
};

export async function POST(request: Request) {
  let identity;
  try {
    identity = await requireIdentity();
  } catch {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  let payload: ScorePayload | null = null;
  try {
    payload = (await request.json()) as ScorePayload;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  if (
    typeof payload?.score !== 'number' ||
    typeof payload?.averageTime !== 'number' ||
    typeof payload?.bestTime !== 'number'
  ) {
    return NextResponse.json(
      { error: 'Invalid score data.' },
      { status: 400 },
    );
  }

  const { score, averageTime, bestTime } = payload;

  if (score < 0 || score > 500 || averageTime < 0 || bestTime < 0) {
    return NextResponse.json(
      { error: 'Invalid score values.' },
      { status: 400 },
    );
  }

  try {
    const existing = await db
      .select()
      .from(reactionTimeScores)
      .where(eq(reactionTimeScores.odUserId, identity.userId))
      .get();

    const now = Date.now();
    const userName = identity.name || identity.email || 'Anonymous';

    if (existing) {
      if (score > existing.score) {
        await db
          .update(reactionTimeScores)
          .set({
            userName,
            score,
            averageTime,
            bestTime,
            createdAt: now,
          })
          .where(eq(reactionTimeScores.id, existing.id));
      }
    } else {
      await db.insert(reactionTimeScores).values({
        id: crypto.randomUUID(),
        odUserId: identity.userId,
        userName,
        score,
        averageTime,
        bestTime,
        createdAt: now,
      });
    }

    const leaderboard = await db
      .select()
      .from(reactionTimeScores)
      .orderBy(desc(reactionTimeScores.score))
      .limit(10);

    return NextResponse.json({
      success: true,
      leaderboard: leaderboard.map((entry) => ({
        id: entry.id,
        userName: entry.userName,
        score: entry.score,
        averageTime: entry.averageTime,
        bestTime: entry.bestTime,
      })),
    });
  } catch (error) {
    console.error('Failed to save score:', error);
    return NextResponse.json(
      { error: 'Failed to save score.' },
      { status: 500 },
    );
  }
}
