import { NextResponse } from 'next/server';
import { getOptionalIdentity } from '@/server/auth';
import { handleAction, type RpcAction } from '@/server/actions';

type RequestBody = {
  action: string;
  args?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    if (!body?.action) {
      return NextResponse.json(
        { error: 'Missing action' },
        { status: 400 },
      );
    }
    const identity = await getOptionalIdentity();
    const result = await handleAction(
      body.action as RpcAction,
      body.args,
      identity,
    );
    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
