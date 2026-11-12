'use client';

import { useEffect } from 'react';
import { installTapSound } from '@/lib/sound';

/** Memasang efek "tik" lembut pada semua tombol di seluruh aplikasi. */
export default function SoundProvider() {
  useEffect(() => installTapSound(), []);
  return null;
}
