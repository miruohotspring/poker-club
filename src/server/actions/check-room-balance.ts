'use server';

import { options } from '@/app/api/auth/[...nextauth]/options';
import { ddbClient } from '@/lib/dynamo';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { ActionResult } from './type';

type RoomSummary = {
  roomId: string;
  roomKey: string;
  name: string;
  balance?: number;
  balanceLastUpdated?: Date;
};

export async function checkRoomBalance(
  roomKey: string,
): Promise<ActionResult<RoomSummary>> {
  const session = await getServerSession(options);
  const userId = session?.user?.id;

  if (!userId) {
    redirect('/login');
  }

  if (!/^[0-9]{6}$/.test(roomKey)) {
    return {
      success: false,
      error: 'invalid-room-key',
    };
  }

  const roomRes = await ddbClient.send(
    new QueryCommand({
      TableName: process.env.POKER_APP_TABLE,
      IndexName: 'gsi_room_key',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `ROOMKEY#${roomKey}`,
      },
      Limit: 1,
    }),
  );

  const roomItem = roomRes.Items?.[0];
  if (!roomItem) {
    // 1. 部屋がない
    return {
      success: false,
      error: 'not-found-room',
    };
  }

  const balanceRes = await ddbClient.send(
    new GetCommand({
      TableName: process.env.POKER_APP_TABLE,
      Key: {
        pk: `ROOM#${roomItem.roomId as string}`,
        sk: `BALANCE#${userId}`,
      },
    }),
  );

  const balanceItem = balanceRes.Item;

  const room: RoomSummary = {
    roomId: roomItem.roomId as string,
    roomKey: roomItem.roomKey as string,
    name: roomItem.name as string,
  };

  if (!balanceItem) {
    // 2. 部屋はあるが残高がない
    return {
      success: true,
      body: room,
    };
  }

  return {
    // 3. 部屋も残高もある
    success: true,
    body: {
      ...room,
      balance: balanceItem.balance as number,
      balanceLastUpdated: new Date(balanceItem.updatedAt as string),
    },
  };
}
