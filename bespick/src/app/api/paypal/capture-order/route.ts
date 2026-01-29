import { NextResponse } from 'next/server';

import { requireIdentity } from '@/server/auth';
import { capturePayPalOrder } from '@/server/payments/paypal';
import { isTrustedOrigin } from '@/server/security/csrf';

type CaptureOrderPayload = {
  orderId?: string;
};

export async function POST(request: Request) {
  try {
    await requireIdentity();
  } catch {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }
  if (!isTrustedOrigin(request)) {
    return NextResponse.json(
      { error: 'Invalid origin.' },
      { status: 403 },
    );
  }

  let payload: CaptureOrderPayload | null = null;
  try {
    payload = (await request.json()) as CaptureOrderPayload;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  if (!payload?.orderId) {
    return NextResponse.json(
      { error: 'Order ID is required to capture payment.' },
      { status: 400 },
    );
  }

  try {
    const capture = await capturePayPalOrder(payload.orderId);
    return NextResponse.json(capture);
  } catch (error) {
    console.error('Failed to capture PayPal order', error);
    const message =
      error instanceof Error
        ? error.message.slice(0, 240)
        : 'Unable to capture payment right now.';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
