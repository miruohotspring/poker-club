'use client';

import { useEffect, useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';

import { getTransactions } from '@/server/actions/get-transactions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Spinner } from '../ui/spinner';

type TransactionType = 'BUY' | 'UPDATE';

type Transaction = {
  id: string;
  userName: string;
  type: TransactionType;
  buyInAmount?: number | null;
  previousBalance: number;
  updatedBalance: number;
  createdAt: string; // ISO文字列
};

export function TransactionListCard({ roomId }: { roomId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const sample: Transaction[] = [
    {
      id: 'txn-1',
      userName: 'hoge',
      type: 'BUY',
      buyInAmount: 1000,
      previousBalance: 0,
      updatedBalance: 500,
      createdAt: '2025-11-14T16:12:00.000Z',
    },
    {
      id: 'txn-2',
      userName: 'piyo',
      type: 'UPDATE',
      previousBalance: 500,
      updatedBalance: 750,
      createdAt: '2025-11-14T16:03:00.000Z',
    },
    {
      id: 'txn-3',
      userName: 'fuga',
      type: 'BUY',
      buyInAmount: 2000,
      previousBalance: 1000,
      updatedBalance: 2000,
      createdAt: '2025-11-14T15:03:00.000Z',
    },
    {
      id: 'txn-4',
      userName: 'foo',
      type: 'UPDATE',
      previousBalance: 2000,
      updatedBalance: 1800,
      createdAt: '2025-11-14T14:50:00.000Z',
    },
    {
      id: 'txn-5',
      userName: 'bar',
      type: 'BUY',
      buyInAmount: 500,
      previousBalance: 1800,
      updatedBalance: 2050,
      createdAt: '2025-11-14T14:40:00.000Z',
    },
    {
      id: 'txn-6',
      userName: 'hoge',
      type: 'BUY',
      buyInAmount: 1000,
      previousBalance: 0,
      updatedBalance: 500,
      createdAt: '2025-11-14T16:12:00.000Z',
    },
    {
      id: 'txn-7',
      userName: 'piyo',
      type: 'UPDATE',
      previousBalance: 500,
      updatedBalance: 750,
      createdAt: '2025-11-14T16:03:00.000Z',
    },
    {
      id: 'txn-8',
      userName: 'fuga',
      type: 'BUY',
      buyInAmount: 2000,
      previousBalance: 1000,
      updatedBalance: 2000,
      createdAt: '2025-11-14T15:03:00.000Z',
    },
    {
      id: 'txn-9',
      userName: 'foo',
      type: 'UPDATE',
      previousBalance: 2000,
      updatedBalance: 1800,
      createdAt: '2025-11-14T14:50:00.000Z',
    },
    {
      id: 'txn-10',
      userName: 'bar',
      type: 'BUY',
      buyInAmount: 500,
      previousBalance: 1800,
      updatedBalance: 2050,
      createdAt: '2025-11-14T14:40:00.000Z',
    },
  ];

  const load = () => {
    startTransition(async () => {
      const result = await getTransactions(roomId);
      if (result.success) {
        const sorted = result.body
          .slice()
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        setTransactions(sorted);
        setIsInitialLoading(false);
      }
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    load();
  }, []);

  return (
    <Card className="gap-0 w-full max-w-md mx-auto rounded-2xl shadow-md mt-12 min-h-[60vh]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">履歴</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={load}
          disabled={isPending}
          aria-label="履歴を更新"
        >
          <RotateCcw className={cn('h-5 w-5', isPending && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[420px] pr-2 pb-12">
          {isInitialLoading ? (
            <Spinner />
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              まだ履歴はありません
            </div>
          ) : (
            <div className="space-y-2 py-1">
              {transactions.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

type TransactionItemProps = {
  transaction: Transaction;
};

function TransactionItem({ transaction }: TransactionItemProps) {
  const delta = transaction.updatedBalance - transaction.previousBalance;

  const balanceClass =
    delta > 0
      ? 'text-green-400'
      : delta < 0
        ? 'text-red-400'
        : 'text-muted-foreground';

  const formattedDate = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(transaction.createdAt));

  return (
    <div className="py-3 border-t border-border first:border-t-0">
      <div className="flex items-center justify-between">
        <p className="text-sm leading-snug">
          <span className="font-bold">{transaction.userName}</span>
          {transaction.type === 'BUY' ? (
            <> が ¥{formatYen(transaction.buyInAmount ?? 0)} Buy-In</>
          ) : (
            <> が 残高を更新</>
          )}
        </p>
      </div>

      <div className="mt-1 flex items-baseline justify-between text-xs">
        <span className={cn('tabular-nums', balanceClass)}>
          {formatYen(transaction.previousBalance)} →{' '}
          {formatYen(transaction.updatedBalance)}
        </span>
        <span className="text-muted-foreground">{formattedDate}</span>
      </div>
    </div>
  );
}

function formatYen(value: number): string {
  return value.toLocaleString('ja-JP', {
    maximumFractionDigits: 0,
  });
}
