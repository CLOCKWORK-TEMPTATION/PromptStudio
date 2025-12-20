import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Check, X, Volume2 } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useAppStore } from '../../stores/appStore';
import clsx from 'clsx';

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onstart: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function VoiceInput() {
  const { theme } = useAppStore();
  const { setContent, content } = useEditorStore();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();

    const recognition = recognitionRef.current;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPart;
        } else {
          interimText += transcriptPart;
        }
      }

      if (finalTranscript) {
        setTranscript((prev) => prev + ' ' + finalTranscript);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setError(event.error === 'not-allowed'
        ? 'Microphone access denied. Please allow microphone access.'
        : 'Error recognizing speech. Please try again.');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return () => {
      recognition.abort();
    };
  }, [isSupported]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
    if (transcript.trim()) {
      setShowPreview(true);
      processTranscript(transcript.trim());
    }
  };

  const processTranscript = async (text: string) => {
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const structuredPrompt = transformToPrompt(text);
    setTranscript(structuredPrompt);
    setIsProcessing(false);
  };

  const transformToPrompt = (text: string): string => {
    let result = text;

    const roleMatch = text.match(/(?:act as|be a|you are)(?: a| an)?\s+([^,.\n]+)/i);
    if (roleMatch) {
      result = `You are ${roleMatch[1].trim()}.\n\n${text.replace(roleMatch[0], '').trim()}`;
    }

    result = result
      .replace(/(?:give me|provide|create|generate|write)(?: a| an| the)?\s+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!result.endsWith('.') && !result.endsWith('?') && !result.endsWith('!')) {
      result += '.';
    }

    return result;
  };

  const applyTranscript = () => {
    const newContent = content ? `${content}\n\n${transcript}` : transcript;
    setContent(newContent);
    setShowPreview(false);
    setTranscript('');
  };

  const cancelTranscript = () => {
    setShowPreview(false);
    setTranscript('');
  };

  if (!isSupported) {
    return (
      <div className={clsx(
        'p-4 rounded-lg border text-center',
        theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
      )}>
        <MicOff className={clsx('w-8 h-8 mx-auto mb-2', theme === 'dark' ? 'text-gray-600' : 'text-gray-400')} />
        <p className={clsx('text-sm', theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
          Voice input is not supported in this browser
        </p>
      </div>
    );
  }

  return (
    <div className={clsx(
      'rounded-lg border overflow-hidden',
      theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
    )}>
      <div className={clsx(
        'px-4 py-3 flex items-center justify-between',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        <div className="flex items-center gap-2">
          <Volume2 className={clsx('w-5 h-5', theme === 'dark' ? 'text-rose-400' : 'text-rose-600')} />
          <span className={clsx('font-medium', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Voice to Prompt
          </span>
        </div>
      </div>

      <div className={clsx(
        'px-4 py-4 border-t',
        theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
      )}>
        {error && (
          <div className={clsx(
            'mb-4 p-3 rounded-lg text-sm',
            theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'
          )}>
            {error}
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={isProcessing}
            className={clsx(
              'w-16 h-16 rounded-full flex items-center justify-center transition-all',
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : theme === 'dark'
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              isProcessing && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isProcessing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : isListening ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          <p className={clsx(
            'text-sm',
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          )}>
            {isListening
              ? 'Listening... Click to stop'
              : isProcessing
                ? 'Processing...'
                : 'Click to start speaking'}
          </p>

          {(isListening || interimTranscript) && (
            <div className={clsx(
              'w-full p-3 rounded-lg text-sm',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            )}>
              {transcript && (
                <p className={theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}>
                  {transcript}
                </p>
              )}
              {interimTranscript && (
                <p className={clsx(
                  'italic',
                  theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                )}>
                  {interimTranscript}
                </p>
              )}
            </div>
          )}
        </div>

        {showPreview && transcript && (
          <div className="mt-4 space-y-3">
            <div className={clsx(
              'p-3 rounded-lg',
              theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
            )}>
              <p className={clsx(
                'text-xs font-medium mb-2',
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              )}>
                Processed Prompt:
              </p>
              <p className={clsx(
                'text-sm whitespace-pre-wrap',
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              )}>
                {transcript}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={applyTranscript}
                className={clsx(
                  'flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                )}
              >
                <Check className="w-4 h-4" />
                Insert
              </button>
              <button
                onClick={cancelTranscript}
                className={clsx(
                  'flex-1 py-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors',
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className={clsx(
          'mt-4 text-xs',
          theme === 'dark' ? 'text-gray-600' : 'text-gray-400'
        )}>
          <p className="mb-1">Tips:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Speak clearly and at a normal pace</li>
            <li>Say "act as" to define a role</li>
            <li>Pause briefly between sentences</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
