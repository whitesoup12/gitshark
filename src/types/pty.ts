export interface TerminalDataPayload {
  data: string;
}

export interface TerminalExitPayload {
  exit_code: number | null;
  success: boolean;
}

export interface PtyExecuteOptions {
  command: string;
  args?: string[];
  cols?: number;
  rows?: number;
}
