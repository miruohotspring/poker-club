'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { PreflopQuestion } from './actions';
import { getPreflopQuestion } from './actions';

type Props = {
  initialQuestion: PreflopQuestion;
};

type ResultState = {
  selectedAction: string;
  selectedFrequency: number;
};

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function PreflopTrainingClient({ initialQuestion }: Props) {
  const [question, setQuestion] = useState(initialQuestion);
  const [result, setResult] = useState<ResultState | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSelect = (actionLabel: string, frequency: number) => {
    setResult({ selectedAction: actionLabel, selectedFrequency: frequency });
    setOpen(true);
  };

  const handleNext = () => {
    startTransition(async () => {
      const nextQuestion = await getPreflopQuestion();
      setQuestion(nextQuestion);
      setResult(null);
      setOpen(false);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <header className="rounded-2xl bg-slate-900 px-5 py-4 text-white shadow">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
            Preflop Spot Training
          </p>
          <h1 className="mt-2 text-2xl font-semibold">NL50 6max 100bb</h1>
          <p className="mt-1 text-sm text-slate-200">2.5x Open / 6max Cash</p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span className="font-semibold text-slate-100">
              {question.position}
            </span>
          </div>
          {question.spotLabel && (
            <div className="mt-2 text-sm text-slate-300">
              {question.spotLabel}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3">
            <div>
              <p className="text-xs text-slate-400">ハンド</p>
            </div>
            <div className="text-2xl font-semibold text-slate-100">
              {question.handDisplay}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-200">
            あなたのアクションは？
          </h2>
          <div className="mt-4 grid gap-2">
            {question.actions.map((action) => (
              <Button
                key={action.label}
                className="w-full justify-between border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-800"
                variant="outline"
                onClick={() => handleSelect(action.label, action.frequency)}
              >
                <span>{action.label}</span>
                <span className="text-xs text-slate-400">選択</span>
              </Button>
            ))}
          </div>
        </section>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm border-slate-800 bg-slate-950 text-slate-100">
            <DialogHeader>
              <DialogTitle>フィードバック</DialogTitle>
            </DialogHeader>
            {result && (
              <div className="space-y-4">
                <div className="rounded-lg bg-slate-900 p-3">
                  <p className="text-xs text-slate-400">あなたの選択</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {result.selectedAction}
                  </p>
                  <p
                    className={`text-sm font-semibold ${
                      result.selectedFrequency > 0
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {result.selectedFrequency > 0
                      ? `正解！頻度 ${formatPercent(result.selectedFrequency)}`
                      : '不正解（頻度 0%）'}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-slate-400">アクション別頻度</p>
                  {question.actions.map((action) => (
                    <div key={action.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{action.label}</span>
                        <span className="font-semibold text-slate-100">
                          {formatPercent(action.frequency)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-800">
                        <div
                          className="h-2 rounded-full bg-emerald-400"
                          style={{
                            width: `${Math.min(
                              100,
                              action.frequency * 100,
                            )}%`,
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
                  )}&history_spot=0&stratab=overview_range&gmff_depth=100&gmff_rake=NL50&gmff_opening_size=25x&gmff__3bet_size=gto`}
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
      </div>
    </div>
  );
}
