'use server';

import { redirect } from 'next/navigation';
import type { ActionResult } from './type';

export async function enterRoom(
  formData: FormData,
): Promise<ActionResult<void>> {
  const roomKey = formData.get('roomKey');
  if (typeof roomKey !== 'string' || !/^[0-9]{6}$/.test(roomKey)) {
    return {
      success: false,
      error: 'invalid-room-key',
    };
  }

  // TODO: 部屋確認, 部屋作成
  redirect(`/room/${encodeURIComponent(roomKey.trim())}`);
}
