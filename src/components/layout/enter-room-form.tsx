'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { checkRoomBalance } from '@/server/actions/check-room-balance';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import CreateRoomForm from './create-room-form';
import EnterNewRoomForm from './enter-new-room-form';
import EnterRoomCheckForm from './enter-room-check-form';

type RecentRoom = {
  roomId: string;
  roomKey: string;
  name: string;
};

type Props = {
  recentRooms?: RecentRoom[];
};

export default function EnterRoomForm({ recentRooms = [] }: Props) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [roomKey, setRoomKey] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false); // 1. 部屋がない
  const [isEnterNewDialogOpen, setIsEnterNewDialogOpen] = useState(false); //2. 部屋はあるが残高がない
  const [isEnterDialogOpen, setIsEnterDialogOpen] = useState(false); // 3. 部屋も残高もある
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      // 部屋・残高確認
      const result = await checkRoomBalance(formData.get('roomKey') as string);

      if (!result.success) {
        // 1. 部屋がない
        if (result.error === 'not-found-room') {
          setIsCreateDialogOpen(true);
        }
        router.refresh();
      } else {
        setRoomName(result.body.name);
        setRoomId(result.body.roomId);

        // 2. 部屋はあるが残高がない
        if (result.body.balance === undefined) {
          setIsEnterNewDialogOpen(true);
        }

        // 3. 部屋も残高もある
        if (
          result.body.balance !== undefined &&
          result.body.balanceLastUpdated
        ) {
          setIsEnterDialogOpen(true);
        }
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
            {recentRooms.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  最近入室した部屋
                </p>
                <div className="grid gap-2">
                  {recentRooms.map((room) => (
                    <Button
                      key={room.roomId}
                      asChild
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <Link href={`/room?roomKey=${room.roomKey}`}>
                        <span>{room.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {room.roomKey}
                        </span>
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            )}
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
      <EnterNewRoomForm
        roomKey={roomKey}
        roomId={roomId}
        roomName={roomName}
        open={isEnterNewDialogOpen}
        closeHandler={() => setIsEnterNewDialogOpen(false)}
      />
    </>
  );
}
