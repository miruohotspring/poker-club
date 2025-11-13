// export type Result<T> = | {
//   success: true;
//   body: T;
// }
//   | {
//     success: false;
//     error: ActionError;
//   }
//
export type Result =
  | {
      success: true;
      body: string;
    }
  | {
      success: false;
      error: ActionError;
    };

export type ActionError = 'invalid-room-key';
