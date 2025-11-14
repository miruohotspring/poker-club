'use server';

import { getServerSession } from 'next-auth';
import { docClient } from '@/lib/dynamo';
import { GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import type { ActionResult } from './type';

type BuyInInput = {
  roomId: string;
  amount: number; // 購入チップ数
  buyIn: number; // 購入金額
};

export async function buyInAction(
  input: BuyInInput,
): Promise<ActionResult<void>> {
  const session = await getServerSession(options);
  if (!session?.user?.id) {
    redirect('/login');
  }

  try {
    const { roomId, amount, buyIn } = input;
    const userId = session.user.id;
    const tableName = process.env.POKER_APP_TABLE;

    if (!tableName) {
      throw new Error('POKER_APP_TABLE is not set');
    }

    const now = new Date().toISOString();
    const txnId = uuidv4();

    const balanceKey = {
      pk: `ROOM#${roomId}`,
      sk: `BALANCE#${userId}`,
    };

    // ============================================================
    // 1. 変更前残高の取得
    // ============================================================
    const balanceRes = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: balanceKey,
      }),
    );

    const previousBalance =
      typeof balanceRes.Item?.balance === 'number'
        ? balanceRes.Item.balance
        : 0;

    const updatedBalance = previousBalance + amount;

    // ============================================================
    // 2. BALANCE レコードの更新
    // ============================================================
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: balanceKey,
        UpdateExpression:
          'SET #balance = :updatedBalance, #updatedAt = :now, #createdAt = if_not_exists(#createdAt, :now)',
        ExpressionAttributeNames: {
          '#balance': 'balance',
          '#updatedAt': 'updatedAt',
          '#createdAt': 'createdAt',
        },
        ExpressionAttributeValues: {
          ':updatedBalance': updatedBalance,
          ':now': now,
        },
        ReturnValues: 'NONE',
      }),
    );

    // ============================================================
    // 3. トランザクションレコードの作成
    // ============================================================
    const txnSK = `TXN#${now}#${txnId}`;

    const txnItem = {
      pk: `ROOM#${roomId}`,
      sk: txnSK,
      entityType: 'TXN',

      roomId,
      userId,

      txnType: 'BUY',
      amount, // 購入チップ数
      buyIn, // 購入金額

      previousBalance,
      updatedBalance,

      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: txnItem,
      }),
    );

    return {
      success: true,
      body: undefined,
    };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'internal-server-error',
    };
  }
}
