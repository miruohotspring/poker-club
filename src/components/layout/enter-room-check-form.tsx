'use client';

import Link from 'next/link';
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
  open: boolean;
  closeHandler: () => void;
}

export default function EnterRoomCheckForm({
  roomKey,
  roomName,
  open,
  closeHandler,
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <Dialog open={open} onOpenChange={closeHandler}>
      <DialogContent>
        <DialogHeader>
          <DialogDescription>部屋が見つかりました</DialogDescription>
          <DialogTitle>{roomName}</DialogTitle>
        </DialogHeader>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            onClick={() => setIsLoading(true)}
            disabled={isLoading}
          >
            <Link href={`/room?roomKey=${roomKey}`}>
              {isLoading ? <Spinner /> : '部屋に入る'}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
