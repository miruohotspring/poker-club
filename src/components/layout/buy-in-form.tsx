'use client';

import { buyInAction } from '@/server/actions/buy-in';
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
  roomId: string;
  open: boolean;
  closeHandler: () => void;
}

export default function BuyInForm({ roomId, open, closeHandler }: Props) {
  // 購入チップ数
  const [amountInput, setAmountInput] = useState(
    process.env.DEFAULT_BUYIN_AMOUNT ?? '500',
  );

  // 購入額
  const [buyinInput, setBuyinInput] = useState(
    process.env.DEFAULT_BUYIN ?? '1000',
  );

  const [isLoading, setIsLoading] = useState(false);

  // 購入チップ数
  const isAmountValid = useMemo(() => {
    if (amountInput === '') return false;
    if (!/^\d+$/.test(amountInput)) return false;
    const n = Number(amountInput);
    return Number.isInteger(n) && n > 0;
  }, [amountInput]);

  // 購入額
  const isBuyinValid = useMemo(() => {
    if (buyinInput === '') return false;
    if (!/^\d+$/.test(buyinInput)) return false;
    const n = Number(buyinInput);
    return Number.isInteger(n) && n > 0;
  }, [buyinInput]);

  async function handleBuyIn() {
    if (!isAmountValid || !isBuyinValid) return;

    const amount = Number(amountInput);
    const buyin = Number(buyinInput);

    setIsLoading(true);
    try {
      const result = await buyInAction({
        roomId,
        amount: amount,
        buyIn: buyin,
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
          <DialogTitle>Buy-In</DialogTitle>
          <DialogDescription>
            チップ数と金額を入力してBuy-Inします
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">チップ数</label>
            <Input
              type="number"
              inputMode="numeric"
              autoComplete="off"
              className="text-center"
              min={0}
              step={1}
              value={amountInput}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || /^\d*$/.test(value)) {
                  setAmountInput(value);
                }
              }}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">金額</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                ￥
              </span>
              <Input
                type="number"
                inputMode="numeric"
                autoComplete="off"
                className="text-center"
                min={0}
                step={1}
                value={buyinInput}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*$/.test(value)) {
                    setBuyinInput(value);
                  }
                }}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button
            type="button"
            onClick={handleBuyIn}
            disabled={isLoading || !isAmountValid}
          >
            {isLoading ? <Spinner /> : 'Buy-Inする'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
