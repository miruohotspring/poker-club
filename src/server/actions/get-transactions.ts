'use server';

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '@/lib/dynamo';
import type { ActionResult } from './type';

const TABLE_NAME = process.env.POKER_APP_TABLE;

if (!TABLE_NAME) {
  throw new Error('POKER_APP_TABLE is not set');
}

export type TransactionType = 'BUY' | 'UPDATE';

export type Transaction = {
  id: string;
  userName: string;
  type: TransactionType;
  buyInAmount?: number | null;
  previousBalance: number;
  updatedBalance: number;
  createdAt: string; // ISO 文字列
};

export async function getTransactions(
  roomId: string,
): Promise<ActionResult<Transaction[]>> {
  try {
    const pk = `ROOM#${roomId}`;

    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':skPrefix': 'TXN#',
      },
      ScanIndexForward: false,
    });

    const res = await docClient.send(command);
    const items = res.Items ?? [];

    const transactions: Transaction[] = items.map((item) => {
      return {
        id: String(item.sk),
        userName: String(item.userName),
        type: String(item.txnType) as TransactionType,
        buyInAmount:
          item.buyIn !== undefined && item.buyIn !== ''
            ? Number(item.buyIn)
            : null,
        previousBalance:
          item.previousBalance !== undefined && item.previousBalance !== ''
            ? Number(item.previousBalance)
            : 0,
        updatedBalance:
          item.updatedBalance !== undefined && item.updatedBalance !== ''
            ? Number(item.updatedBalance)
            : 0,
        // createdAt が入っていなければ updatedAt を fallback
        createdAt: String(item.createdAt ?? item.updatedAt),
      };
    });

    return {
      success: true,
      body: transactions,
    };
  } catch (e) {
    console.error(e);
    return {
      success: false,
      error: 'internal-server-error',
    };
  }
}
