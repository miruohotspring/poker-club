'use server';

import { ddbClient } from '@/lib/dynamo';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { ActionResult, Room } from './type';

export async function getRoomByKey(
  formData: FormData,
): Promise<ActionResult<Room | null>> {
  const roomKey = formData.get('roomKey');
  if (typeof roomKey !== 'string' || !/^[0-9]{6}$/.test(roomKey)) {
    return {
      success: false,
      error: 'invalid-room-key',
    };
  }

  const queryRes = await ddbClient.send(
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

  const item = queryRes.Items?.[0];

  if (!item) {
    return {
      success: true,
      body: null,
    };
  }

  return {
    success: true,
    body: {
      roomId: item.roomId as string,
      roomKey: item.roomKey as string,
      name: item.name as string,
      createdAt: new Date(item.createdAt as string),
      updatedAt: new Date(item.updatedAt as string),
    },
  };
}
