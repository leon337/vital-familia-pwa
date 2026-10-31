export const VITAL_SCREENS = [
  { id: 'welcome', label: 'Boas-vindas', icon: '✦' },
  { id: 'home', label: 'Início', icon: '⌂' },
  { id: 'glucose', label: 'Registrar glicemia', icon: '◉' },
  { id: 'pressure', label: 'Registrar pressão', icon: '♡' },
  { id: 'history', label: 'Histórico', icon: '▤' },
  { id: 'trends', label: 'Gráficos e tendências', icon: '↗' },
  { id: 'assistant', label: 'Assistente Vital IA', icon: '✧' },
  { id: 'reports', label: 'Relatórios', icon: '▧' },
  { id: 'family', label: 'Familiares e cuidadores', icon: '♧' },
  { id: 'reminders', label: 'Lembretes', icon: '◷' },
  { id: 'profile', label: 'Perfil e acessibilidade', icon: '⚙' },
  { id: 'dark', label: 'Dashboard modo escuro', icon: '◐' }
] as const;

export type VitalScreen = (typeof VITAL_SCREENS)[number]['id'];
export const isVitalScreen = (value: string): value is VitalScreen =>
  VITAL_SCREENS.some((screen) => screen.id === value);

export const VITAL_DEMO_NOTICE = 'Demonstração com dados 100% sintéticos. Não utilizar para decisões clínicas.';
