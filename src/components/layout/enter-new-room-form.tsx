'use client';

import { enterRoom } from '@/server/actions/enter-room';
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
import { Spinner } from '../ui/spinner';

interface Props {
  roomKey: string;
  roomName: string;
  roomId: string;
  open: boolean;
  closeHandler: () => void;
  onSuccess?: () => void;
}

export default function EnterNewRoomForm({
  roomKey,
  roomName,
  roomId,
  open,
  closeHandler,
  onSuccess,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  async function onSubmit() {
    setIsLoading(true);
    const res = await enterRoom(roomKey, roomId);
    if (res.success) {
      router.push(`/room?roomKey=${roomKey}`);
      if (onSuccess) {
        onSuccess();
      }
    } else {
      router.push('/entrance');
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeHandler}>
      <DialogContent>
        <DialogHeader>
          <DialogDescription>部屋が見つかりました</DialogDescription>
          <DialogTitle>{roomName}</DialogTitle>
        </DialogHeader>

        <DialogFooter className="pt-4">
          <Button type="button" onClick={onSubmit} disabled={isLoading}>
            {isLoading ? <Spinner /> : '部屋に入る'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
