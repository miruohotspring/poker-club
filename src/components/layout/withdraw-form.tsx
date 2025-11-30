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

export default function WithdrawForm({
  currentBalance,
  roomId,
  open,
  closeHandler,
}: Props) {
  const [newBalanceInput, setNewBalanceInput] = useState('');
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
      await updateBalance({
        roomId,
        amount: newBalance,
        type: 'WITHDRAW',
      });
      closeHandler();
    } finally {
      setNewBalanceInput('');
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeHandler}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>引き出し</DialogTitle>
          <DialogDescription>
            引き出すチップ数を入力して残高を更新します。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <Input
              placeholder="引き出し額"
              type="number"
              inputMode="numeric"
              autoComplete="off"
              className="text-center"
              min={1}
              step={1}
              value={newBalanceInput}
              // 1以上の整数だけ通す
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^[1-9]\d*$/.test(value)) {
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
            {isLoading ? <Spinner /> : '引き出す'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
