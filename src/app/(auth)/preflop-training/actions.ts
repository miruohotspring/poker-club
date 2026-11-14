'use server';

import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { docClient } from '@/lib/dynamo';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { unstable_noStore as noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import {
  buildAttemptItem,
  buildAttemptQuery,
  buildSessionItem,
  buildSessionKey,
  buildSessionQuery,
  summarizeAttempts,
  type PreflopAttemptItem,
  type PreflopSessionItem,
  type PreflopSessionMode,
} from './practice-store';
import { actionForRoll, type TrainingAction } from './training-logic';

type SpotRow = {
  position: string;
  preflopActions: string;
  reachProb: number;
  jpActions: string | null;
};

type SimpleHandCounter = {
  total_frequency?: number;
  actions_total_frequencies?: Record<string, number>;
};

export type PreflopSpot = {
  id: string;
  position: string;
  preflopActions: string;
  reachProb: number;
  label: string;
};

export type PreflopQuestion = {
  spotId: string;
  position: string;
  spotLabel: string;
  handLabel: string;
  handDisplay: string;
  diceRoll: number;
  expectedActionKey: string;
  actions: TrainingAction[];
  preflopActions: string;
  historySpot: number;
};

export type PreflopAttemptView = Omit<
  PreflopAttemptItem,
  'pk' | 'sk' | 'entityType' | 'userId'
>;

export type PreflopSessionView = Omit<
  PreflopSessionItem,
  'pk' | 'sk' | 'entityType' | 'userId'
>;

export type PreflopTrainingSummary = ReturnType<typeof summarizeAttempts> & {
  history: PreflopAttemptView[];
  sessions: PreflopSessionView[];
  activeSession: PreflopSessionView | null;
};

const positions = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
const suitSymbols = ['♠', '♥', '♦', '♣'];
const tableName = process.env.POKER_APP_TABLE;

const parseCsvRows = (text: string) => {
  const lines = text.trim().split('\n');
  const rows: SpotRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const [position, preflopActions, reachProb, jpActions] = line.split(',');
    if (!position || !preflopActions || !reachProb) continue;
    rows.push({
      position,
      preflopActions,
      reachProb: Number(reachProb),
      jpActions: jpActions?.trim() ? jpActions.trim() : null,
    });
  }
  return rows;
};

const loadSpotRows = async () => {
  const csvPath = path.join(
    process.cwd(),
    'solutions',
    'cash6m100bb',
    'spot_frequencies_by_position.csv',
  );
  return parseCsvRows(await fs.readFile(csvPath, 'utf-8'));
};

const spotId = (row: SpotRow) => `${row.position}:${row.preflopActions}`;
const spotLabel = (row: SpotRow) =>
  row.jpActions ?? `${row.position}の最初の判断`;

export const getPreflopSpots = async (): Promise<PreflopSpot[]> => {
  noStore();
  return (await loadSpotRows()).map((row) => ({
    id: spotId(row),
    position: row.position,
    preflopActions: row.preflopActions === 'ROOT' ? '' : row.preflopActions,
    reachProb: row.reachProb,
    label: spotLabel(row),
  }));
};

const weightedPick = <T,>(items: T[], weight: (item: T) => number) => {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  const target = Math.random() * total;
  let running = 0;
  for (const item of items) {
    running += weight(item);
    if (target <= running) return item;
  }
  const last = items.at(-1);
  if (!last) throw new Error('No preflop spot is available');
  return last;
};

const toActionLabel = (action: {
  type?: string;
  betsize?: string | null;
  display_name?: string | null;
  allin?: boolean;
}) => {
  if (action.allin) return 'All-in';
  const betsize = action.betsize?.trim();
  switch (action.type) {
    case 'FOLD':
      return 'Fold';
    case 'CALL':
      return 'Call';
    case 'CHECK':
      return 'Check';
    case 'BET':
      return betsize ? `Bet ${betsize}` : 'Bet';
    case 'RAISE':
      return betsize ? `Raise ${betsize}` : 'Raise';
    default:
      return action.display_name ?? 'Action';
  }
};

const sampleDistinctSuits = () => {
  const firstIndex = Math.floor(Math.random() * suitSymbols.length);
  let secondIndex = Math.floor(Math.random() * suitSymbols.length);
  while (secondIndex === firstIndex) {
    secondIndex = Math.floor(Math.random() * suitSymbols.length);
  }
  return [suitSymbols[firstIndex], suitSymbols[secondIndex]] as const;
};

const buildHandDisplay = (handLabel: string) => {
  const rankA = handLabel[0];
  const rankB = handLabel[1];
  const suitedFlag = handLabel[2];
  if (!suitedFlag) {
    const [firstSuit, secondSuit] = sampleDistinctSuits();
    return `${rankA}${firstSuit}${rankB}${secondSuit}`;
  }
  if (suitedFlag === 's') {
    const suit = suitSymbols[Math.floor(Math.random() * suitSymbols.length)];
    return `${rankA}${suit}${rankB}${suit}`;
  }
  const [firstSuit, secondSuit] = sampleDistinctSuits();
  return `${rankA}${firstSuit}${rankB}${secondSuit}`;
};

