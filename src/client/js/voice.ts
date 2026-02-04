// Voice Input Module - Smart Office POC
// Browser-based speech-to-text using Web Speech API

// Web Speech API type declarations (for browsers that support it)
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionResultEvent) => void)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
    | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionResultEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

export interface VoiceInputOptions {
  onResult: (text: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
}

export class VoiceInput {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private options: VoiceInputOptions;

  constructor(options: VoiceInputOptions) {
    this.options = options;
    this.initialize();
  }

  private initialize(): void {
    // Check for browser support
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      console.warn("Speech recognition not supported in this browser");
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.continuous = this.options.continuous ?? true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.options.language || "en-US";

    // Event handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      this.options.onStart?.();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.options.onEnd?.();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;

      this.options.onResult(transcript, isFinal);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      this.isListening = false;
      this.options.onError?.(event.error);
    };
  }

  /**
   * Check if speech recognition is supported
   */
  isSupported(): boolean {
    return this.recognition !== null;
  }

  /**
   * Check if currently listening
   */
  isActive(): boolean {
    return this.isListening;
  }

  /**
   * Start listening for speech
   */
  start(): boolean {
    if (!this.recognition) {
      this.options.onError?.("Speech recognition not supported");
      return false;
    }

    if (this.isListening) {
      return true;
    }

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      return false;
    }
  }

  /**
   * Stop listening
   */
  stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Toggle listening state
   */
  toggle(): boolean {
    if (this.isListening) {
      this.stop();
      return false;
    } else {
      return this.start();
    }
  }

  /**
   * Set the recognition language
   */
  setLanguage(lang: string): void {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }
}

// Singleton instance for easy access
let voiceInputInstance: VoiceInput | null = null;

export function getVoiceInput(options: VoiceInputOptions): VoiceInput {
  if (!voiceInputInstance) {
    voiceInputInstance = new VoiceInput(options);
  }
  return voiceInputInstance;
}
