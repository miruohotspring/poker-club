'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const streetLabels = ['プリフロップ', 'フロップ', 'ターン', 'リバー'] as const;
const positionTemplates: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'UTG'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
};
const actionOptions = [
  'ベット',
  'レイズ',
  'コール',
  'フォールド',
  'チェック',
] as const;

type ActionType = (typeof actionOptions)[number];

const defaultStacks = (count: number) =>
  Array.from({ length: count }, () => 300);

const createEmptyHistory = () => streetLabels.map(() => [] as string[]);

const getNextSeat = (seat: number, total: number) =>
  seat === total ? 1 : seat + 1;

const buildActionOrder = (
  playerCount: number,
  buttonSeat: number,
  streetIndex: number,
) => {
  const sbSeat =
    playerCount === 2 ? buttonSeat : getNextSeat(buttonSeat, playerCount);
  const bbSeat =
    playerCount === 2
      ? getNextSeat(buttonSeat, playerCount)
      : getNextSeat(sbSeat, playerCount);
  const isPreflop = streetIndex === 0;
  const startSeat = isPreflop
    ? getNextSeat(bbSeat, playerCount)
    : getNextSeat(buttonSeat, playerCount);

  return Array.from({ length: playerCount }, (_, offset) => {
    const seatNumber = ((startSeat - 1 + offset) % playerCount) + 1;
    return seatNumber - 1;
  });
};

const postBlinds = (
  stacks: number[],
  playerCount: number,
  buttonSeat: number,
  sb: number,
  bb: number,
  ante: number,
) => {
  const updatedStacks = [...stacks];
  const sbSeat =
    playerCount === 2 ? buttonSeat : getNextSeat(buttonSeat, playerCount);
  const bbSeat =
    playerCount === 2
      ? getNextSeat(buttonSeat, playerCount)
      : getNextSeat(sbSeat, playerCount);

  if (sb > 0) {
    updatedStacks[sbSeat - 1] = Math.max(0, updatedStacks[sbSeat - 1] - sb);
  }
  if (bb + ante > 0) {
    updatedStacks[bbSeat - 1] = Math.max(
      0,
      updatedStacks[bbSeat - 1] - (bb + ante),
    );
  }

  return {
    potBase: sb + bb + ante,
    updatedStacks,
    sbSeat,
    bbSeat,
  };
};

