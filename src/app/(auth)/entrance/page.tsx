'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { enterRoom } from '@/server/actions/enter-room';
import type React from 'react';
import { useState } from 'react';

export default function EnterRoomPage() {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    await enterRoom(formData);

    setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  }

  return (
    <div className="h-full flex items-center justify-center px-4 pb-14">
      <Card className="w-full max-w-sm shadow-lg rounded-2xl">
        <CardHeader className="pb-6">
          <p className="text-center text-base font-medium">
            部屋キーを入力してください
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-8">
            <div className="flex justify-center">
              <Input
                name="roomKey"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="数字6桁"
                autoComplete="off"
                className="h-10 text-center max-w-xs"
                disabled={isLoading}
                onInput={(e) => {
                  const target = e.target as HTMLInputElement;
                  target.value = target.value.replace(/[^0-9]/g, '');
                }}
              />
            </div>

            <div className="flex justify-center">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Spinner />}
                入室
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
