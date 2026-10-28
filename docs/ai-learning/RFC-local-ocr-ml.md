# RFC — VITAL-LEARNING-001: Safe Local OCR and ML Benchmark

> **Status:** PROPOSED / EXPERIMENTAL. **Not an approved ADR**, production model, medical decision support, or clinical validation.  
> **Mission:** [Vital Família #24](https://github.com/leon337/vital-familia-pwa/issues/24); base [F02 #2](https://github.com/leon337/vital-familia-pwa/issues/2); A6 blockade [#22](https://github.com/leon337/vital-familia-pwa/issues/22).
> **Owners:** LEANDRO authority, MESTRE governance, SOFIA architecture, RAFAEL engineering, RENATO tests, EMILY independent audit, LÉO gate.

## Intended use (non-clinical prototype)

Help a user photograph a fictional measurement display, review locally extracted fields and **explicitly confirm or correct** them before any save. This RFC does not authorize diagnosis, risk classification, medication suggestions, autonomous monitoring/alarm, use of personal health data, or sending images/measurements to third-party services.

Production remains **OFF** until separate OAuth/Neon RLS A6, A7 and A9 acceptance. Stack: Next.js/React, Neon/Managed Better Auth Google, Vercel, browser-local OCR. Supabase is not current backend.

## Experimental flow

1. Synthetic photo fixture → browser-local worker/WASM OCR (existing baseline, e.g. Tesseract.js).
2. Typed parsing and schema: glucose unit exactly `mg/dL` or `mmol/L` with explicitly visible value, or blood pressure systolic/diastolic with pulse only when visible. Never infer missing units or values.
3. Deterministic plausibility/consistency check with documented rules and no medical risk labels; any unknown/illegible/ambiguous result yields `abstain` and manual review.
4. User sees original photo, extracted fields, unit and confidence limitations, can correct. Persistence only after independent explicit confirmation; no silent save.
5. Optional local pretrained ML/DL candidate, separate experimental module **disabled by default**, evaluated in *shadow* against baseline on frozen synthetic fixtures; never writes to patient DB or calls Gemini.
6. Future real-user feedback collection requires distinct, explicit consent and legal/risk review. Even corrected values must **not** become training data implicitly.

## Benchmark protocol for RENATO

- [ ] Unit and field accuracy per device type, synthetic stress scenarios (glare, tilt, blur, darkness, flipped image, incorrect unit and missing pulse).
- [ ] Rate of **unsafe automatic acceptance must be zero** because no model result is eligible for auto-persist.
- [ ] False acceptance, abstention, manual correction rate and confidence calibration measured per synthetic fixture group; compare baseline with candidate on locked test set.
- [ ] Browser network trace shows no image/health measurement egress on local OCR path.
- [ ] Google OAuth and Neon remain independent F02 gates, not fulfilled by ML mocks.
- [ ] Android accessibility: keyboard/focus, readable field labels and feedback, contrast and large touch targets.
- [ ] CSP/worker, PWA cache avoidance, source-map/log/artifact redaction, bundle size, CPU memory, latency p50/p95 assessed in GitHub Actions where supported.
- [ ] New model not loaded outside synthetic test feature flag; no impact on currently working demo/main.

## Acceptance and veto

No ML/DL candidate is necessary unless it beats baseline on a preregistered metric without worsened critical-field errors; inability to prove gain means stay deterministic. Medical claims are prohibited; any proposed diagnostic function triggers Anvisa SaMD scope/legal review independently. Zero P0/P1 and EMILY approval of same commit/CI required before LÉO may authorize further nonclinical work.

**Delegation:** SOFIA ADR → RAFAEL isolated PR → RENATO tests → EMILY independent review → LÉO internal gate; MESTRE documentation and handoffs only. No deploy/merge from this RFC.

Research anchors: [WHO AI health ethics](https://www.who.int/publications/i/item/9789240084759), [FDA/IMDRF GMLP](https://www.fda.gov/medical-devices/artificial-intelligence-enabled-medical-devices/good-machine-learning-practice-medical-device-development-guiding-principles), [Anvisa RDC 657/2022](https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&cod_menu=1696&cod_modulo=134&numeroAto=00000657&orgao=RDC%2FDC%2FANVISA%2FMS&seqAto=000&tipo=RDC&valorAno=2022).