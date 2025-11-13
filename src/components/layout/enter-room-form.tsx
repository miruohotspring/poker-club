'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { getRoomByKey } from '@/server/actions/get-room-by-key';
import type React from 'react';
import { useState } from 'react';
import CreateRoomForm from './create-room-form';
import EnterRoomCheckForm from './enter-room-check-form';

export default function EnterRoomForm() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [roomKey, setRoomKey] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEnterDialogOpen, setIsEnterDialogOpen] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const result = await getRoomByKey(formData);

      if (result.success) {
        if (result.body) {
          setRoomName(result.body.name);
          setIsEnterDialogOpen(true);
        } else {
          setIsCreateDialogOpen(true);
        }
      } else {
        // TODO: error handling
        console.error('failed to get room');
      }
    } finally {
      setIsLoading(false);
    }

    setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  }

  return (
    <>
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
                  value={roomKey}
                  onChange={(e) => {
                    const value = e.target.value
                      .replace(/[^0-9]/g, '')
                      .slice(0, 6);
                    setRoomKey(value);
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
      <CreateRoomForm
        roomKey={roomKey}
        open={isCreateDialogOpen}
        closeHandler={() => setIsCreateDialogOpen(false)}
      />
      <EnterRoomCheckForm
        roomKey={roomKey}
        roomName={roomName}
        open={isEnterDialogOpen}
        closeHandler={() => setIsEnterDialogOpen(false)}
      />
    </>
  );
}
