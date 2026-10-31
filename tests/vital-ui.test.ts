import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {VITAL_SCREENS,VITAL_DEMO_NOTICE,isVitalScreen} from '../lib/vital-ui';

const studio = readFileSync(new URL('../app/vital-studio.tsx', import.meta.url),'utf8');
const page = readFileSync(new URL('../app/page.tsx', import.meta.url),'utf8');
const legacy = readFileSync(new URL('../app/demo/page.tsx', import.meta.url),'utf8');

describe('Vital UI-001: contrato de 12 telas e segurança do demo',()=>{
  it('declara exatamente as 12 telas solicitadas, sem duplicatas',()=>{
    expect(VITAL_SCREENS).toHaveLength(12);
    expect(new Set(VITAL_SCREENS.map(item=>item.id)).size).toBe(12);
    for(const id of ['welcome','home','glucose','pressure','history','trends','assistant','reports','family','reminders','profile','dark']){
      expect(isVitalScreen(id)).toBe(true);
    }
    expect(isVitalScreen('production-health')).toBe(false);
  });
  it('mantém interface anterior disponível e a nova experiência na home',()=>{
    expect(page).toContain('<VitalStudio/>');
    expect(legacy).toContain('function Home()');
    expect(studio).toContain('href="/demo"');
  });
  it('não afirma integrações médicas inexistentes',()=>{
    expect(studio).not.toMatch(/sincronizada instantaneamente|validação biométrica de 7 dias|envia por WhatsApp\s+agora/i);
    expect(studio).toContain('Não haverá notificações');
    expect(studio).toContain('não existem convites');
  });
  it('explicita dados sintéticos, IA desligada e confirma antes de salvar',()=>{
    expect(VITAL_DEMO_NOTICE).toContain('100% sintéticos');
    expect(studio).toContain('disabled');
    expect(studio).toContain('measurementSchema.safeParse');
    expect(studio).toContain('setDemoConsent');
    expect(studio).toContain('Gemini');
  });
  it('expõe catálogo completo também na navegação móvel',()=>{
    expect(studio).toContain('aria-label="Selecionar uma das 12 telas"');
    expect(studio).toContain('VITAL_SCREENS.map(item=><option');
  });
});