export const getPreflopQuestion = async (
  fixedSpotId?: string | null,
): Promise<PreflopQuestion> => {
  noStore();
  const rows = await loadSpotRows();
  let pickedRow: SpotRow | undefined;
  if (fixedSpotId) {
    pickedRow = rows.find((row) => spotId(row) === fixedSpotId);
    if (!pickedRow) throw new Error('指定したスポットが見つかりません');
  } else {
    const position = positions[Math.floor(Math.random() * positions.length)];
    pickedRow = weightedPick(
      rows.filter((row) => row.position === position),
      (row) => row.reachProb,
    );
  }

  const jsonName =
    pickedRow.preflopActions === 'ROOT'
      ? 'root.json'
      : `${pickedRow.preflopActions}.json`;
  const jsonPath = path.join(
    process.cwd(),
    'solutions',
    'cash6m100bb',
    jsonName,
  );
  const spotJson = JSON.parse(await fs.readFile(jsonPath, 'utf-8')) as {
    action_solutions: Array<{
      action: {
        code?: string;
        type?: string;
        betsize?: string | null;
        display_name?: string;
        allin?: boolean;
      };
    }>;
    players_info: Array<{
      player?: { position?: string };
      simple_hand_counters?: Record<string, SimpleHandCounter>;
    }>;
  };
  const matchingPlayerInfo =
    spotJson.players_info.find(
      (player) => player.player?.position === pickedRow.position,
    ) ?? spotJson.players_info[0];
  const handCounters = matchingPlayerInfo?.simple_hand_counters ?? {};
  const availableHands = Object.entries(handCounters)
    .filter(([, counter]) => (counter?.total_frequency ?? 0) > 0)
    .map(([hand]) => hand);
  const handLabel =
    availableHands[Math.floor(Math.random() * availableHands.length)];
  if (!handLabel) throw new Error('出題できるハンドがありません');

  const actions: TrainingAction[] = spotJson.action_solutions.map(
    (solution, index) => {
      const code = solution.action.code ?? `action-${index}`;
      return {
        key: code,
        label: toActionLabel(solution.action),
        frequency:
          handCounters[handLabel]?.actions_total_frequencies?.[code] ?? 0,
        kind: (
          ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'].includes(
            solution.action.type ?? '',
          )
            ? solution.action.type
            : 'OTHER'
        ) as TrainingAction['kind'],
        betsize: solution.action.allin
          ? 'all-in'
          : (solution.action.betsize ?? null),
      };
    },
  );
  const diceRoll = Math.floor(Math.random() * 100) + 1;
  const expectedAction = actionForRoll(actions, diceRoll);
  const preflopActions =
    pickedRow.preflopActions === 'ROOT' ? '' : pickedRow.preflopActions;

  return {
    spotId: spotId(pickedRow),
    position: pickedRow.position,
    spotLabel: spotLabel(pickedRow),
    handLabel,
    handDisplay: buildHandDisplay(handLabel),
    diceRoll,
    expectedActionKey: expectedAction.key,
    actions,
    preflopActions,
    historySpot: preflopActions ? preflopActions.split('-').length : 0,
  };
};

const requireUserId = async () => {
  const session = await getServerSession(options);
  const userId = session?.user?.id;
  if (!userId) redirect('/login');
  return userId;
};

const requireTableName = () => {
  if (!tableName) throw new Error('POKER_APP_TABLE is not configured');
  return tableName;
};

const loadAttempts = async (userId: string) => {
  const response = await docClient.send(
    new QueryCommand(buildAttemptQuery(requireTableName(), userId)),
  );
  return (response.Items ?? []) as PreflopAttemptItem[];
};

const loadSessions = async (userId: string) => {
  const response = await docClient.send(
    new QueryCommand(buildSessionQuery(requireTableName(), userId)),
  );
  return (response.Items ?? []) as PreflopSessionItem[];
};

const toAttemptView = ({
  pk: _pk,
  sk: _sk,
  entityType: _entityType,
  userId: _userId,
  ...item
}: PreflopAttemptItem): PreflopAttemptView => item;

const toSessionView = ({
  pk: _pk,
  sk: _sk,
  entityType: _entityType,
  userId: _userId,
  ...item
}: PreflopSessionItem): PreflopSessionView => item;

const toSummary = (
  attempts: PreflopAttemptItem[],
  sessions: PreflopSessionItem[],
): PreflopTrainingSummary => {
  const activeSession = sessions.find((session) => session.status === 'ACTIVE');
  return {
    ...summarizeAttempts(attempts),
    history: attempts.slice(0, 50).map(toAttemptView),
    sessions: sessions
      .filter((session) => session.status === 'COMPLETED')
      .slice(0, 50)
      .map(toSessionView),
    activeSession: activeSession ? toSessionView(activeSession) : null,
  };
};

const loadSummary = async (userId: string) => {
  const [attempts, sessions] = await Promise.all([
    loadAttempts(userId),
    loadSessions(userId),
  ]);
  return toSummary(attempts, sessions);
};

