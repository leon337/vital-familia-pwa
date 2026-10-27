import { test, expect } from '@playwright/test';
import { classifyCsp, knownEvalDiagnostic, allowedRequest, expectedCsp } from './helpers/csp-audit.mjs';

test('adversarial CSP events never obtain a startup exemption', () => {
  const event = { sourceFile: 'http://127.0.0.1:3000/_next/static/chunks/564-fa507fbd158e5a3c.js',
    blockedURI: 'eval', directive: 'script-src', effectiveDirective: 'script-src',
    disposition: 'enforce', originalPolicy: expectedCsp, time: 293.3, isTrusted: true,
    lineNumber: 1, columnNumber: 1 };
  for (const change of [{}, { isTrusted: false }, { time: 0 }, { time: 1500 },
    { sourceFile: 'https://evil.example/a.js' }, { lineNumber: 2 },
    { columnNumber: 2 }, { fingerprint: 'different-build' }, { blockedURI: 'inline' }]) {
    const malicious = { ...event, ...change };
    expect(classifyCsp([malicious]).unexpected).toEqual([malicious]);
    expect(classifyCsp([malicious, malicious]).unexpected).toHaveLength(2);
    expect(knownEvalDiagnostic('Evaluating a string as JavaScript violates script-src unsafe-eval', malicious.sourceFile, classifyCsp([malicious]))).toBe(false);
  }
});

test('requests reject URL exfiltration, bodies, methods and external origins', () => {
  const origin = 'http://127.0.0.1:3000';
  expect(allowedRequest(`${origin}/`, 'GET')).toBe(true);
  expect(allowedRequest(`${origin}/ocr/core/tesseract-core.wasm`, 'HEAD')).toBe(true);
  for (const path of ['/?glucose=123', '/?image=iVBORw0KGgo=', '/123mg-dL', '/ocr/a?120=80', '/ocr/a#data', '/api/measurement']) {
    expect(allowedRequest(origin + path, 'GET')).toBe(false);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS', 'CONNECT']) expect(allowedRequest(`${origin}/`, method)).toBe(false);
  expect(allowedRequest(`${origin}/`, 'GET', true)).toBe(false);
  expect(allowedRequest('https://evil.example/ocr/a', 'GET')).toBe(false);
});
