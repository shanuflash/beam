export type TransferState =
  | "idle"
  | "waiting"
  | "connected"
  | "sending"
  | "receiving"
  | "done"
  | "error";

export interface TransferMeta {
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
}
