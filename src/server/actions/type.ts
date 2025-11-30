export type ActionResult<T> =
  | {
      success: true;
      body: T;
    }
  | {
      success: false;
      error: ActionError;
    };

// 部屋
export type Room = {
  roomId: string;
  roomKey: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ActionError =
  | 'not-found-room'
  | 'not-found-balance'
  | 'not-enough-balance'
  | 'invalid-room-key'
  | 'invalid-room-name'
  | 'internal-server-error';
