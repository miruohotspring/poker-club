'use client';

import { signOut, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function Header() {
  const { data: session } = useSession();
  const userName = session?.user?.email ?? 'ゲスト';

  return (
    <header className="p-4 border-b flex items-center justify-between">
      <h1 className="text-xl font-bold">{userName} さん</h1>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => signOut({ callbackUrl: '/login' })}
      >
        ログアウト
      </Button>
    </header>
  );
}
