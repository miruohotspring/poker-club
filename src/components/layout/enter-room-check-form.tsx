'use client';

import Link from 'next/link';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

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
  return (
    <Dialog open={open} onOpenChange={closeHandler}>
      <DialogContent>
        <DialogHeader>
          <DialogDescription>部屋が見つかりました</DialogDescription>
          <DialogTitle>{roomName}</DialogTitle>
        </DialogHeader>

        <DialogFooter className="pt-4">
          <Button type="button">
            <Link href={`/room?roomKey=${roomKey}`}>再入室</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
