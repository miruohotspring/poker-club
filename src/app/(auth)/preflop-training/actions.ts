'use server';

import fs from 'fs/promises';
import path from 'path';
import { unstable_noStore as noStore } from 'next/cache';

type SpotRow = {
  position: string;
  preflopActions: string;
  reachProb: number;
  jpActions: string | null;
};

type ActionFrequency = {
  label: string;
  frequency: number;
};

type SimpleHandCounter = {
  total_frequency?: number;
  actions_total_frequencies?: Record<string, number>;
};

export type PreflopQuestion = {
  position: string;
  spotLabel: string;
  handDisplay: string;
  actions: ActionFrequency[];
  preflopActions: string;
  historySpot: number;
};

const positions = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const suitSymbols = ['♠', '♥', '♦', '♣'];

const buildHandLabels = () => {
  const labels: string[] = [];
  for (let highIndex = 0; highIndex < ranks.length; highIndex += 1) {
    for (let lowIndex = 0; lowIndex <= highIndex; lowIndex += 1) {
      const high = ranks[highIndex];
      const low = ranks[lowIndex];
      if (highIndex === lowIndex) {
        labels.push(`${high}${low}`);
      } else {
        labels.push(`${high}${low}o`);
        labels.push(`${high}${low}s`);
      }
    }
  }
  return labels;
};

const handLabels = buildHandLabels();

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

const weightedPick = <T,>(items: T[], weight: (item: T) => number) => {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  const target = Math.random() * total;
  let running = 0;
  for (const item of items) {
    running += weight(item);
    if (target <= running) return item;
  }
  return items[items.length - 1];
};

const toActionLabel = (action: {
  type?: string;
  betsize?: string | null;
  display_name?: string | null;
}) => {
  const betsize = action.betsize?.trim();
  switch (action.type) {
    case 'FOLD':
      return 'フォールド';
    case 'CALL':
      return 'コール';
    case 'CHECK':
      return 'チェック';
    case 'BET':
      return betsize ? `ベット ${betsize}` : 'ベット';
    case 'RAISE':
      return betsize ? `レイズ ${betsize}` : 'レイズ';
    default:
      return action.display_name ?? 'アクション';
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

export const getPreflopQuestion = async (): Promise<PreflopQuestion> => {
  noStore();
  const csvPath = path.join(
    process.cwd(),
    'solutions',
    'cash6m100bb',
    'spot_frequencies_by_position.csv',
  );
  const csvText = await fs.readFile(csvPath, 'utf-8');
  const rows = parseCsvRows(csvText);
  const position = positions[Math.floor(Math.random() * positions.length)];
  const positionRows = rows.filter((row) => row.position === position);
  const pickedRow = weightedPick(positionRows, (row) => row.reachProb);
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
      };
      strategy?: number[];
    }>;
    players_info: Array<{
      player?: { position?: string };
      range?: number[];
      simple_hand_counters?: Record<string, SimpleHandCounter>;
    }>;
  };
  const matchingPlayerInfo =
    spotJson.players_info.find(
      (player) => player.player?.position === position,
    ) ?? spotJson.players_info[0];
  const handCounters = matchingPlayerInfo?.simple_hand_counters ?? {};
  const availableHands = Object.entries(handCounters)
    .filter(([, counter]) => (counter?.total_frequency ?? 0) > 0)
    .map(([hand]) => hand);
  const handLabel =
    availableHands[Math.floor(Math.random() * availableHands.length)] ??
    handLabels[0] ??
    '??';
  const actions = spotJson.action_solutions.map((solution) => ({
    label: toActionLabel(solution.action),
    frequency:
      handCounters[handLabel]?.actions_total_frequencies?.[
        solution.action.code ?? ''
      ] ?? 0,
  }));
  const preflopActions =
    pickedRow.preflopActions === 'ROOT' ? '' : pickedRow.preflopActions;
  const historySpot = preflopActions ? preflopActions.split('-').length : 0;

  return {
    position,
    spotLabel: pickedRow.jpActions ?? '',
    handDisplay: buildHandDisplay(handLabel),
    actions,
    preflopActions,
    historySpot,
  };
};
