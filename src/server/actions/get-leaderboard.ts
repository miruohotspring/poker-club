'use server';

import { docClient } from '@/lib/dynamo';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { ActionResult } from './type';

const TABLE_NAME = process.env.POKER_APP_TABLE;

export interface LeaderboardEntry {
  rank: number;
  name: string;
  chips: number;
}

interface BalanceRecord {
  pk: string;
  sk: string;
  roomId: string;
  userId: string;
  userName?: string;
  balance?: number | string;
}

export async function getLeaderBoard(
  roomId: string,
): Promise<ActionResult<LeaderboardEntry[]>> {
  try {
    const res = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `ROOM#${roomId}`,
          ':skPrefix': 'BALANCE#',
        },
      }),
    );

    const items = (res.Items ?? []) as BalanceRecord[];

    const sorted = items
      .map((item) => {
        const raw = item.balance;
        const chips = typeof raw === 'number' ? raw : raw ? Number(raw) : 0;

        return {
          userName: item.userName || '名無し',
          chips,
        };
      })
      .sort((a, b) => b.chips - a.chips);

    const leaderboard: LeaderboardEntry[] = sorted.map((row, index) => ({
      rank: index + 1,
      name: row.userName,
      chips: row.chips,
    }));

    return {
      success: true,
      body: leaderboard,
    };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'internal-server-error',
    };
  }
}
