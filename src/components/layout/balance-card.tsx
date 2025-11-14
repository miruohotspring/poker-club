'use client';

import { checkRoomBalance } from '@/server/actions/check-room-balance';
import { RotateCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Spinner } from '../ui/spinner';
import BuyInForm from './buy-in-form';
import UpdatedBalanceForm from './update-balance-form';

interface Props {
  balance: number;
  updatedAt: Date;
  roomKey: string;
  roomId: string;
}

export default function BalanceCard(props: Props) {
  const [balance, setBalance] = useState(props.balance);
  const [updatedAt, setUpdatedAt] = useState(props.updatedAt);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isBuyInDialogOpen, setBuyInDialogOpen] = useState(false);
  const router = useRouter();

  const formattedUpdatedAt =
    updatedAt != null
      ? `${updatedAt.getFullYear()}/${String(updatedAt.getMonth() + 1).padStart(
          2,
          '0',
        )}/${String(updatedAt.getDate()).padStart(
          2,
          '0',
        )} ${String(updatedAt.getHours()).padStart(2, '0')}:${String(
          updatedAt.getMinutes(),
        ).padStart(2, '0')}`
      : '-';

  async function fetchBalance() {
    setIsLoading(true);
    const result = await checkRoomBalance(props.roomKey);
    if (!result.success) {
      router.push('/entrance');
    } else {
      if (result.body.balance !== undefined && result.body.balanceLastUpdated) {
        setBalance(result.body.balance);
        setUpdatedAt(result.body.balanceLastUpdated);
      }
    }
    setIsLoading(false);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    void fetchBalance();
  }, []);

  return (
    <>
      <Card className="w-full max-w-md mx-auto rounded-2xl shadow-md">
        <div className="flex justify-end px-6 relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3"
            onClick={fetchBalance}
            disabled={isLoading}
          >
            {isLoading ? <Spinner /> : <RotateCw className="w-5 h-5" />}
          </Button>
        </div>
        <CardHeader className="pb-2 flex flex-row items-start justify-between">
          <div className="space-y-4 w-full">
            <p className="text-center text-sm text-muted-foreground">
              現在の残高
            </p>
            <div className="h-12 flex items-center justify-center">
              {isLoading ? (
                <Skeleton className="h-8 w-[150px] mx-auto" />
              ) : (
                <CardTitle className="text-center text-4xl font-bold tracking-widest leading-none">
                  {balance?.toLocaleString() ?? '0'}
                </CardTitle>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 pb-6 space-y-6">
          <p className="text-center text-xs text-muted-foreground">
            最終更新日：{formattedUpdatedAt}
          </p>

          <div className="space-y-3 mt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setIsUpdateDialogOpen(true)}
            >
              残高を更新
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setBuyInDialogOpen(true)}
            >
              Buy-In
            </Button>
          </div>
        </CardContent>
      </Card>
      <UpdatedBalanceForm
        currentBalance={balance}
        roomId={props.roomId}
        open={isUpdateDialogOpen}
        closeHandler={() => setIsUpdateDialogOpen(false)}
      />
      <BuyInForm
        roomId={props.roomId}
        open={isBuyInDialogOpen}
        closeHandler={() => setBuyInDialogOpen(false)}
      />
    </>
  );
}
