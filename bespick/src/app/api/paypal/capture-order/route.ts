import { NextResponse } from 'next/server';

import { capturePayPalOrder } from '@/server/payments/paypal';

type CaptureOrderPayload = {
  orderId?: string;
};

export async function POST(request: Request) {
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
    return NextResponse.json(
      { error: 'Unable to capture payment right now.' },
      { status: 500 },
    );
  }
}
