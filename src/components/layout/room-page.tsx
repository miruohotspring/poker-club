'use client';

import { checkRoomBalance } from '@/server/actions/check-room-balance';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner } from '../ui/spinner';
import EnterNewRoomForm from './enter-new-room-form';

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
        {!isLoading && (
          <div>
            <p>残高: {balance}</p>
            <p>更新日: {balanceUpdatedAt?.toLocaleDateString()}</p>
          </div>
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
