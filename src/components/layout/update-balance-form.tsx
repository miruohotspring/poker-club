'use client';

import { updateBalance } from '@/server/actions/update-balance';
import { useMemo, useState } from 'react';
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
  currentBalance: number;
  roomId: string;
  open: boolean;
  closeHandler: () => void;
}

export default function UpdatedBalanceForm({
  currentBalance,
  roomId,
  open,
  closeHandler,
}: Props) {
  const [newBalanceInput, setNewBalanceInput] = useState(
    String(currentBalance),
  );
  const [isLoading, setIsLoading] = useState(false);

  const isValid = useMemo(() => {
    if (newBalanceInput === '') return false;
    if (!/^\d+$/.test(newBalanceInput)) return false;
    const n = Number(newBalanceInput);
    return Number.isInteger(n) && n >= 0;
  }, [newBalanceInput]);

  async function handleUpdateBalance() {
    if (!isValid) return;

    const newBalance = Number(newBalanceInput);

    setIsLoading(true);
    try {
      const result = await updateBalance({
        roomId,
        newBalance: newBalance,
      });
      console.log(result);
      closeHandler();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeHandler}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>残高を更新</DialogTitle>
          <DialogDescription>
            新しい残高を入力して残高を更新します。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <Input
              placeholder="新しい残高"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              className="text-center"
              min={0}
              step={1}
              value={newBalanceInput}
              // 0以上の整数だけ通す
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*$/.test(value)) {
                  setNewBalanceInput(value);
                }
              }}
              disabled={isLoading}
            />
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            onClick={handleUpdateBalance}
            disabled={isLoading || !isValid}
          >
            {isLoading ? <Spinner /> : '残高を更新'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
