import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { flappyBirdScores } from '@/server/db/schema';

export async function GET() {
  try {
    const scores = await db
      .select()
      .from(flappyBirdScores)
      .orderBy(desc(flappyBirdScores.score))
      .limit(10);

    const leaderboard = scores.map((score) => ({
      id: score.id,
      userName: score.userName,
      score: score.score,
    }));

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 },
    );
  }
}
