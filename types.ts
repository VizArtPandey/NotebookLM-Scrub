
export enum ProcessingStatus {
  IDLE = 'IDLE',
  LOADING_FILE = 'LOADING_FILE',
  AI_ANALYZING = 'AI_ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

// Added SlideElement interface to match expectations in pptxService
export interface SlideElement {
  type: 'text' | 'title' | 'image' | 'bullet_list' | 'branding_replacement';
  x: number;
  y: number;
  w: number;
  h: number;
  content?: string;
  imageData?: string;
  fontSize?: number;
  isBold?: boolean;
  color?: string;
  align?: 'left' | 'center' | 'right';
  opacity?: number;
}

export interface SlideData {
  id: number;
  originalImage: string;
  // Fix: Added elements property to SlideData to resolve "Property 'elements' does not exist" error
  elements: SlideElement[];
}

export interface ProcessingState {
  status: ProcessingStatus;
  progress: number;
  message: string;
  slides: SlideData[];
}
