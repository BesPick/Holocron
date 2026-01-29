export function isTrustedOrigin(request: Request) {
  const originHeader =
    request.headers.get('origin') ?? request.headers.get('referer');
  if (!originHeader) return false;
  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return false;
  }
  const host = request.headers.get('host');
  if (!host) return false;
  return origin.host === host;
}

import type { NextRequest } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function verifyCsrfOrigin(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  
  if (SAFE_METHODS.has(method)) {
    return true;
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  if (!host) {
    return false;
  }

  const allowedHosts = new Set([
    host,
    `https://${host}`,
    `http://${host}`,
  ]);

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originHost = originUrl.host;
      return originHost === host;
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererHost = refererUrl.host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  return false;
}
