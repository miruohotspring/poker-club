'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/entrance';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const id = String(formData.get('id') ?? '');
    const password = String(formData.get('password') ?? '');

    if (!id || !password) {
      setError('IDとパスワードを入力してください');
      setSubmitting(false);
      return;
    }

    const res = await signIn('credentials', {
      redirect: true,
      callbackUrl: callbackUrl,
      id,
      password,
    });

    if (res?.error) {
      setError('IDまたはパスワードが正しくありません');
      setSubmitting(false);
      return;
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <Card className="w-full max-w-sm shadow-lg rounded-2xl">
        <CardHeader className="pb-6">
          <p className="text-center text-base font-medium">
            ログイン・サインアップ
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="flex justify-center">
              <div className="w-full max-w-xs">
                <Input
                  name="id"
                  autoComplete="username"
                  placeholder="ID"
                  className="h-10 text-center w-full"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex justify-center">
              <div className="w-full max-w-xs">
                <Input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="パスワード"
                  className="h-10 text-center w-full"
                  disabled={submitting}
                />
              </div>
            </div>

            {error && (
              <p className="text-center text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-center">
              <div className="w-full max-w-xs">
                <Button
                  type="submit"
                  className="h-10 w-full"
                  disabled={submitting}
                >
                  {submitting ? <Spinner /> : 'ログイン'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
