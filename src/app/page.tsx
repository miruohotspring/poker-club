'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Spinner } from '@/components/ui/spinner';

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
