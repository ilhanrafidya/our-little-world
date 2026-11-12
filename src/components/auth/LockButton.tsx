'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LockIcon } from '@/components/ui/icons';

export default function LockButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function lock() {
    setBusy(true);
    await fetch('/api/auth/lock', { method: 'POST' }).catch(() => null);
    router.replace('/unlock');
    router.refresh();
  }

  return (
    <button
      onClick={lock}
      disabled={busy}
      aria-label="Lock"
      title="Lock"
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur-md transition active:scale-90 disabled:opacity-50 ${className}`}
    >
      <LockIcon size={18} />
    </button>
  );
}
