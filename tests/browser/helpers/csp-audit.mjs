// Independent QA snapshot; no startup eval exemption is authenticated.
export const expectedCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
export function classifyCsp(events) {
  return { known: [], unexpected: [...events] };
}
// No console/CDP diagnostic may be discarded without authenticated provenance.
export function knownEvalDiagnostic() { return false; }
export function allowedRequest(raw, method, hasBody = false) {
  try {
    const url = new URL(raw);
    return url.origin === 'http://127.0.0.1:3000' && !url.username && !url.password
      && !url.search && !url.hash && !hasBody && ['GET', 'HEAD'].includes(method)
      && (['/', '/favicon.ico'].includes(url.pathname)
        || /^\/(?:_next\/static|ocr)\/[A-Za-z0-9_./-]+$/.test(url.pathname))
      && !url.pathname.includes('..');
  } catch { return false; }
}
