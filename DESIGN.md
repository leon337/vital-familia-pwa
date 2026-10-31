# DESIGN.md — Vital Família

## Product
Vital Família is a Portuguese-Brazilian, mobile-first interface for a family health diary, focused on clear recording of glucose and blood pressure and permissioned visibility for trusted caregivers. The experience must be reassuring, calm and accessible to older adults. The app is a prototype, not a clinical or diagnostic device.

## Canonical visual references
1. Main original 12-screen reference board (prioritize its visual hierarchy):
   https://raw.githubusercontent.com/leon337/vital-familia-pwa/main/docs/design/vital-familia-12-telas.png
2. Complete screen brief:
   https://github.com/leon337/vital-familia-pwa/blob/main/docs/design/stitch-briefing.md
3. Next.js 16 + React implementation:
   https://github.com/leon337/vital-familia-pwa

## Brand and visual style
- Name: **Vital Família**
- Green-and-white palette with pale sage/mint, soft pastel neutrals, occasional subdued amber for glucose and blush red for pressure.
- Existing prototype CSS uses a primary green of `#145c4d`, light page background `#f6f8f4`, text `#243b33`, secondary `#6f7d77`, border `#e2e8e1`. Maintain consistency with the attached image; refine contrast as needed.
- Rounded cards, soft borders, ample whitespace, limited shadows, large readable numbers and labels.
- UI font: readable modern sans serif. Avoid decorative text for forms and measurement data.
- Iconography: simple line icons, including droplet (glucose), heart/heart-pulse (pressure), calendar, clock, chart, person/caregiver and bell.
- Default LIGHT theme; paired DARK accessible version for the main dashboard.
- Mobile app viewport around 390 × 844; responsive and touch-first.

## Navigation and reusable components
- Bottom navigation: Início, Registros, Assistente, Mais.
- Persistent header with Vital Família title, simple back navigation and profile access.
- Components: measurement summary card, metric input, contextual chip, date-time field, notes, primary/secondary button, segmented filter, chart, record row, reminder switch, caregiver permission card, status toast, large-text preference and accessible empty/error states.
- Hierarchy: primary task clearly visible, minimum touch targets 44 × 44 CSS pixels, text contrast at least WCAG AA where applicable, clear focus indicators.
- Portuguese (pt-BR) labels, local date formats, correct units mg/dL, mmHg, bpm.

## Required 12 editable screens
1. Abertura e Login: brand, tagline, Google login presentation and privacy note; no real authentication implied.
2. Início / Dashboard: greeting, glucose and pressure action cards, history, reports, assistant, reminders.
3. Registrar Glicemia: mg/dL, Jejum / Antes / Após refeição / Outro, date/time, optional note, Save.
4. Registrar Pressão Arterial: Sistólica, Diastólica mmHg, Pulso bpm, date/time, optional note, Save.
5. Meus Registros: tabs Todos / Glicemia / Pressão and accessible historical items.
6. Gráficos e Tendências: neutral trends over time without diagnostic interpretation.
7. Assistente Vital IA: demonstration conversation UI with explicitly educational disclaimer.
8. Relatórios: date range and report preview/download presentation.
9. Compartilhamento: family/caregiver invitation and view-only permissions, ability to revoke.
10. Lembretes: times, switches and accessible Save control.
11. Perfil e Configurações: personal settings, high contrast, font size, theme, medications/doctors as future navigation items.
12. Modo Escuro: accessible dark-mode version of dashboard with matching layout and semantics.

## UX and safety constraints
- Build **one cohesive project with 12 distinct editable screens**, not a single collage.
- Source image is the visual truth; adapt only to improve legibility and consistency.
- Display synthetic example values only. Avoid real patient data.
- Do not present an active Gemini assistant, real Google auth, operational notifications or actual sharing if not implemented.
- No medical diagnosis, risk classification, treatment recommendations or automated clinical alerts.
- Prefer shared tokens and components that can be implemented in React/Next.js.
- Check that all 12 requested screens are present before marking the generation complete.
