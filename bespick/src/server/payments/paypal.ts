const LIVE_API_BASE = 'https://api-m.paypal.com';
const SANDBOX_API_BASE = 'https://api-m.sandbox.paypal.com';

const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  PAYPAL_ENVIRONMENT,
  PAYPAL_API_BASE_URL,
  PAYPAL_BRAND_NAME,
} = process.env;

const BRAND_NAME = PAYPAL_BRAND_NAME ?? 'BESPIN Morale';

const RESOLVED_API_BASE =
  PAYPAL_API_BASE_URL ??
  (PAYPAL_ENVIRONMENT === 'live' ? LIVE_API_BASE : SANDBOX_API_BASE);

type PayPalAccessTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: 'Bearer';
};

type PayPalOrderResponse = {
  id: string;
  status: string;
};

type CreatePayPalOrderOptions = {
  amount: string;
  currency?: string;
  description?: string;
  referenceId?: string;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error(
      'Missing PayPal client credentials. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
    );
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.value;
  }

  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`,
  ).toString('base64');

  const response = await fetch(`${RESOLVED_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to obtain PayPal access token (${response.status}): ${errorBody}`,
    );
  }

  const payload = (await response.json()) as PayPalAccessTokenResponse;
  cachedToken = {
    value: payload.access_token,
    expiresAt: now + Math.max(payload.expires_in - 60, 0) * 1000,
  };
  return payload.access_token;
}

export async function createPayPalOrder(options: CreatePayPalOrderOptions) {
  const { amount, description, referenceId, currency = 'USD' } = options;
  if (!amount) throw new Error('Amount is required to create a PayPal order.');

  const token = await getAccessToken();
  const response = await fetch(`${RESOLVED_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: { currency_code: currency, value: amount },
          description,
          reference_id: referenceId,
        },
      ],
      application_context: {
        brand_name: BRAND_NAME,
        user_action: 'PAY_NOW',
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to create PayPal order (${response.status}): ${errorBody}`,
    );
  }

  const payload = (await response.json()) as PayPalOrderResponse;
  return payload;
}

export async function capturePayPalOrder(orderId: string) {
  if (!orderId) throw new Error('Order ID is required to capture a payment.');

  const token = await getAccessToken();
  const response = await fetch(
    `${RESOLVED_API_BASE}/v2/checkout/orders/${orderId}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to capture PayPal order (${response.status}): ${errorBody}`,
    );
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return payload;
}
