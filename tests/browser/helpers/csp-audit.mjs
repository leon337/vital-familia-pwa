const origin = 'http://127.0.0.1:3000';

export function isKnownStartupEval(event) {
  let source;
  try { source = new URL(event.sourceFile); } catch { return false; }
  return source.origin === origin && /^\/_next\/static\/chunks\/[^/]+\.js$/.test(source.pathname)
    && !source.search && !source.hash
    && event.blockedURI === 'eval'
    && event.directive === 'script-src' && event.effectiveDirective === 'script-src'
    && event.disposition === 'enforce'
    && typeof event.originalPolicy === 'string'
    && /(?:^|;)\s*script-src\s/.test(event.originalPolicy)
    && !event.originalPolicy.includes("'unsafe-eval'")
    && Number.isFinite(event.time) && event.time >= 0 && event.time <= 250;
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
