import type { TrainingAction } from './training-logic';

export type PreflopSessionMode = 'random' | 'fixed';

export type PreflopAttemptInput = {
  userId: string;
  attemptId: string;
  sessionId?: string;
  createdAt: string;
  position: string;
  spotId: string;
  preflopActions: string;
  spotLabel: string;
  handLabel: string;
  handDisplay: string;
  diceRoll: number;
  selectedActionKey: string;
  selectedActionLabel: string;
  expectedActionKey: string;
  expectedActionLabel: string;
  correct: boolean;
  actions: TrainingAction[];
};

export type PreflopAttemptItem = PreflopAttemptInput & {
  pk: string;
  sk: string;
  entityType: 'PREFLOP_TRAINING_ATTEMPT';
};

export type PreflopSessionInput = {
  userId: string;
  sessionId: string;
  startedAt: string;
  mode: PreflopSessionMode;
  fixedSpotId?: string;
};

export type PreflopSessionItem = PreflopSessionInput & {
  pk: string;
  sk: string;
  entityType: 'PREFLOP_TRAINING_SESSION';
  status: 'ACTIVE' | 'COMPLETED';
  attempts: number;
  correct: number;
  updatedAt: string;
  endedAt?: string;
  durationSeconds?: number;
};

export const buildAttemptItem = (
  attempt: PreflopAttemptInput,
): PreflopAttemptItem => ({
  pk: `USER#${attempt.userId}`,
  sk: `TRAINING#PREFLOP#ATTEMPT#${attempt.createdAt}#${attempt.attemptId}`,
  entityType: 'PREFLOP_TRAINING_ATTEMPT',
  ...attempt,
});

export const buildSessionKey = (
  userId: string,
  startedAt: string,
  sessionId: string,
) => ({
  pk: `USER#${userId}`,
  sk: `TRAINING#PREFLOP#SESSION#${startedAt}#${sessionId}`,
});

export const buildSessionItem = (
  session: PreflopSessionInput,
): PreflopSessionItem => ({
  ...buildSessionKey(session.userId, session.startedAt, session.sessionId),
  entityType: 'PREFLOP_TRAINING_SESSION',
  status: 'ACTIVE',
  attempts: 0,
  correct: 0,
  updatedAt: session.startedAt,
  ...session,
});

export const buildAttemptQuery = (tableName: string, userId: string) => ({
  TableName: tableName,
  KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
  ExpressionAttributeValues: {
    ':pk': `USER#${userId}`,
    ':prefix': 'TRAINING#PREFLOP#ATTEMPT#',
  },
  ScanIndexForward: false,
  ConsistentRead: true,
});

export const buildSessionQuery = (tableName: string, userId: string) => ({
  TableName: tableName,
  KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
  ExpressionAttributeValues: {
    ':pk': `USER#${userId}`,
    ':prefix': 'TRAINING#PREFLOP#SESSION#',
  },
  ScanIndexForward: false,
  ConsistentRead: true,
});

type AccuracyCounter = {
  attempts: number;
  correct: number;
};

const accuracy = ({ attempts, correct }: AccuracyCounter) =>
  attempts === 0 ? 0 : correct / attempts;

export const summarizeAttempts = (attempts: PreflopAttemptItem[]) => {
  const byPosition = new Map<string, AccuracyCounter>();
  const bySpot = new Map<
    string,
    AccuracyCounter &
      Pick<
        PreflopAttemptItem,
        'spotId' | 'position' | 'spotLabel' | 'preflopActions'
      >
  >();

  for (const attempt of attempts) {
    const position = byPosition.get(attempt.position) ?? {
      attempts: 0,
      correct: 0,
    };
    position.attempts += 1;
    if (attempt.correct) position.correct += 1;
    byPosition.set(attempt.position, position);

    const spot = bySpot.get(attempt.spotId) ?? {
      spotId: attempt.spotId,
      position: attempt.position,
      spotLabel: attempt.spotLabel,
      preflopActions: attempt.preflopActions,
      attempts: 0,
      correct: 0,
    };
    spot.attempts += 1;
    if (attempt.correct) spot.correct += 1;
    bySpot.set(attempt.spotId, spot);
  }

  const correct = attempts.filter((attempt) => attempt.correct).length;
  return {
    attempts: attempts.length,
    correct,
    accuracy: accuracy({ attempts: attempts.length, correct }),
    positions: [...byPosition.entries()]
      .map(([position, counter]) => ({
        position,
        ...counter,
        accuracy: accuracy(counter),
      }))
      .toSorted((left, right) => left.position.localeCompare(right.position)),
    spots: [...bySpot.values()]
      .map((spot) => ({ ...spot, accuracy: accuracy(spot) }))
      .toSorted(
        (left, right) =>
          left.position.localeCompare(right.position) ||
          right.attempts - left.attempts ||
          left.spotId.localeCompare(right.spotId),
      ),
  };
};
