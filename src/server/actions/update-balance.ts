'use server';

import { getServerSession } from 'next-auth';
import { GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuid } from 'uuid';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { docClient } from '@/lib/dynamo';
import type { ActionResult } from './type';
import { redirect } from 'next/navigation';

interface UpdateBalanceArgs {
  roomId: string;
  newBalance: number;
}

export async function updateBalance({
  roomId,
  newBalance,
}: UpdateBalanceArgs): Promise<ActionResult<void>> {
  const session = await getServerSession(options);
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  const pk = `ROOM#${roomId}`;
  const sk = `BALANCE#${userId}`;

  console.log(pk);
  console.log(sk);

  try {
    // ===============================
    // 1. 現在の残高レコードを取得
    // ===============================
    const getRes = await docClient.send(
      new GetCommand({
        TableName: process.env.POKER_APP_TABLE,
        Key: { pk, sk },
      }),
    );

    if (!getRes.Item) {
      return { success: false, error: 'not-found-balance' };
    }

    const previousBalance = getRes.Item.balance ?? 0;

    // ===============================
    // 2. 残高を更新
    // ===============================
    const updatedAt = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
        TableName: process.env.POKER_APP_TABLE,
        Key: { pk, sk },
        UpdateExpression: `
        SET balance = :newBalance,
            balanceLastUpdated = :updatedAt
      `,
        ExpressionAttributeValues: {
          ':newBalance': newBalance,
          ':updatedAt': updatedAt,
        },
      }),
    );

    // ===============================
    // 3. TXN レコードを作成（必ず作成）
    // ===============================
    const txnId = uuid();
    const txnSk = `TXN#${updatedAt}#${txnId}`;

    const txnItem = {
      pk,
      sk: txnSk,
      entityType: 'TXN',

      roomId,
      userId,
      txnType: 'UPDATE',

      previousBalance,
      updatedBalance: newBalance,

      createdAt: updatedAt,
      updatedAt: updatedAt,
    };

    await docClient.send(
      new PutCommand({
        TableName: process.env.POKER_APP_TABLE,
        Item: txnItem,
      }),
    );

    return {
      success: true,
      body: undefined,
    };
  } catch {
    return {
      success: false,
      error: 'internal-server-error',
    };
  }
}
