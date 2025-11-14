'use server';

import { randomUUID } from 'node:crypto';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { ddbClient } from '@/lib/dynamo';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { ActionResult } from './type';

type CreateRoomInput = {
  roomKey: string;
  roomName: string;
};

type Room = {
  roomId: string;
  roomKey: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function createRoom(
  input: CreateRoomInput,
): Promise<ActionResult<Room>> {
  const session = await getServerSession(options);

  const userId = session?.user?.id;
  if (!userId) {
    redirect('/login');
  }

  const { roomKey, roomName } = input;

  if (!/^[0-9]{6}$/.test(roomKey)) {
    return { success: false, error: 'invalid-room-key' };
  }
  if (!roomName.trim()) {
    return { success: false, error: 'invalid-room-name' };
  }

  const roomId = randomUUID();
  const now = new Date();
  const isoNow = now.toISOString();

  try {
    await ddbClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.POKER_APP_TABLE,
              Item: {
                pk: `ROOM#${roomId}`,
                sk: 'META',
                entityType: 'ROOM',

                roomId,
                roomKey,
                name: roomName,

                gsi1pk: `ROOMKEY#${roomKey}`,
                gsi1sk: `ROOM#${roomId}`,

                createdAt: isoNow,
                updatedAt: isoNow,
              },
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
          {
            Put: {
              TableName: process.env.POKER_APP_TABLE,
              Item: {
                pk: `ROOM#${roomId}`,
                sk: `BALANCE#${userId}`,
                entityType: 'BALANCE',

                roomId,
                userId,
                balance: 0,
                userName: session.user.email,

                gsi2pk: `USER#${userId}`,
                gsi2sk: `JOINED_AT#${isoNow}#ROOM#${roomId}`,

                createdAt: isoNow,
                updatedAt: isoNow,
                joinedAt: isoNow,
              },
              ConditionExpression:
                'attribute_not_exists(pk) AND attribute_not_exists(sk)',
            },
          },
        ],
      }),
    );

    return {
      success: true,
      body: {
        roomId,
        roomKey,
        name: roomName,
        createdAt: now,
        updatedAt: now,
      },
    };
  } catch (err) {
    console.error('createRoom error', err);
    return { success: false, error: 'internal-server-error' };
  }
}
