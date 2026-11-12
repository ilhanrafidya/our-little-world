import UnlockForm from '@/components/auth/UnlockForm';

/** Hanya izinkan redirect ke path internal (cegah open redirect seperti //evil.com). */
function safeNext(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return '/';
  return v;
}

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return <UnlockForm next={safeNext(next)} />;
}
