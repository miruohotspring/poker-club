'use client';

import { getLeaderBoard } from '@/server/actions/get-leaderboard';
import { Crown, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Spinner } from '../ui/spinner';

interface LeaderboardEntry {
  rank: number;
  name: string;
  chips: number;
}

interface Props {
  roomId: string;
}

export default function LeaderboardCard({ roomId }: Props) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchLeaderboard() {
    setIsLoading(true);
    try {
      const result = await getLeaderBoard(roomId);
      if (result.success) {
        setLeaderboard(result.body);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    void fetchLeaderboard();
  }, []);

  return (
    <Card className="gap-0 w-full max-w-md mx-auto rounded-2xl shadow-md mt-6 min-h-[60vh]">
      <div className="flex justify-end px-6 relative">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3"
          onClick={fetchLeaderboard}
          disabled={isLoading}
        >
          {isLoading ? <Spinner /> : <RotateCw className="w-5 h-5" />}
        </Button>
      </div>

      <CardHeader className="pb-2 pt-1">
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-xl font-bold text-center flex-1">
            リーダーボード
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden pt-1 pb-4">
        <div className="flex justify-end px-2">
          <p className="text-sm text-muted-foreground pr-2">チップ数</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Spinner className="w-8 h-8" />
          </div>
        ) : (
          <ScrollArea className="max-h-80 w-full pr-4">
            <div>
              {leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className="flex items-center justify-between py-3 border-b last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold w-7">
                      {entry.rank}.
                    </span>
                    <span className="text-base font-medium">{entry.name}</span>
                    {entry.rank === 1 && (
                      <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <span className="text-lg font-semibold tabular-nums">
                    {entry.chips.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
