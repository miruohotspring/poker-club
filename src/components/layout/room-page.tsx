'use client';

import { checkRoomBalance } from '@/server/actions/check-room-balance';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner } from '../ui/spinner';
import BalanceCard from './balance-card';
import { BottomTabBar, type TabKey } from './bottom-tab-bar';
import EnterNewRoomForm from './enter-new-room-form';
import LeaderBoard from './leader-board';
import { TransactionListCard } from './transactions';

export default function RoomPage() {
  const searchParams = useSearchParams();
  const roomKey = searchParams.get('roomKey') ?? '';
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isEnterDialogOpen, setIsEnterDialogOpen] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [balance, setBalance] = useState<number>();
  const [balanceUpdatedAt, setBalanceUpdatedAt] = useState<Date>();
  const [tab, setTab] = useState<TabKey>('chips');

  const TabComponents: Record<TabKey, React.ReactNode> = {
    chips: (
      <>
        {balance !== undefined && balanceUpdatedAt && (
          <BalanceCard
            balance={balance}
            updatedAt={balanceUpdatedAt}
            roomKey={roomKey}
            roomId={roomId}
          />
        )}
      </>
    ),
    leader: <LeaderBoard roomId={roomId} />,
    history: <TransactionListCard roomId={roomId} />,
    settings: (
      <div className="w-full max-w-md space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">ベータ版機能</p>
        <Link
          href="/preflop-training"
          className="block rounded-lg border border-dashed border-muted-foreground/40 px-4 py-3 text-sm font-medium text-foreground transition hover:border-muted-foreground hover:bg-muted"
        >
          /preflop-training
        </Link>
      </div>
    ),
  };

  useEffect(() => {
    if (!roomKey) {
      router.push('/entrance');
    }

    (async () => {
      const result = await checkRoomBalance(roomKey);

      // 部屋があるか
      if (result.success) {
        setRoomName(result.body.name);
        setRoomId(result.body.roomId);

        // 残高があるか
        if (result.body.balance !== undefined) {
          setBalance(result.body.balance);
          setBalanceUpdatedAt(result.body.balanceLastUpdated);
        } else {
          setIsEnterDialogOpen(true);
        }
        setIsLoading(false);
      }
    })();
  }, [roomKey, router]);

  return (
    <>
      <div className="h-full flex items-center justify-center px-4 pb-14">
        {isLoading && <Spinner />}
        {!isLoading && balance !== undefined && balanceUpdatedAt && (
          <>
            <div className="absolute top-20 left-3">
              {roomName}@{roomKey}
            </div>
            {TabComponents[tab]}
            <BottomTabBar active={tab} onSelect={setTab} />
          </>
        )}
        <EnterNewRoomForm
          roomKey={roomKey}
          roomId={roomId}
          roomName={roomName}
          open={isEnterDialogOpen}
          closeHandler={() => {
            router.push('/entrance');
          }}
          onSuccess={() => location.reload()}
        />
      </div>
    </>
  );
}
