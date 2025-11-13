'use client';

import { createRoom } from '@/server/actions/create-room';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';

interface Props {
  roomKey: string;
  open: boolean;
  closeHandler: () => void;
  // 必要なら onCreated?: (room: { roomId: string; roomKey: string; name: string }) => void;
}

export default function CreateRoomForm({ roomKey, open, closeHandler }: Props) {
  const [newRoomName, setNewRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleCreateNewRoom() {
    if (!newRoomName.trim()) return;

    setIsLoading(true);
    try {
      const result = await createRoom({
        roomKey,
        roomName: newRoomName.trim(),
      });

      if (!result.success) {
        console.error('createRoom error', result.error);
        // TODO: エラー表示
        return;
      }

      const room = result.body;

      router.push(`/room?roomKey=${room.roomKey}`);

      closeHandler();
      setNewRoomName('');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeHandler}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>部屋を新規作成</DialogTitle>
          <DialogDescription>
            部屋が見つかりませんでした。新しく作成しますか？
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">部屋名</label>
            <Input
              placeholder="例: 金曜ナイトテーブル"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            onClick={handleCreateNewRoom}
            disabled={isLoading || !newRoomName.trim()}
          >
            {isLoading ? <Spinner /> : '新規作成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
