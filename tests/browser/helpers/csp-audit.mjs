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
      // Reject every query, including RSC and the empty '?' delimiter.
      // Headers cannot authorize a query-bearing request.
      && !raw.includes('?')
      && url.href === raw && !url.hash && !hasBody && ['GET', 'HEAD'].includes(method)
      && (['/', '/favicon.ico'].includes(url.pathname)
        || /^\/(?:_next\/static|ocr)\/[A-Za-z0-9_./-]+$/.test(url.pathname))
      && !url.pathname.includes('..');
  } catch { return false; }
}

// Deliberately omit URLs, origins, paths, query values, bodies and free-form errors.
export function classifyRequest(raw, method, hasBody = false, expectedAssets) {
  let url;
  try { url = new URL(raw); } catch { /* Invalid URLs fail closed. */ }
  const external = !!url && url.origin !== 'http://127.0.0.1:3000';
  const write = hasBody || !['GET', 'HEAD'].includes(method);
  const allowed = allowedRequest(raw, method, hasBody)
    && (['/', '/favicon.ico'].includes(url?.pathname) || expectedAssets?.has(url?.pathname) === true);
  return Object.freeze({ allowed, external, write, hasBody,
    method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE'].includes(method) ? method : 'OTHER',
    hasQuery: !!url?.search, invalidUrl: !url });
}
