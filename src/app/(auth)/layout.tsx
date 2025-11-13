import { AuthProvider } from '@/auth-provider';
import { Header } from '@/components/layout/header';
import { getServerSession } from 'next-auth';
import { signIn } from 'next-auth/react';
// app/(auth)/layout.tsx
import type { ReactNode } from 'react';

export default async function Layout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession();

  if (!session) {
    signIn();
  }

  return (
    <AuthProvider session={session}>
      <div className="flex h-full flex-col">
        <Header />
        <div className="flex-1">{children}</div>
      </div>
    </AuthProvider>
  );
}
