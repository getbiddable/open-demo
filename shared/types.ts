// types.ts — open-demo shared TypeScript type definitions
// Reference only — not used at runtime (extension uses vanilla JS)

export interface Step {
  id: string;
  timestamp: number;
  action: 'click' | 'input' | 'scroll' | 'navigate';
  element: {
    tag: string;
    label: string;
    id: string;
    classes: string;
  };
  value?: string;
  url?: string;
  direction?: 'up' | 'down';
  screenshot: string; // base64 data URL (JPEG)
  description: string;
}

export interface Guide {
  id: string;
  title: string;
  steps: Step[];
  createdAt: number;
}

export type MessageType =
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'GET_STATE'
  | 'STEP_EVENT'
  | 'OPEN_EDITOR'
  | 'STEPS_UPDATED';

export interface Message {
  type: MessageType;
  data?: Partial<Step>;
  steps?: Step[];
  isRecording?: boolean;
  stepCount?: number;
}

export interface RecordingState {
  isRecording: boolean;
  stepCount: number;
}
