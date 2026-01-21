'use server';

import { options } from '@/app/api/auth/[...nextauth]/options';
import { ddbClient } from '@/lib/dynamo';
import { BatchGetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

type RecentRoom = {
  roomId: string;
  roomKey: string;
  name: string;
};

const ROOM_SK_PREFIX = 'JOINED_AT#';
const ROOM_DELIMITER = '#ROOM#';

function extractRoomInfo(sortKey: string): {
  roomId: string | null;
  joinedAt: string | null;
} {
  const [prefix, roomId] = sortKey.split(ROOM_DELIMITER);
  if (!roomId) {
    return { roomId: null, joinedAt: null };
  }
  const joinedAt = prefix?.replace(ROOM_SK_PREFIX, '') ?? null;
  return { roomId, joinedAt };
}

export async function getRecentRooms(): Promise<RecentRoom[]> {
  const session = await getServerSession(options);
  const userId = session?.user?.id;

  if (!userId) {
    redirect('/login');
  }

  const queryRes = await ddbClient.send(
    new QueryCommand({
      TableName: process.env.POKER_APP_TABLE,
      IndexName: 'gsi_user_rooms',
      KeyConditionExpression: 'gsi2pk = :pk AND begins_with(gsi2sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': ROOM_SK_PREFIX,
      },
      ScanIndexForward: false,
    }),
  );

  const seenRoomIds = new Set<string>();
  const recentRooms = (queryRes.Items ?? [])
    .map((item) => extractRoomInfo(item.gsi2sk as string))
    .filter(
      (info): info is { roomId: string; joinedAt: string | null } =>
        Boolean(info.roomId),
    )
    .filter((info) => {
      if (seenRoomIds.has(info.roomId)) {
        return false;
      }
      seenRoomIds.add(info.roomId);
      return true;
    })
    .sort((a, b) => {
      const aTime = a.joinedAt ?? '';
      const bTime = b.joinedAt ?? '';
      return bTime.localeCompare(aTime);
    });

  if (recentRooms.length === 0) {
    return [];
  }

  const roomIds = recentRooms.map((room) => room.roomId);

  const batchRes = await ddbClient.send(
    new BatchGetCommand({
      RequestItems: {
        [process.env.POKER_APP_TABLE as string]: {
          Keys: roomIds.map((roomId) => ({
            pk: `ROOM#${roomId}`,
            sk: 'META',
          })),
        },
      },
    }),
  );

  const roomItems =
    batchRes.Responses?.[process.env.POKER_APP_TABLE as string] ?? [];
  const roomMap = new Map(
    roomItems.map((item) => [
      item.roomId as string,
      {
        roomId: item.roomId as string,
        roomKey: item.roomKey as string,
        name: item.name as string,
      },
    ]),
  );

  return roomIds
    .map((roomId) => roomMap.get(roomId))
    .filter((room): room is RecentRoom => Boolean(room));
}
