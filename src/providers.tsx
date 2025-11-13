'use client';

import { SessionProvider } from 'next-auth/react';
import React, { useEffect, type ReactNode } from 'react';
import { signIn, useSession } from 'next-auth/react';

export const AppProviders = ({ children }: { children: ReactNode }) => {
  return <SessionProvider>{children}</SessionProvider>;
};

export const Auth = ({ children }: { children: ReactNode }) => {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') {
      return;
    }
    if (!session) {
      signIn();
      return;
    }
  });

  if (!session) {
    return null;
  }

  return <>{children}</>;
};

export default Auth;
