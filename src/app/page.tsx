'use client';

import { Spinner } from '@/components/ui/spinner';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function RootPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/entrance');
    } else if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  // status: "loading" の間 & redirect が終わるまでローディング表示
  return (
    <div className="min-h-dvh flex items-center justify-center">
      <Spinner />
    </div>
  );
}
