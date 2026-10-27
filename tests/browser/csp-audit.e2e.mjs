import { test, expect } from '@playwright/test';
import { classifyCsp, knownEvalDiagnostic } from './helpers/csp-audit.mjs';

const known = {
  sourceFile: 'http://127.0.0.1:3000/_next/static/chunks/564-00fede92e8a99f24.js',
  blockedURI: 'eval', directive: 'script-src', effectiveDirective: 'script-src',
  disposition: 'enforce', originalPolicy: "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'",
  time: 240,
};

test('CSP fixture: only one enforced startup Next eval block is classified', () => {
  expect(classifyCsp([known])).toEqual({ known: [known], unexpected: [] });
  expect(classifyCsp([known, known]).unexpected).toEqual([known]);
  const changes = [
    { sourceFile: 'https://third-party.example/_next/static/chunks/a.js' },
    { sourceFile: 'http://127.0.0.1:3000/app.js' },
    { blockedURI: 'inline' }, { blockedURI: 'https://third-party.example/x.js' },
    { directive: 'script-src-elem' }, { effectiveDirective: 'connect-src' },
    { disposition: 'report' }, { time: 251 }, { time: -1 },
    { originalPolicy: "script-src 'self' 'unsafe-eval'" }, { originalPolicy: '' },
  ];
  for (const change of changes) {
    const event = { ...known, ...change };
    expect(classifyCsp([known, event]).unexpected, JSON.stringify(change)).toEqual([event]);
    expect(classifyCsp([event]).known).toEqual([]);
  }
});

test('CSP fixture: unrelated diagnostics remain failures', () => {
  const classification = classifyCsp([known]);
  const text = `Evaluating a string as JavaScript violates the following Content Security Policy directive: "script-src 'self'". 'unsafe-eval' is not an allowed source of script.`;
  expect(knownEvalDiagnostic(text, known.sourceFile, classification)).toBe(true);
  expect(knownEvalDiagnostic(text, 'http://127.0.0.1:3000/app.js', classification)).toBe(false);
  expect(knownEvalDiagnostic('Refused to execute inline script: script-src', known.sourceFile, classification)).toBe(false);
  expect(knownEvalDiagnostic(text, known.sourceFile, classifyCsp([known, known]))).toBe(false);
});
