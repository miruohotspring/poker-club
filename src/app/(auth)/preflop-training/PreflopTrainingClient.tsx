'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type {
  PreflopAttemptView,
  PreflopQuestion,
  PreflopSpot,
  PreflopTrainingSummary,
} from './actions';
import {
  getPreflopQuestion,
  recordPreflopAttempt,
} from './actions';
import { buildRollBands } from './training-logic';

type Props = {
  initialQuestion: PreflopQuestion;
  spots: PreflopSpot[];
  initialSummary: PreflopTrainingSummary;
};

type View = 'practice' | 'history';
type QuestionMode = 'random' | 'fixed';

const positionOrder = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
const displayActions = (preflopActions: string) => preflopActions || 'ROOT';

export default function PreflopTrainingClient({
  initialQuestion,
  spots,
  initialSummary,
}: Props) {
  const [question, setQuestion] = useState(initialQuestion);
  const [result, setResult] = useState<PreflopAttemptView | null>(null);
  const [summary, setSummary] = useState(initialSummary);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('practice');
  const [mode, setMode] = useState<QuestionMode>('random');
  const [fixedPosition, setFixedPosition] = useState(initialQuestion.position);
  const [selectedSpotId, setSelectedSpotId] = useState(
    spots.find((spot) => spot.position === initialQuestion.position)?.id ??
      spots[0]?.id ??
      '',
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const spotsByPosition = useMemo(
    () =>
      Object.fromEntries(
        positionOrder.map((position) => [
          position,
          spots.filter((spot) => spot.position === position),
        ]),
      ) as Record<string, PreflopSpot[]>,
    [spots],
  );
  const selectedPositionSpots = spotsByPosition[fixedPosition] ?? [];
  const rollBands = useMemo(
    () => buildRollBands(question.actions),
    [question.actions],
  );
  const statsBySpot = useMemo(
    () => new Map(summary.spots.map((spot) => [spot.spotId, spot])),
    [summary.spots],
  );

  const loadQuestion = (spotId?: string | null) => {
    setError(null);
    startTransition(async () => {
      try {
        const nextQuestion = await getPreflopQuestion(spotId);
        setQuestion(nextQuestion);
        setResult(null);
        setOpen(false);
      } catch (cause) {
        console.error(cause);
        setError('次の問題を読み込めませんでした');
      }
    });
  };

  const handleSelect = (selectedActionKey: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await recordPreflopAttempt({
          question,
          selectedActionKey,
        });
        setResult(response.attempt);
        setSummary(response.summary);
        setOpen(true);
      } catch (cause) {
        console.error(cause);
        setError('回答を保存できませんでした');
      }
    });
  };

  const handleNext = () => {
    loadQuestion(mode === 'fixed' ? selectedSpotId : null);
  };

  const selectMode = (nextMode: QuestionMode) => {
    setMode(nextMode);
    if (nextMode === 'fixed') loadQuestion(selectedSpotId);
  };

  const selectPosition = (position: string) => {
    setFixedPosition(position);
    const firstSpot = spotsByPosition[position]?.[0];
    if (firstSpot) {
      setSelectedSpotId(firstSpot.id);
      if (mode === 'fixed') loadQuestion(firstSpot.id);
    }
  };

  const selectSpot = (id: string) => {
    setSelectedSpotId(id);
    if (mode === 'fixed') loadQuestion(id);
  };

  const practiceSpot = (spot: PreflopSpot) => {
    setView('practice');
    setMode('fixed');
    setFixedPosition(spot.position);
    setSelectedSpotId(spot.id);
    loadQuestion(spot.id);
  };

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4 text-white shadow">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Preflop Spot Training
          </p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">NL50 6max 100bb</h1>
              <p className="mt-1 text-sm text-slate-300">
                2.5x Open / d100 mixed strategy
              </p>
            </div>
            <div className="flex rounded-lg bg-slate-900 p-1 text-sm">
              <button
                type="button"
                className={`rounded-md px-3 py-2 ${
                  view === 'practice' ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
                onClick={() => setView('practice')}
              >
                練習
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-2 ${
                  view === 'history' ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
                onClick={() => setView('history')}
              >
                記録
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-rose-900 bg-rose-950 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {view === 'practice' ? (
          <>
            <section className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-5 shadow-sm">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className={`flex-1 ${
                    mode === 'random'
                      ? '!border-slate-100 !bg-slate-100 !text-slate-950 hover:!bg-slate-200'
                      : '!border-slate-700 !bg-slate-900 !text-slate-200 hover:!bg-slate-800'
                  }`}
                  onClick={() => selectMode('random')}
                >
                  ランダム出題
                </Button>
                <Button
                  variant="outline"
                  className={`flex-1 ${
                    mode === 'fixed'
                      ? '!border-slate-100 !bg-slate-100 !text-slate-950 hover:!bg-slate-200'
                      : '!border-slate-700 !bg-slate-900 !text-slate-200 hover:!bg-slate-800'
                  }`}
                  onClick={() => selectMode('fixed')}
                >
                  スポット固定
                </Button>
              </div>

              {mode === 'fixed' && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-400">
                    ポジション
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      value={fixedPosition}
                      onChange={(event) => selectPosition(event.target.value)}
                    >
                      {positionOrder.map((position) => (
                        <option key={position} value={position}>
                          {position}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-400">
                    スポット
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      value={selectedSpotId}
                      onChange={(event) => selectSpot(event.target.value)}
                    >
                      {selectedPositionSpots.map((spot) => (
                        <option key={spot.id} value={spot.id}>
                          {spot.label} / {displayActions(spot.preflopActions)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-lg font-semibold text-slate-50">
                    {question.position}
                  </span>
                  <p className="mt-1 text-sm text-slate-400">
                    {question.spotLabel}
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {displayActions(question.preflopActions)}
                  </p>
                </div>
                <div className="rounded-xl border border-amber-700 bg-amber-950 px-4 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-amber-300">
                    d100
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-amber-100">
                    {question.diceRoll}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3">
                <p className="text-xs text-slate-500">ハンド</p>
                <div className="text-2xl font-semibold text-slate-50">
                  {question.handDisplay}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-200">
                ダイスの出目に合うアクションは？
              </h2>
              <div className="mt-4 grid gap-2">
                {question.actions.map((action) => (
                  <Button
                    key={action.key}
                    className="w-full justify-between border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                    variant="outline"
                    onClick={() => handleSelect(action.key)}
                    disabled={isPending}
                  >
                    <span>{action.label}</span>
                    <span className="text-xs text-slate-400">
                      {isPending ? '保存中…' : '選択'}
                    </span>
                  </Button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-5">
              <h2 className="text-lg font-semibold">ポジション別の正答率</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {positionOrder.map((position) => {
                  const stats = summary.positions.find(
                    (entry) => entry.position === position,
                  );
                  return (
                    <div key={position} className="rounded-xl bg-slate-900 p-3">
                      <p className="text-sm font-semibold text-slate-100">
                        {position}
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {stats ? formatPercent(stats.accuracy) : '—'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {stats ? `${stats.correct} / ${stats.attempts}` : '未回答'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {positionOrder.map((position) => (
              <section
                key={position}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-5"
              >
                <h2 className="text-lg font-semibold">{position}のスポット</h2>
                <div className="mt-4 space-y-2">
                  {(spotsByPosition[position] ?? []).map((spot) => {
                    const stats = statsBySpot.get(spot.id);
                    return (
                      <div
                        key={spot.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-200">
                            {spot.label}
                          </p>
                          <p className="truncate font-mono text-xs text-slate-500">
                            {displayActions(spot.preflopActions)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold">
                              {stats ? formatPercent(stats.accuracy) : '—'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {stats ? `${stats.correct}/${stats.attempts}` : '未回答'}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-700 bg-slate-950 text-slate-200"
                            onClick={() => practiceSpot(spot)}
                          >
                            固定出題
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-5">
              <h2 className="text-lg font-semibold">最近の回答</h2>
              <div className="mt-4 space-y-2">
                {summary.history.length === 0 ? (
                  <p className="text-sm text-slate-500">まだ回答記録がありません。</p>
                ) : (
                  summary.history.map((attempt) => (
                    <div
                      key={attempt.attemptId}
                      className="rounded-xl bg-slate-900 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">
                          {attempt.position} · {attempt.handDisplay} · d100 {attempt.diceRoll}
                        </p>
                        <span
                          className={`text-sm font-semibold ${
                            attempt.correct ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {attempt.correct ? '正解' : '不正解'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        選択: {attempt.selectedActionLabel} / 正解:{' '}
                        {attempt.expectedActionLabel}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {new Date(attempt.createdAt).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm border-slate-800 bg-slate-950 text-slate-100">
            <DialogHeader>
              <DialogTitle>フィードバック</DialogTitle>
            </DialogHeader>
            {result && (
              <div className="space-y-4">
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-xs text-slate-400">あなたの選択</p>
                  <p className="text-lg font-semibold text-slate-50">
                    {result.selectedActionLabel}
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      result.correct ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {result.correct
                      ? '正解！'
                      : `不正解・出目 ${result.diceRoll} の正解は ${result.expectedActionLabel}`}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    アクション頻度とd100区間
                  </p>
                  {rollBands.map(({ action, min, max }) => (
                    <div key={action.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{action.label}</span>
                        <span className="font-semibold text-slate-50">
                          {formatPercent(action.frequency)} · {min}–{max}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-slate-500"
                          style={{
                            width: `${Math.min(100, action.frequency * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <a
                  className="block text-center text-sm font-semibold text-slate-300 underline"
                  href={`https://app.gtowizard.com/solutions?gametype=Cash6m50zGeneral25Open&depth=100&soltab=strategy&solution_type=gwiz&gmfs_solution_tab=ai_sols&gmfft_sort_key=0&gmfft_sort_order=desc&preflop_actions=${encodeURIComponent(
                    question.preflopActions,
                  )}&history_spot=${question.historySpot}&stratab=overview_range&gmff_depth=100&gmff_rake=NL50&gmff_opening_size=25x&gmff__3bet_size=gto`}
                  rel="noreferrer"
                  target="_blank"
                >
                  このスポットを見る
                </a>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                className="w-full bg-slate-100 text-slate-900 hover:bg-slate-200"
                onClick={handleNext}
                disabled={isPending}
              >
                {isPending ? '読み込み中…' : '次のハンドへ'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          className="self-center text-xs text-slate-300 hover:text-slate-100"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          前のページに戻る
        </Button>
      </div>
    </div>
  );
}
