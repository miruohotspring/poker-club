'use server';

import { options } from '@/app/api/auth/[...nextauth]/options';
import { ddbClient } from '@/lib/dynamo';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { ActionResult } from './type';

export async function enterRoom(
  roomKey: string,
  roomId: string,
): Promise<ActionResult<void>> {
  const session = await getServerSession(options);

  const userId = session?.user?.id;
  if (!userId) {
    redirect('/login');
  }
  if (!/^[0-9]{6}$/.test(roomKey)) {
    return { success: false, error: 'invalid-room-key' };
  }

  const now = new Date();
  const isoNow = now.toISOString();

  const res = await ddbClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: process.env.POKER_APP_TABLE,
            Item: {
              pk: `ROOM#${roomId}`,
              sk: `BALANCE#${userId}`,
              entityType: 'BALANCE',

              roomId,
              userId,
              userName: session.user.email,
              balance: 0,

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
  if (res) {
    return {
      success: true,
      body: undefined,
    };
  }

  return {
    success: false,
    error: 'internal-server-error',
  };
}
