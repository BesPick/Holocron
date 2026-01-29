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
