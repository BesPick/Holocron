import { NextResponse } from 'next/server';

import { requireIdentity } from '@/server/auth';
import { createPayPalOrder } from '@/server/payments/paypal';
import { isTrustedOrigin } from '@/server/security/csrf';

type CreateOrderPayload = {
  amount?: number | string;
  description?: string;
  referenceId?: string;
  currency?: string;
};

const MAX_FIELD_LENGTH = 120;
const MAX_ERROR_LENGTH = 240;

function sanitizeField(value: unknown) {
  if (typeof value !== 'string') return undefined;
  return value.trim().slice(0, MAX_FIELD_LENGTH) || undefined;
}

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

  let payload: CreateOrderPayload | null = null;
  try {
    payload = (await request.json()) as CreateOrderPayload;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload.' },
      { status: 400 },
    );
  }

  if (!payload) {
    return NextResponse.json(
      { error: 'Missing payload.' },
      { status: 400 },
    );
  }

  const amountValue =
    typeof payload.amount === 'string'
      ? Number.parseFloat(payload.amount)
      : payload.amount;

  if (
    typeof amountValue !== 'number' ||
    Number.isNaN(amountValue) ||
    amountValue <= 0
  ) {
    return NextResponse.json(
      { error: 'Amount must be a positive number.' },
      { status: 400 },
    );
  }

  const normalizedAmount = amountValue.toFixed(2);
  const description = sanitizeField(payload.description);
  const referenceId = sanitizeField(payload.referenceId);
  const currency =
    typeof payload.currency === 'string' && payload.currency.length === 3
      ? payload.currency.toUpperCase()
      : 'USD';

  try {
    const order = await createPayPalOrder({
      amount: normalizedAmount,
      description,
      referenceId,
      currency,
    });
    return NextResponse.json(order);
  } catch (error) {
    console.error('Failed to create PayPal order', error);
    const message =
      error instanceof Error
        ? error.message.slice(0, MAX_ERROR_LENGTH)
        : 'Unable to create payment right now.';
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
