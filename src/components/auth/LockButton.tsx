'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

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
      className={`rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm backdrop-blur-md transition active:scale-95 disabled:opacity-50 ${className}`}
    >
      🔒 Kunci
    </button>
  );
}
