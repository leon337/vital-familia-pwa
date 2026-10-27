import { test, expect } from '@playwright/test';
import { classifyCsp, expectedCsp, knownEvalDiagnostic } from './helpers/csp-audit.mjs';

const known = {
  sourceFile: 'http://127.0.0.1:3000/_next/static/chunks/564-fa507fbd158e5a3c.js',
  blockedURI: 'eval', directive: 'script-src', effectiveDirective: 'script-src',
  disposition: 'enforce', originalPolicy: expectedCsp,
  time: 293,
};

test('CSP fixture: zero or one enforced startup Next eval block is classified', () => {
  expect(classifyCsp([])).toEqual({ known: [], unexpected: [] });
  expect(classifyCsp([known])).toEqual({ known: [known], unexpected: [] });
  for (const time of [0, 293.3, 1500]) {
    const event = { ...known, time };
    expect(classifyCsp([event])).toEqual({ known: [event], unexpected: [] });
  }
  expect(classifyCsp([known, known]).unexpected).toEqual([known]);
  const changes = [
    { sourceFile: 'https://third-party.example/_next/static/chunks/a.js' },
    { sourceFile: 'http://127.0.0.1:3000.evil.example/_next/static/chunks/a.js' },
    { sourceFile: `${known.sourceFile}?eval=1` }, { sourceFile: `${known.sourceFile}#eval` },
    { sourceFile: 'http://attacker@127.0.0.1:3000/_next/static/chunks/a.js' },
    { sourceFile: 'http://127.0.0.1:3000/app.js' },
    { blockedURI: 'inline' }, { blockedURI: 'https://third-party.example/x.js' },
    { directive: 'script-src-elem' }, { effectiveDirective: 'connect-src' },
    { disposition: 'report' }, { time: 1501 }, { time: 1600 }, { time: -1 },
    { time: NaN }, { time: Infinity }, { time: '293' }, { time: undefined },
    { originalPolicy: "script-src 'self' 'unsafe-eval'" }, { originalPolicy: '' },
    { originalPolicy: expectedCsp.replace("connect-src 'self'", 'connect-src *') },
    { originalPolicy: expectedCsp.replace("script-src 'self'", "script-src 'self' https://hostile.example") },
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
  expect(knownEvalDiagnostic(text, known.sourceFile, classifyCsp([]))).toBe(false);
  expect(knownEvalDiagnostic(text, known.sourceFile, classifyCsp([{ ...known, time: 1600 }]))).toBe(false);
  expect(knownEvalDiagnostic(text, 'http://127.0.0.1:3000/app.js', classification)).toBe(false);
  expect(knownEvalDiagnostic('Refused to execute inline script: script-src', known.sourceFile, classification)).toBe(false);
  expect(knownEvalDiagnostic(text, known.sourceFile, classifyCsp([known, known]))).toBe(false);
});
