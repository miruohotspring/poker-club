'use client';

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

interface Props {
  roomKey: string;
  open: boolean;
  closeHandler: () => void;
}

export default function CreateRoomForm({ roomKey, open, closeHandler }: Props) {
  const [newRoomName, setNewRoomName] = useState('');

  async function handleCreateNewRoom() {
    // TODO: createRoom(server action) を呼び出す
    console.log('create new room', { roomKey, newRoomName });

    // ひとまずポップアップを閉じるだけ
    closeHandler();
    setNewRoomName('');
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
            />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            onClick={handleCreateNewRoom}
            disabled={!newRoomName.trim()}
          >
            新規作成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
