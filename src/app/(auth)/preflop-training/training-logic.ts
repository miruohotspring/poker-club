export type TrainingAction = {
  key: string;
  label: string;
  frequency: number;
  kind: 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'OTHER';
  betsize: string | null;
};

export type RollBand = {
  action: TrainingAction;
  min: number;
  max: number;
};

const betSizeScore = (betsize: string | null) => {
  if (!betsize) return 0;
  const normalized = betsize.toLowerCase();
  if (normalized.includes('all') || normalized.includes('jam')) return 10_000;
  const numeric = Number.parseFloat(normalized.replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const aggressionScore = (action: TrainingAction) => {
  switch (action.kind) {
    case 'FOLD':
      return 0;
    case 'CHECK':
      return 100;
    case 'CALL':
      return 200;
    case 'BET':
      return 300 + betSizeScore(action.betsize);
    case 'RAISE':
      return 400 + betSizeScore(action.betsize);
    default:
      return 250;
  }
};

export const buildRollBands = (actions: TrainingAction[]): RollBand[] => {
  const eligible = actions
    .filter((action) => action.frequency > 0)
    .toSorted((left, right) => aggressionScore(left) - aggressionScore(right));
  const total = eligible.reduce((sum, action) => sum + action.frequency, 0);
  if (eligible.length === 0 || total <= 0) {
    throw new Error('No action has a positive frequency');
  }

  const bands: RollBand[] = [];
  let cumulative = 0;
  let nextMin = 1;
  eligible.forEach((action, index) => {
    cumulative += action.frequency / total;
    const max = index === eligible.length - 1 ? 100 : Math.round(cumulative * 100);
    if (max >= nextMin) {
      bands.push({ action, min: nextMin, max });
      nextMin = max + 1;
    }
  });

  if (bands.length === 0) {
    throw new Error('No action can be represented by a d100 roll');
  }
  bands[bands.length - 1].max = 100;
  return bands;
};

export const actionForRoll = (actions: TrainingAction[], roll: number) => {
  if (!Number.isInteger(roll) || roll < 1 || roll > 100) {
    throw new Error('Dice roll must be an integer from 1 to 100');
  }
  const band = buildRollBands(actions).find(
    (candidate) => roll >= candidate.min && roll <= candidate.max,
  );
  if (!band) throw new Error('Dice roll is not covered by an action band');
  return band.action;
};
