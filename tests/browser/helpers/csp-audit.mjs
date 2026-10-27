const origin = 'http://127.0.0.1:3000';
// Independent QA snapshot: changes to the product policy require explicit review.
export const expectedCsp = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export function isKnownStartupEval(event) {
  let source;
  try { source = new URL(event.sourceFile); } catch { return false; }
  return source.origin === origin && /^\/_next\/static\/chunks\/[^/]+\.js$/.test(source.pathname)
    && !source.username && !source.password
    && !source.search && !source.hash
    && event.blockedURI === 'eval'
    && event.directive === 'script-src' && event.effectiveDirective === 'script-src'
    && event.disposition === 'enforce'
    && event.originalPolicy === expectedCsp
    && Number.isFinite(event.time) && event.time >= 0 && event.time <= 1500;
}

export function classifyCsp(events) {
  const known = [], unexpected = [];
  for (const event of events) {
    if (isKnownStartupEval(event) && known.length === 0) known.push(event);
    else unexpected.push(event);
  }
  return { known, unexpected };
}

// Only the browser's eval-specific CSP diagnostic at the same source is paired
// with the structured violation. Generic CSP, script, worker and XSS errors fail.
export function knownEvalDiagnostic(text, url, classification) {
  if (classification.known.length !== 1 || classification.unexpected.length) return false;
  if (url !== classification.known[0].sourceFile) return false;
  return /^(?:Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script|Evaluating a string as JavaScript violates the following Content Security Policy directive)/.test(text)
    && text.includes('script-src') && text.includes('unsafe-eval');
}
