'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type TabKey = 'chips' | 'leader' | 'history' | 'settings';

interface BottomTabBarProps {
  active: TabKey;
  onSelect?: (key: TabKey) => void;
}

export function BottomTabBar({ active, onSelect }: BottomTabBarProps) {
  return (
    // 画面下に「浮いた」感じで中央寄せ
    <nav className="fixed inset-x-0 bottom-20 flex justify-center">
      <Tabs
        value={active}
        onValueChange={(val) => onSelect?.(val as TabKey)}
        className="w-auto"
      >
        {/* ここが 2 枚目スクショの「丸い台座」 */}
        <TabsList
          className={cn(
            'inline-flex items-center justify-center gap-1',
            'rounded-sm bg-muted px-1 py-1',
            'text-muted-foreground',
          )}
        >
          <TabsTrigger value="chips" className={tabTriggerClass}>
            チップ
          </TabsTrigger>
          <TabsTrigger value="leader" className={tabTriggerClass}>
            リーダー
          </TabsTrigger>
          <TabsTrigger value="history" className={tabTriggerClass}>
            履歴
          </TabsTrigger>
          <TabsTrigger value="settings" className={tabTriggerClass}>
            設定
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </nav>
  );
}

// タブ本体のスタイルを共通化
const tabTriggerClass = cn(
  'rounded-sm px-5 py-2 text-sm font-medium',
  'transition-colors',
  // 非アクティブ
  'text-muted-foreground',
  // アクティブ時：白文字 + 少し明るい背景 + 枠
  'data-[state=active]:bg-background',
  'data-[state=active]:text-foreground',
  'data-[state=active]:border data-[state=active]:border-border',
);
