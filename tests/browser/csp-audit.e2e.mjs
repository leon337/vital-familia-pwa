import { test, expect } from '@playwright/test';
import { classifyCsp, knownEvalDiagnostic, allowedRequest, classifyRequest, expectedCsp } from './helpers/csp-audit.mjs';

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
  const assets = new Set(['/ocr/core/tesseract-core.wasm']);
  for (const method of ['GET', 'HEAD']) {
    expect(classifyRequest(`${origin}/`, method, false, assets).allowed).toBe(true);
    for (const path of ['/?_rsc=abc12&glucose=123', '/?_rsc=abc12&image=synthetic',
      '/?_rsc=abc12&_rsc=def34', '/?_rsc=', '/?_rsc=123456', '/?_rsc=abc%31',
      '/?%5Frsc=abc12', '/?_rsc=abc12&', '/?_rsc=abc12#synthetic',
      '/ocr/core/tesseract-core.wasm?_rsc=abc12', '/minha-saude?_rsc=abc12',
      '/api/measurement?_rsc=abc12', '/other/../?_rsc=abc12']) {
      expect(classifyRequest(origin + path, method, false, assets).allowed).toBe(false);
    }
    const externalUrl = 'https://evil.example/synthetic-123?image=synthetic&_rsc=abc12';
    const metadata = classifyRequest(externalUrl, method, false, assets);
    expect(metadata).toEqual({ allowed: false, external: true, write: false, hasBody: false,
      method, hasQuery: true, invalidUrl: false });
    expect(JSON.stringify(metadata)).not.toMatch(/evil|synthetic|123|image|_rsc/);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE']) {
    const metadata = classifyRequest(`${origin}/?_rsc=abc12`, method, false, assets);
    expect(metadata.allowed).toBe(false);
    expect(metadata.write).toBe(true);
  }
  expect(classifyRequest(`${origin}/?_rsc=abc12`, 'GET', true, assets).allowed).toBe(false);
  expect(classifyRequest(`${origin}/?_rsc=abc12`, 'HEAD', true, assets).allowed).toBe(false);
  expect(classifyRequest(`${origin}/ocr/unlisted.wasm`, 'GET', false, assets).allowed).toBe(false);
  expect(classifyRequest(`${origin}/ocr/core/tesseract-core.wasm`, 'HEAD', false, assets).allowed).toBe(true);
  for (const url of [`http://user:pass@127.0.0.1:3000/?_rsc=abc12`,
    'http://localhost:3000/?_rsc=abc12', 'https://127.0.0.1:3000/?_rsc=abc12', 'invalid']) {
    expect(classifyRequest(url, 'GET', false, assets).allowed).toBe(false);
  }

});

// All values below are synthetic, including the short clinical tokens that fit
// the former cache-buster regex. Match the production route's input extraction:
// headers are never an authorization input to classifyRequest.
test('every query is rejected even with forged Next RSC and prefetch headers', () => {
  const origin = 'http://127.0.0.1:3000';
  const assets = new Set(['/ocr/core/tesseract-core.wasm']);
  const headers = [
    {},
    { RSC: '1' },
    { 'Next-Router-Prefetch': '1', Purpose: 'prefetch', 'Sec-Purpose': 'prefetch' },
    { RSC: '1', 'Next-Router-Prefetch': '1',
      'Next-Router-State-Tree': '%5B%22%22%5D', 'Next-Url': '/',
      Origin: origin, Referer: `${origin}/`, 'Sec-Fetch-Site': 'same-origin' },
  ];
  const queries = ['?', '?glucose=123', '?_rsc', '?_rsc=', '?_rsc=abc12',
    '?_rsc=123', '?_rsc=12080', '?_rsc=72bpm', '?_rsc=5CB68i4pnAekjehf',
    '?_rsc=glucose123mgdL', '?_rsc=abc12&glucose=123',
    '?_rsc=abc12&_rsc=def34', '?%5Frsc=abc12', '?_rsc=abc%31',
    '?_rsc=abc12&', '?_rsc=abc12#synthetic'];
  for (const method of ['GET', 'HEAD']) {
    for (const path of ['/', '/ocr/core/tesseract-core.wasm']) {
      for (const query of queries) {
        for (const forged of headers) {
          const request = new Request(origin + path + query, { method, headers: forged });
          expect(allowedRequest(request.url, request.method, false)).toBe(false);
          const metadata = classifyRequest(request.url, request.method, false, assets);
          expect(metadata.allowed).toBe(false);
          expect(JSON.stringify(metadata)).not.toMatch(/_rsc|123|12080|72bpm|glucose|abc12/);
        }
      }
    }
  }
});
