'use client';

import { Dice5 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type {
  PreflopAttemptView,
  PreflopQuestion,
  PreflopSessionView,
  PreflopSpot,
  PreflopTrainingSummary,
} from './actions';
import {
  endPreflopTrainingSession,
  getPreflopQuestion,
  getPreflopSessionAttempts,
  recordPreflopAttempt,
  startPreflopTrainingSession,
} from './actions';
import { buildRollBands } from './training-logic';

type Props = {
  initialQuestion: PreflopQuestion;
  spots: PreflopSpot[];
  initialSummary: PreflopTrainingSummary;
};

type View = 'practice' | 'history';
type QuestionMode = 'random' | 'fixed';
type RecordView = 'sessions' | 'overall';

const positionOrder = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;
const displayActions = (preflopActions: string) => preflopActions || 'ROOT';

const formatDuration = (seconds = 0) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
};

const actionActors = (preflopActions: string) =>
  preflopActions
    .split('-')
    .filter(Boolean)
    .map((action, index) => ({
      action,
      position: positionOrder[index % positionOrder.length],
    }));

const formatActionLine = (preflopActions: string) => {
  const entries = actionActors(preflopActions);
  return entries.length === 0
    ? 'ROOT'
    : entries.map(({ position, action }) => `${position} ${action}`).join(' · ');
};

const formatSpotLabel = (question: Pick<PreflopQuestion, 'position' | 'preflopActions'>) => {
  const raises = actionActors(question.preflopActions).filter(({ action }) =>
    action.startsWith('R'),
  );
  const latest = raises.at(-1);
  if (!latest) return `${question.position} First in`;
  const size = latest.action.slice(1);
  return `${latest.position} ${raises.length === 1 ? 'Open' : '3bet'} ${size}`;
};

const sessionModeLabel = (session: PreflopSessionView) => {
  if (session.mode === 'random') return 'Random';
  return `${session.fixedSpotId?.split(':')[0] ?? 'Spot'} fixed`;
};

const sessionAccuracy = (session: PreflopSessionView) =>
  session.attempts === 0 ? 0 : session.correct / session.attempts;