export default function PromptBuilderPage() {
  const [playerCount, setPlayerCount] = useState(6);
  const [buttonSeat, setButtonSeat] = useState(1);
  const [sb, setSb] = useState(1);
  const [bb, setBb] = useState(3);
  const [ante, setAnte] = useState(3);
  const [stacks, setStacks] = useState<number[]>(() => defaultStacks(6));
  const [streetIndex, setStreetIndex] = useState(0);
  const [board, setBoard] = useState('');
  const [pot, setPot] = useState(0);
  const [streetTotal, setStreetTotal] = useState(0);
  const [contributions, setContributions] = useState<number[]>(() =>
    defaultStacks(6).map(() => 0),
  );
  const [folded, setFolded] = useState<boolean[]>(() =>
    defaultStacks(6).map(() => false),
  );
  const [pendingPlayers, setPendingPlayers] = useState<number[]>(() =>
    defaultStacks(6).map((_, index) => index),
  );
  const [actionHistory, setActionHistory] = useState<string[][]>(() =>
    createEmptyHistory(),
  );
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [selectedAction, setSelectedAction] =
    useState<ActionType>('フォールド');
  const [actionAmount, setActionAmount] = useState('');
  const [showdownOpen, setShowdownOpen] = useState(false);
  const [showdownWinner, setShowdownWinner] = useState(0);
  const [currentActor, setCurrentActor] = useState<number | null>(null);

  const positions = useMemo(() => {
    const template = positionTemplates[playerCount] ?? positionTemplates[6];
    return Array.from({ length: playerCount }, (_, index) => {
      const relativeIndex =
        (index - (buttonSeat - 1) + playerCount) % playerCount;
      return template[relativeIndex];
    });
  }, [buttonSeat, playerCount]);

  const actionOrder = useMemo(
    () => buildActionOrder(playerCount, buttonSeat, streetIndex),
    [buttonSeat, playerCount, streetIndex],
  );

  const resetHand = useCallback(
    (nextButtonSeat: number, nextStacks: number[], nextPlayerCount: number) => {
      const clearedHistory = createEmptyHistory();
      const { potBase, updatedStacks, sbSeat, bbSeat } = postBlinds(
        nextStacks,
        nextPlayerCount,
        nextButtonSeat,
        sb,
        bb,
        ante,
      );
      const initialContributions = Array.from(
        { length: nextPlayerCount },
        () => 0,
      );
      if (sb > 0) {
        initialContributions[sbSeat - 1] = sb;
      }
      if (bb > 0) {
        initialContributions[bbSeat - 1] = bb;
      }

      setButtonSeat(nextButtonSeat);
      setStacks(updatedStacks);
      setStreetIndex(0);
      setBoard('');
      setPot(potBase);
      setStreetTotal(0);
      setContributions(initialContributions);
      setFolded(Array.from({ length: nextPlayerCount }, () => false));
      const orderedPlayers = buildActionOrder(
        nextPlayerCount,
        nextButtonSeat,
        0,
      );
      setPendingPlayers(orderedPlayers);
      setCurrentActor(orderedPlayers[0] ?? null);
      setActionHistory(clearedHistory);
    },
    [ante, bb, sb],
  );

  useEffect(() => {
    resetHand(1, defaultStacks(6), 6);
  }, [resetHand]);

  const initializeGame = useCallback(
    (nextPlayerCount: number, nextButtonSeat: number) => {
      const newStacks = defaultStacks(nextPlayerCount);
      setPlayerCount(nextPlayerCount);
      resetHand(nextButtonSeat, newStacks, nextPlayerCount);
    },
    [resetHand],
  );

  const advanceStreet = useCallback(
    (newPot: number, activePlayers: number[]) => {
      const nextStreetIndex = Math.min(
        streetIndex + 1,
        streetLabels.length - 1,
      );
      const nextOrder = buildActionOrder(
        playerCount,
        buttonSeat,
        nextStreetIndex,
      );
      setPot(newPot);
      setStreetTotal(0);
      setContributions(Array.from({ length: playerCount }, () => 0));
      const orderedPlayers = nextOrder.filter((index) =>
        activePlayers.includes(index),
      );
      setPendingPlayers(orderedPlayers);
      setCurrentActor(orderedPlayers[0] ?? null);
      setStreetIndex(nextStreetIndex);
    },
    [buttonSeat, playerCount, streetIndex],
  );

  const handleAwardAndReset = useCallback(
    (winnerIndex: number, totalPot: number) => {
      const updatedStacks = stacks.map((stack, index) =>
        index === winnerIndex ? stack + totalPot : stack,
      );
      const nextButtonSeat = getNextSeat(buttonSeat, playerCount);
      resetHand(nextButtonSeat, updatedStacks, playerCount);
    },
    [buttonSeat, playerCount, resetHand, stacks],
  );

  const handleActionConfirm = useCallback(() => {
    if (selectedPlayer === null) return;
    const playerIndex = selectedPlayer;
    const updatedStacks = [...stacks];
    const updatedContributions = [...contributions];
    const updatedFolded = [...folded];
    const updatedHistory = actionHistory.map((streetActions) => [
      ...streetActions,
    ]);

    const maxContribution = Math.max(...updatedContributions);
    const position = positions[playerIndex];
    let amount = 0;
    let historyLine = '';

    switch (selectedAction) {
      case 'フォールド':
        updatedFolded[playerIndex] = true;
        historyLine = `${position}#フォールド`;
        break;
      case 'チェック':
        historyLine = `${position}#チェック`;
        break;
      case 'コール': {
        const callAmount = Math.max(
          0,
          maxContribution - updatedContributions[playerIndex],
        );
        if (callAmount === 0) {
          historyLine = `${position}#チェック`;
        } else {
          amount = callAmount;
          historyLine = `${position}#コール/${callAmount}点`;
        }
        break;
      }
      case 'ベット':
      case 'レイズ': {
        const parsedAmount = Number(actionAmount);
        amount = Number.isFinite(parsedAmount) ? Math.max(0, parsedAmount) : 0;
        historyLine = `${position}#${selectedAction}/${amount}点`;
        break;
      }
      default:
        break;
    }

    if (amount > 0) {
      updatedStacks[playerIndex] = Math.max(
        0,
        updatedStacks[playerIndex] - amount,
      );
      updatedContributions[playerIndex] += amount;
    }

    updatedHistory[streetIndex].push(historyLine);
    const newStreetTotal = streetTotal + amount;

    const activePlayers = updatedFolded
      .map((isFolded, index) => ({ isFolded, index }))
      .filter((player) => !player.isFolded)
      .map((player) => player.index);

    let updatedPendingPlayers = pendingPlayers.filter(
      (index) => index !== playerIndex,
    );
    if (selectedAction === 'ベット' || selectedAction === 'レイズ') {
      updatedPendingPlayers = actionOrder
        .filter((index) => activePlayers.includes(index))
        .filter((index) => index !== playerIndex);
    }

    const contributionsMatch = activePlayers.length
      ? activePlayers.every(
          (index) => updatedContributions[index] === maxContribution,
        )
      : true;

    setStacks(updatedStacks);
    setContributions(updatedContributions);
    setFolded(updatedFolded);
    setPendingPlayers(updatedPendingPlayers);
    setCurrentActor(updatedPendingPlayers[0] ?? null);
    setActionHistory(updatedHistory);
    setStreetTotal(newStreetTotal);
    setSelectedPlayer(null);
    setActionAmount('');

    if (activePlayers.length <= 1) {
      const winnerIndex = activePlayers[0] ?? playerIndex;
      handleAwardAndReset(winnerIndex, pot + newStreetTotal);
      return;
    }

    if (contributionsMatch && updatedPendingPlayers.length === 0) {
      if (streetIndex >= streetLabels.length - 1) {
        setShowdownWinner(activePlayers[0] ?? 0);
        setShowdownOpen(true);
      } else {
        advanceStreet(pot + newStreetTotal, activePlayers);
      }
    }
  }, [
    actionAmount,
    actionHistory,
    actionOrder,
    advanceStreet,
    contributions,
    folded,
    handleAwardAndReset,
    pendingPlayers,
    positions,
    pot,
    selectedAction,
    selectedPlayer,
    stacks,
    streetIndex,
    streetTotal,
  ]);

  const handleShowdownConfirm = useCallback(() => {
    const totalPot = pot + streetTotal;
    handleAwardAndReset(showdownWinner, totalPot);
    setShowdownOpen(false);
  }, [handleAwardAndReset, pot, showdownWinner, streetTotal]);

  const promptText = useMemo(() => {
    const historySections = actionHistory
      .map((actions, index) => {
        if (actions.length === 0) return null;
        return `===${streetLabels[index]}===\n${actions.join('\n')}`;
      })
      .filter(Boolean)
      .join('\n');

    const seatIndex = currentActor ?? 0;
    const seatPosition = positions[seatIndex] ?? '';

    return [
      `席位置:${seatIndex + 1}`,
      `あなたのポジション: ${seatPosition}`,
      `現在のストリート: ${streetLabels[streetIndex]}`,
      `ボード: ${streetIndex === 0 ? 'なし' : board || '未入力'}`,
      `ポット: ${pot}`,
      `スタック（席順に）:${stacks.join(', ')}`,
      'アクション履歴:',
      historySections || '（まだアクションがありません）',
    ].join('\n');
  }, [actionHistory, board, currentActor, positions, pot, stacks, streetIndex]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(promptText);
  }, [promptText]);

  const activePot = pot + streetTotal;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">NLH プロンプトビルダー</h1>
        <p className="text-muted-foreground text-sm">
          ChatGPTでノーリミットテキサスホールデムを進行するための入力プロンプトを自動生成します。
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6 rounded-lg border p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid gap-2">
              <Label htmlFor="player-count">プレイヤー数</Label>
              <select
                id="player-count"
                className="border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
                value={playerCount}
                onChange={(event) =>
                  initializeGame(Number(event.target.value), 1)
                }
              >
                {[2, 3, 4, 5, 6].map((count) => (
                  <option key={count} value={count}>
                    {count} 人
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="button-seat">ボタン初期位置</Label>
              <select
                id="button-seat"
                className="border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
                value={buttonSeat}
                onChange={(event) => setButtonSeat(Number(event.target.value))}
              >
                {Array.from({ length: playerCount }, (_, index) => (
                  <option key={index} value={index + 1}>
                    席 {index + 1}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sb">SB</Label>
              <Input
                id="sb"
                type="number"
                min="0"
                value={sb}
                onChange={(event) => setSb(Number(event.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bb">BB</Label>
              <Input
                id="bb"
                type="number"
                min="0"
                value={bb}
                onChange={(event) => setBb(Number(event.target.value))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ante">アンティ (BBが支払う)</Label>
              <Input
                id="ante"
                type="number"
                min="0"
                value={ante}
                onChange={(event) => setAnte(Number(event.target.value))}
              />
            </div>
            <Button
              className="mt-6"
              onClick={() => initializeGame(playerCount, buttonSeat)}
            >
              設定を反映して新規ハンド開始
            </Button>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">プレイヤー設定</h2>
              <Button
                variant="secondary"
                onClick={() => initializeGame(playerCount, buttonSeat)}
              >
                スタックを初期化
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {stacks.map((stack, index) => (
                <div
                  key={index}
                  className="rounded-md border p-3 text-sm shadow-sm"
                >
                  <p className="font-medium">
                    Player {index + 1} - {positions[index]}
                  </p>
                  <Label className="mt-2 block" htmlFor={`stack-${index}`}>
                    スタック
                  </Label>
                  <Input
                    id={`stack-${index}`}
                    type="number"
                    min="0"
                    value={stack}
                    onChange={(event) => {
                      const nextStacks = [...stacks];
                      nextStacks[index] = Number(event.target.value);
                      setStacks(nextStacks);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6 rounded-lg border p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {streetLabels[streetIndex]}
              </h2>
              <p className="text-muted-foreground text-sm">
                ポット: {activePot}
              </p>
            </div>
            <Button onClick={handleCopy}>コピー</Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="board">ボード</Label>
            <Input
              id="board"
              value={board}
              onChange={(event) => setBoard(event.target.value)}
              placeholder="AH 2D 3S"
              disabled={streetIndex === 0}
            />
            {streetIndex === 0 && (
              <p className="text-muted-foreground text-xs">
                フロップ以降でボードを入力してください。
              </p>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <p>現在のポット（確定）: {pot}</p>
            <p>ストリート内の合計: {streetTotal}</p>
            <p>
              ブラインド設定: {sb}-{bb}-{ante}
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-base font-semibold">アクション入力</h3>
            <div className="space-y-3">
              {stacks.map((stack, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">
                      Player {index + 1} ({stack}) - {positions[index]}
                    </p>
                    {folded[index] ? (
                      <p className="text-muted-foreground text-xs">
                        フォールド済み
                      </p>
                    ) : currentActor === index ? (
                      <p className="text-primary text-xs font-semibold">
                        次のアクション
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        ストリート貢献: {contributions[index]}
                      </p>
                    )}
                  </div>
                  <Button
                    variant={folded[index] ? 'secondary' : 'default'}
                    disabled={folded[index] || currentActor !== index}
                    onClick={() => {
                      setSelectedPlayer(index);
                      setSelectedAction('フォールド');
                      setActionAmount('');
                    }}
                  >
                    アクションを選択
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">アクション履歴</h2>
          <div className="space-y-3 text-sm">
            {actionHistory.map((actions, index) => (
              <div key={streetLabels[index]}>
                <p className="font-semibold">=== {streetLabels[index]} ===</p>
                {actions.length === 0 ? (
                  <p className="text-muted-foreground">
                    まだアクションがありません。
                  </p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {actions.map((action, actionIndex) => (
                      <li key={`${action}-${actionIndex}`}>{action}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">プロンプト</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                対象席: 席 {currentActor !== null ? currentActor + 1 : '-'}
              </span>
            </div>
          </div>
          <textarea
            className="border-input bg-background mt-4 h-64 w-full rounded-md border p-3 text-sm leading-relaxed"
            value={promptText}
            readOnly
          />
        </div>
      </section>

      <Dialog
        open={selectedPlayer !== null}
        onOpenChange={(open) => !open && setSelectedPlayer(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>アクションを選択</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="action-type">アクション</Label>
              <select
                id="action-type"
                className="border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
                value={selectedAction}
                onChange={(event) =>
                  setSelectedAction(event.target.value as ActionType)
                }
              >
                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            {(selectedAction === 'ベット' || selectedAction === 'レイズ') && (
              <div className="grid gap-2">
                <Label htmlFor="action-amount">点数</Label>
                <Input
                  id="action-amount"
                  type="number"
                  min="0"
                  value={actionAmount}
                  onChange={(event) => setActionAmount(event.target.value)}
                />
              </div>
            )}
            {selectedAction === 'コール' && (
              <p className="text-muted-foreground text-sm">
                コール額:{' '}
                {Math.max(
                  0,
                  Math.max(...contributions) -
                    (selectedPlayer !== null
                      ? contributions[selectedPlayer]
                      : 0),
                )}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleActionConfirm}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showdownOpen} onOpenChange={setShowdownOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ショーダウン</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="winner">勝者を選択</Label>
            <select
              id="winner"
              className="border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
              value={showdownWinner}
              onChange={(event) =>
                setShowdownWinner(Number(event.target.value))
              }
            >
              {folded.map((isFolded, index) => (
                <option key={index} value={index} disabled={isFolded}>
                  Player {index + 1} - {positions[index]}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button onClick={handleShowdownConfirm}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
