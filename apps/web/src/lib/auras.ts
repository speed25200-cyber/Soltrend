export interface Aura {
  id: string;
  label: string;
  css: string;
}

/** Background ambiances a creator can pick for their game stage. */
export const AURAS: Aura[] = [
  { id: 'nebula', label: 'Nebula', css: 'radial-gradient(80% 80% at 30% 0%, rgba(139,92,246,0.22), transparent 60%), radial-gradient(70% 70% at 90% 100%, rgba(217,70,239,0.16), transparent 60%)' },
  { id: 'sunset', label: 'Sunset', css: 'radial-gradient(80% 80% at 20% 0%, rgba(251,113,133,0.2), transparent 60%), radial-gradient(70% 70% at 100% 100%, rgba(245,158,11,0.16), transparent 60%)' },
  { id: 'matrix', label: 'Matrix', css: 'radial-gradient(80% 80% at 50% 0%, rgba(16,245,160,0.16), transparent 60%), radial-gradient(60% 60% at 0% 100%, rgba(34,211,238,0.12), transparent 60%)' },
  { id: 'ice', label: 'Ice', css: 'radial-gradient(80% 80% at 40% 0%, rgba(34,211,238,0.2), transparent 60%), radial-gradient(70% 70% at 100% 90%, rgba(59,130,246,0.16), transparent 60%)' },
  { id: 'gold', label: 'Royal', css: 'radial-gradient(80% 80% at 30% 0%, rgba(255,210,95,0.18), transparent 60%), radial-gradient(70% 70% at 90% 100%, rgba(168,85,247,0.14), transparent 60%)' },
];

export const auraCss = (id?: string) => AURAS.find((a) => a.id === id)?.css ?? '';
