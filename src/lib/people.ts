import type { MemoryWho } from '@/types/memory';

/** Identitas kenangan: berdua atau sendiri. Warna "Ours" mengikuti aksen tema (pink). */
export const PEOPLE: Record<
  MemoryWho,
  { label: string; possessive: string; color: string | null; rgb: string | null; initial: string }
> = {
  together: { label: 'Ours', possessive: 'Our', color: null, rgb: null, initial: '' },
  ilhan: { label: 'Ilhan', possessive: 'Ilhan’s', color: '#7cc4ff', rgb: '124,196,255', initial: 'I' },
  nadya: { label: 'Nadya', possessive: 'Nadya’s', color: '#ffb38a', rgb: '255,179,138', initial: 'N' },
};

export const WHO_ORDER: MemoryWho[] = ['together', 'ilhan', 'nadya'];

/** Pasangan untuk teks seperti "what made you think of Nadya?" */
export const partnerOf = (who: MemoryWho) => (who === 'ilhan' ? 'Nadya' : who === 'nadya' ? 'Ilhan' : '');
