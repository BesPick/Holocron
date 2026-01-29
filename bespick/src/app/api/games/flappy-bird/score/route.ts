import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { flappyBirdScores } from '@/server/db/schema';
import { requireIdentity } from '@/server/auth';

type ScorePayload = {
  score?: number;
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

  if (typeof payload?.score !== 'number') {
    return NextResponse.json(
      { error: 'Invalid score data.' },
      { status: 400 },
    );
  }

  const { score } = payload;

  if (score < 0 || score > 10000) {
    return NextResponse.json(
      { error: 'Invalid score value.' },
      { status: 400 },
    );
  }

  try {
    const existing = await db
      .select()
      .from(flappyBirdScores)
      .where(eq(flappyBirdScores.odUserId, identity.userId))
      .get();

    const now = Date.now();
    const userName = identity.name || identity.email || 'Anonymous';

    if (existing) {
      if (score > existing.score) {
        await db
          .update(flappyBirdScores)
          .set({
            userName,
            score,
            createdAt: now,
          })
          .where(eq(flappyBirdScores.id, existing.id));
      }
    } else {
      await db.insert(flappyBirdScores).values({
        id: crypto.randomUUID(),
        odUserId: identity.userId,
        userName,
        score,
        createdAt: now,
      });
    }

    const leaderboard = await db
      .select()
      .from(flappyBirdScores)
      .orderBy(desc(flappyBirdScores.score))
      .limit(10);

    return NextResponse.json({
      success: true,
      leaderboard: leaderboard.map((entry) => ({
        id: entry.id,
        userName: entry.userName,
        score: entry.score,
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