export default function PreflopTrainingClient({
  initialQuestion,
  spots,
  initialSummary,
}: Props) {
  const initialActiveSession = initialSummary.activeSession;
  const initialFixedSpotId = initialActiveSession?.fixedSpotId;
  const [question, setQuestion] = useState(initialQuestion);
  const [result, setResult] = useState<PreflopAttemptView | null>(null);
  const [summary, setSummary] = useState(initialSummary);
  const [activeSession, setActiveSession] = useState<PreflopSessionView | null>(
    initialActiveSession,
  );
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('practice');
  const [recordView, setRecordView] = useState<RecordView>('sessions');
  const [mode, setMode] = useState<QuestionMode>(
    initialActiveSession?.mode ?? 'random',
  );
  const [fixedPosition, setFixedPosition] = useState(
    initialFixedSpotId?.split(':')[0] ?? initialQuestion.position,
  );
  const [selectedSpotId, setSelectedSpotId] = useState(
    initialFixedSpotId ??
      spots.find((spot) => spot.position === initialQuestion.position)?.id ??
      spots[0]?.id ??
      '',
  );
  const [selectedRecordPosition, setSelectedRecordPosition] = useState('BB');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionAttempts, setSessionAttempts] = useState<PreflopAttemptView[]>([]);
  const [clock, setClock] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!activeSession) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeSession]);

  useEffect(() => {
    if (
      initialActiveSession?.mode === 'fixed' &&
      initialActiveSession.fixedSpotId &&
      initialActiveSession.fixedSpotId !== initialQuestion.spotId
    ) {
      startTransition(async () => {
        const fixedQuestion = await getPreflopQuestion(
          initialActiveSession.fixedSpotId,
        );
        setQuestion(fixedQuestion);
      });
    }
  }, [initialActiveSession, initialQuestion.spotId]);

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
  const elapsedSeconds = activeSession
    ? Math.max(
        0,
        Math.floor(
          ((clock || Date.parse(activeSession.startedAt)) -
            Date.parse(activeSession.startedAt)) /
            1000,
        ),
      )
    : 0;

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

  const handleStart = () => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await startPreflopTrainingSession({
          mode,
          ...(mode === 'fixed' ? { fixedSpotId: selectedSpotId } : {}),
        });
        setActiveSession(response.session);
        setSummary(response.summary);
        setMode(response.session.mode);
        if (response.session.fixedSpotId) {
          setSelectedSpotId(response.session.fixedSpotId);
          setFixedPosition(response.session.fixedSpotId.split(':')[0]);
        }
        const nextQuestion = await getPreflopQuestion(
          response.session.mode === 'fixed'
            ? response.session.fixedSpotId
            : null,
        );
        setQuestion(nextQuestion);
      } catch (cause) {
        console.error(cause);
        setError('セッションを開始できませんでした');
      }
    });
  };

  const handleEnd = () => {
    if (!activeSession) return;
    setError(null);
    startTransition(async () => {
      try {
        const response = await endPreflopTrainingSession({
          sessionId: activeSession.sessionId,
          startedAt: activeSession.startedAt,
        });
        setSummary(response.summary);
        setActiveSession(null);
        setOpen(false);
        setView('history');
        setRecordView('sessions');
      } catch (cause) {
        console.error(cause);
        setError('セッションを終了できませんでした');
      }
    });
  };

  const handleSelect = (selectedActionKey: string) => {
    if (!activeSession) return;
    setError(null);
    startTransition(async () => {
      try {
        const response = await recordPreflopAttempt({
          question,
          selectedActionKey,
          sessionId: activeSession.sessionId,
          sessionStartedAt: activeSession.startedAt,
        });
        setResult(response.attempt);
        setSummary(response.summary);
        setActiveSession(response.summary.activeSession);
        setOpen(true);
      } catch (cause) {
        console.error(cause);
        setError('回答を保存できませんでした');
      }
    });
  };

  const handleNext = () => {
    loadQuestion(
      activeSession?.mode === 'fixed' ? activeSession.fixedSpotId : null,
    );
  };

  const selectPosition = (position: string) => {
    setFixedPosition(position);
    const firstSpot = spotsByPosition[position]?.[0];
    if (firstSpot) setSelectedSpotId(firstSpot.id);
  };

  const prepareFixedSpot = (spot: PreflopSpot) => {
    if (activeSession) return;
    setView('practice');
    setMode('fixed');
    setFixedPosition(spot.position);
    setSelectedSpotId(spot.id);
  };

  const loadSessionDetails = (sessionId: string) => {
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null);
      setSessionAttempts([]);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        setSessionAttempts(await getPreflopSessionAttempts(sessionId));
        setSelectedSessionId(sessionId);
      } catch (cause) {
        console.error(cause);
        setError('セッション詳細を読み込めませんでした');
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#07090d] px-4 py-5 text-slate-100">
      <main className="mx-auto w-full max-w-md">
        <header className="flex h-12 items-center justify-between border-b border-slate-800">
          <h1 className="text-sm font-bold">Preflop</h1>
          {view === 'practice' && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-slate-500">
                {activeSession
                  ? `${formatDuration(elapsedSeconds)} · ${activeSession.correct} / ${activeSession.attempts}`
                  : 'not started'}
              </span>
              <button
                type="button"
                className={`h-8 min-w-14 rounded-md border px-3 text-xs font-bold ${
                  activeSession
                    ? 'border-rose-900 text-rose-400'
                    : 'border-slate-200 bg-slate-100 text-slate-950'
                }`}
                onClick={activeSession ? handleEnd : handleStart}
                disabled={isPending}
              >
                {activeSession ? 'End' : 'Start'}
              </button>
            </div>
          )}
        </header>

        <nav className="grid grid-cols-2 border-b border-slate-800">
          {(['practice', 'history'] as const).map((nextView) => (
            <button
              key={nextView}
              type="button"
              className={`h-11 border-b text-xs font-bold ${
                view === nextView
                  ? 'border-slate-100 text-slate-100'
                  : 'border-transparent text-slate-600'
              }`}
              onClick={() => setView(nextView)}
            >
              {nextView === 'practice' ? '練習' : '記録'}
            </button>
          ))}
        </nav>

        {error && (
          <div className="mt-4 border border-rose-950 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}

        {view === 'practice' ? (
          activeSession ? (
            <div className="pt-7">
              <section className="border-b border-slate-800 pb-6">
                <div className="text-[56px] font-black leading-none tracking-[-0.06em] text-slate-50">
                  {question.position}
                </div>
                <div className="mt-4 text-lg font-bold">
                  {formatSpotLabel(question)}
                </div>
                <div className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-slate-500">
                  {formatActionLine(question.preflopActions)}
                </div>
                <div className="mt-7 flex items-end justify-between">
                  <div className="text-4xl font-bold tracking-tight">
                    {question.handDisplay}
                  </div>
                  <div className="font-mono text-xs text-slate-600">100bb</div>
                </div>
              </section>

              <div className="mt-4 flex items-center gap-2 text-amber-400">
                <Dice5 className="size-[18px]" strokeWidth={1.8} />
                <span className="font-mono text-sm font-extrabold tabular-nums">
                  {question.diceRoll}
                </span>
              </div>

              <section className="mt-2 grid gap-2">
                {question.actions.map((action) => (
                  <Button
                    key={action.key}
                    className="h-14 w-full justify-start rounded-lg border-slate-800 bg-[#11151c] px-4 text-base font-bold text-slate-100 hover:bg-slate-800"
                    variant="outline"
                    onClick={() => handleSelect(action.key)}
                    disabled={isPending}
                  >
                    {action.label}
                  </Button>
                ))}
              </section>

              <div className="mt-4 font-mono text-[11px] text-slate-600">
                {sessionModeLabel(activeSession)}
              </div>
            </div>
          ) : (
            <section className="pt-8">
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-[#0b0e13] p-1">
                {(['random', 'fixed'] as const).map((nextMode) => (
                  <button
                    key={nextMode}
                    type="button"
                    className={`h-9 rounded-md text-xs font-bold ${
                      mode === nextMode
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-600'
                    }`}
                    onClick={() => setMode(nextMode)}
                  >
                    {nextMode === 'random' ? 'Random' : 'Fixed'}
                  </button>
                ))}
              </div>

              {mode === 'fixed' && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <select
                    aria-label="ポジション"
                    className="h-10 rounded-md border border-slate-800 bg-[#0b0e13] px-3 text-xs text-slate-200"
                    value={fixedPosition}
                    onChange={(event) => selectPosition(event.target.value)}
                  >
                    {positionOrder.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="スポット"
                    className="h-10 min-w-0 rounded-md border border-slate-800 bg-[#0b0e13] px-3 text-xs text-slate-200"
                    value={selectedSpotId}
                    onChange={(event) => setSelectedSpotId(event.target.value)}
                  >
                    {selectedPositionSpots.map((spot) => (
                      <option key={spot.id} value={spot.id}>
                        {spot.label} / {displayActions(spot.preflopActions)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid min-h-[360px] place-items-center border-b border-t border-slate-800">
                <Button
                  className="h-12 w-36 rounded-lg bg-slate-100 font-bold text-slate-950 hover:bg-slate-200"
                  onClick={handleStart}
                  disabled={isPending}
                >
                  Start session
                </Button>
              </div>
            </section>
          )
        ) : (
          <section className="pt-5">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-[#0b0e13] p-1">
              {(['sessions', 'overall'] as const).map((nextRecordView) => (
                <button
                  key={nextRecordView}
                  type="button"
                  className={`h-9 rounded-md text-xs font-bold ${
                    recordView === nextRecordView
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-600'
                  }`}
                  onClick={() => setRecordView(nextRecordView)}
                >
                  {nextRecordView === 'sessions' ? 'Sessions' : 'Overall'}
                </button>
              ))}
            </div>

            {recordView === 'sessions' ? (
              <div className="mt-5 border-t border-slate-800">
                {summary.sessions.length === 0 ? (
                  <p className="border-b border-slate-800 py-8 text-center text-xs text-slate-600">
                    No sessions
                  </p>
                ) : (
                  summary.sessions.map((session) => (
                    <div key={session.sessionId} className="border-b border-slate-800">
                      <button
                        type="button"
                        className="flex min-h-16 w-full items-center justify-between gap-4 text-left"
                        onClick={() => loadSessionDetails(session.sessionId)}
                      >
                        <div>
                          <div className="text-sm font-bold">
                            {new Date(session.startedAt).toLocaleString('ja-JP', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="mt-1 font-mono text-[11px] text-slate-500">
                            {session.attempts} {session.attempts === 1 ? 'hand' : 'hands'} ·{' '}
                            {formatDuration(session.durationSeconds)} ·{' '}
                            {sessionModeLabel(session)}
                          </div>
                        </div>
                        <div className="font-mono text-base font-extrabold">
                          {formatPercent(sessionAccuracy(session))}
                        </div>
                      </button>

                      {selectedSessionId === session.sessionId && (
                        <div className="border-t border-slate-900 pb-3">
                          {sessionAttempts.map((attempt) => (
                            <div
                              key={attempt.attemptId}
                              className="flex items-center justify-between py-2 text-xs"
                            >
                              <span className="text-slate-400">
                                {attempt.position} · {attempt.handDisplay} ·{' '}
                                <Dice5 className="inline size-3.5 text-amber-500" />{' '}
                                {attempt.diceRoll}
                              </span>
                              <span
                                className={
                                  attempt.correct
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }
                              >
                                {attempt.selectedActionLabel}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="mt-7">
                <div className="flex items-end justify-between border-b border-slate-800 pb-6">
                  <div className="font-mono text-5xl font-black tracking-tight">
                    {summary.attempts ? formatPercent(summary.accuracy) : '—'}
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-500">
                    {summary.correct} / {summary.attempts}
                    <br />all time
                  </div>
                </div>

                <div className="mt-7 text-[10px] font-bold tracking-[0.18em] text-slate-600">
                  POSITION
                </div>
                <div className="mt-2 border-t border-slate-800">
                  {positionOrder.map((position) => {
                    const stats = summary.positions.find(
                      (entry) => entry.position === position,
                    );
                    return (
                      <div
                        key={position}
                        className="grid min-h-11 grid-cols-[1fr_auto_auto] items-center gap-5 border-b border-slate-800 text-sm"
                      >
                        <span className="font-bold">{position}</span>
                        <span className="font-mono text-xs text-slate-600">
                          {stats ? `${stats.correct} / ${stats.attempts}` : '—'}
                        </span>
                        <span className="w-10 text-right font-mono font-bold">
                          {stats ? formatPercent(stats.accuracy) : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 text-[10px] font-bold tracking-[0.18em] text-slate-600">
                  SPOT
                </div>
                <div className="mt-3 flex gap-1 overflow-x-auto">
                  {positionOrder.map((position) => (
                    <button
                      key={position}
                      type="button"
                      className={`h-8 min-w-11 rounded-md border px-2 font-mono text-[10px] font-bold ${
                        selectedRecordPosition === position
                          ? 'border-slate-500 bg-slate-800 text-slate-100'
                          : 'border-slate-800 text-slate-600'
                      }`}
                      onClick={() => setSelectedRecordPosition(position)}
                    >
                      {position}
                    </button>
                  ))}
                </div>
                <div className="mt-3 border-t border-slate-800">
                  {(spotsByPosition[selectedRecordPosition] ?? []).map((spot) => {
                    const stats = statsBySpot.get(spot.id);
                    return (
                      <button
                        key={spot.id}
                        type="button"
                        className="grid min-h-14 w-full grid-cols-[1fr_auto] items-center gap-4 border-b border-slate-800 text-left"
                        onClick={() => prepareFixedSpot(spot)}
                        disabled={Boolean(activeSession)}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs text-slate-300">
                            {spot.label}
                          </div>
                          <div className="mt-1 truncate font-mono text-[10px] text-slate-600">
                            {displayActions(spot.preflopActions)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold">
                            {stats ? formatPercent(stats.accuracy) : '—'}
                          </div>
                          <div className="font-mono text-[10px] text-slate-600">
                            {stats ? `${stats.correct}/${stats.attempts}` : 'no data'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm border-slate-800 bg-[#0b0e13] text-slate-100">
            <DialogHeader>
              <DialogTitle>{result?.correct ? 'Correct' : 'Miss'}</DialogTitle>
              <DialogDescription className="sr-only">
                選択したアクションと混合戦略の判定結果
              </DialogDescription>
            </DialogHeader>
            {result && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-lg font-bold">
                    {result.selectedActionLabel}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-sm text-amber-400">
                    <Dice5 className="size-4" /> {result.diceRoll}
                  </span>
                </div>
                {!result.correct && (
                  <div className="text-sm text-slate-400">
                    {result.expectedActionLabel}
                  </div>
                )}
                <div className="space-y-2">
                  {rollBands.map(({ action, min, max }) => (
                    <div
                      key={action.key}
                      className="flex items-center justify-between font-mono text-xs"
                    >
                      <span className="text-slate-400">{action.label}</span>
                      <span>
                        {formatPercent(action.frequency)} · {min}–{max}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                className="w-full bg-slate-100 text-slate-950 hover:bg-slate-200"
                onClick={handleNext}
                disabled={isPending}
              >
                Next
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Button
          className="mx-auto mt-6 flex text-xs text-slate-600 hover:text-slate-300"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          前のページに戻る
        </Button>
      </main>
    </div>
  );
}
