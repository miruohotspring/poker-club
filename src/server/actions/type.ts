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

export type ActionError = 'invalid-room-key';