export const getPreflopTrainingSummary = async () => {
  noStore();
  const userId = await requireUserId();
  return loadSummary(userId);
};

export const getPreflopSessionAttempts = async (sessionId: string) => {
  noStore();
  const userId = await requireUserId();
  return (await loadAttempts(userId))
    .filter((attempt) => attempt.sessionId === sessionId)
    .toSorted((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map(toAttemptView);
};

export const startPreflopTrainingSession = async (input: {
  mode: PreflopSessionMode;
  fixedSpotId?: string;
}) => {
  const userId = await requireUserId();
  const existingSessions = await loadSessions(userId);
  const existing = existingSessions.find((session) => session.status === 'ACTIVE');
  if (existing) {
    return {
      session: toSessionView(existing),
      summary: await loadSummary(userId),
    };
  }

  const startedAt = new Date().toISOString();
  const item = buildSessionItem({
    userId,
    sessionId: randomUUID(),
    startedAt,
    mode: input.mode,
    ...(input.mode === 'fixed' && input.fixedSpotId
      ? { fixedSpotId: input.fixedSpotId }
      : {}),
  });
  await docClient.send(
    new PutCommand({
      TableName: requireTableName(),
      Item: item,
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    }),
  );
  return {
    session: toSessionView(item),
    summary: toSummary(await loadAttempts(userId), [item, ...existingSessions]),
  };
};

export const endPreflopTrainingSession = async (input: {
  sessionId: string;
  startedAt: string;
}) => {
  const userId = await requireUserId();
  const key = buildSessionKey(userId, input.startedAt, input.sessionId);
  const currentResponse = await docClient.send(
    new GetCommand({
      TableName: requireTableName(),
      Key: key,
      ConsistentRead: true,
    }),
  );
  const current = currentResponse.Item as PreflopSessionItem | undefined;
  if (!current || current.entityType !== 'PREFLOP_TRAINING_SESSION') {
    throw new Error('練習セッションが見つかりません');
  }
  if (current.status === 'COMPLETED') {
    return {
      session: toSessionView(current),
      summary: await loadSummary(userId),
    };
  }

  const endedAt = new Date().toISOString();
  const durationSeconds = Math.max(
    0,
    Math.floor((Date.parse(endedAt) - Date.parse(current.startedAt)) / 1000),
  );
  const response = await docClient.send(
    new UpdateCommand({
      TableName: requireTableName(),
      Key: key,
      UpdateExpression:
        'SET #status = :completed, endedAt = :endedAt, durationSeconds = :durationSeconds, updatedAt = :endedAt',
      ConditionExpression: '#status = :active',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':active': 'ACTIVE',
        ':completed': 'COMPLETED',
        ':endedAt': endedAt,
        ':durationSeconds': durationSeconds,
      },
      ReturnValues: 'ALL_NEW',
    }),
  );
  const completed = response.Attributes as PreflopSessionItem;
  return {
    session: toSessionView(completed),
    summary: await loadSummary(userId),
  };
};

export const recordPreflopAttempt = async (input: {
  question: PreflopQuestion;
  selectedActionKey: string;
  sessionId: string;
  sessionStartedAt: string;
}) => {
  const userId = await requireUserId();
  const selectedAction = input.question.actions.find(
    (action) => action.key === input.selectedActionKey,
  );
  if (!selectedAction) throw new Error('選択したアクションが無効です');
  const expectedAction = actionForRoll(
    input.question.actions,
    input.question.diceRoll,
  );
  const createdAt = new Date().toISOString();
  const item = buildAttemptItem({
    userId,
    attemptId: randomUUID(),
    sessionId: input.sessionId,
    createdAt,
    position: input.question.position,
    spotId: input.question.spotId,
    preflopActions: input.question.preflopActions,
    spotLabel: input.question.spotLabel,
    handLabel: input.question.handLabel,
    handDisplay: input.question.handDisplay,
    diceRoll: input.question.diceRoll,
    selectedActionKey: selectedAction.key,
    selectedActionLabel: selectedAction.label,
    expectedActionKey: expectedAction.key,
    expectedActionLabel: expectedAction.label,
    correct: selectedAction.key === expectedAction.key,
    actions: input.question.actions,
  });
  const sessionKey = buildSessionKey(
    userId,
    input.sessionStartedAt,
    input.sessionId,
  );

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: requireTableName(),
            Item: item,
            ConditionExpression:
              'attribute_not_exists(pk) AND attribute_not_exists(sk)',
          },
        },
        {
          Update: {
            TableName: requireTableName(),
            Key: sessionKey,
            UpdateExpression:
              'SET updatedAt = :updatedAt ADD attempts :one, correct :correct',
            ConditionExpression: '#status = :active',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':active': 'ACTIVE',
              ':updatedAt': createdAt,
              ':one': 1,
              ':correct': item.correct ? 1 : 0,
            },
          },
        },
      ],
    }),
  );

  return {
    attempt: toAttemptView(item),
    summary: await loadSummary(userId),
  };
};
