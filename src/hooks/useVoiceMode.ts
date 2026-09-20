import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelSpeech,
  getSpeechRecognitionCtor,
  isVoiceModeSupported,
  speakText,
  type SpeechRecognitionLike,
} from '../lib/voice';

export type VoicePhase = 'idle' | 'listening' | 'thinking' | 'speaking';

type Options = {
  /** Send a user utterance; resolve with assistant reply text (or null on failure). */
  onAutoSend: (text: string) => Promise<string | null>;
};

/**
 * Continuous voice conversation loop (browser SpeechRecognition + speechSynthesis).
 * Distinct from one-shot mic dictation into the text field.
 */
export function useVoiceMode({ onAutoSend }: Options) {
  const supported = isVoiceModeSupported();
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef(false);
  const phaseRef = useRef<VoicePhase>('idle');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListenRef = useRef(false);
  const handlingFinalRef = useRef(false);
  const onAutoSendRef = useRef(onAutoSend);
  const listenFnRef = useRef<() => void>(() => {});

  useEffect(() => {
    onAutoSendRef.current = onAutoSend;
  }, [onAutoSend]);

  const setPhaseBoth = (p: VoicePhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const stopRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (!rec) return;
    try {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.onspeechstart = null;
      rec.abort();
    } catch {
      /* ignore */
    }
  }, []);

  const exitVoiceMode = useCallback(() => {
    activeRef.current = false;
    wantListenRef.current = false;
    handlingFinalRef.current = false;
    setActive(false);
    stopRecognition();
    cancelSpeech();
    setPhaseBoth('idle');
  }, [stopRecognition]);

  const startListening = useCallback(() => {
    if (!activeRef.current) return;

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError('Voice mode is not supported in this browser');
      exitVoiceMode();
      return;
    }

    stopRecognition();
    wantListenRef.current = true;
    handlingFinalRef.current = false;

    const recognition = new Ctor();
    // continuous + interim so we can barge-in during TTS and catch finals reliably
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognitionRef.current = recognition;

    recognition.onspeechstart = () => {
      if (!activeRef.current) return;
      if (phaseRef.current === 'speaking') {
        cancelSpeech();
        setPhaseBoth('listening');
      }
    };

    recognition.onresult = (event) => {
      if (!activeRef.current || handlingFinalRef.current) return;
      // Ignore finals while waiting on the model
      if (phaseRef.current === 'thinking') return;

      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0]?.transcript ?? '';
        }
      }
      const transcript = finalChunk.trim();
      if (!transcript) return;

      handlingFinalRef.current = true;
      wantListenRef.current = false;
      cancelSpeech();
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }

      void (async () => {
        if (!activeRef.current) return;
        setPhaseBoth('thinking');
        setError(null);
        try {
          const reply = await onAutoSendRef.current(transcript);
          if (!activeRef.current) return;

          if (!reply?.trim()) {
            handlingFinalRef.current = false;
            setPhaseBoth('listening');
            listenFnRef.current();
            return;
          }

          setPhaseBoth('speaking');
          const speakPromise = speakText(reply);
          // Delayed barge-in mic so TTS can start without immediate echo cancel
          window.setTimeout(() => {
            if (activeRef.current && phaseRef.current === 'speaking') {
              handlingFinalRef.current = false;
              wantListenRef.current = true;
              if (!recognitionRef.current) listenFnRef.current();
            }
          }, 450);

          const reason = await speakPromise;
          if (!activeRef.current) return;

          if (phaseRef.current === 'speaking') {
            setPhaseBoth('listening');
          }
          // Ensure we are listening after TTS ends (or after barge-in)
          if (activeRef.current && phaseRef.current === 'listening' && !recognitionRef.current) {
            handlingFinalRef.current = false;
            wantListenRef.current = true;
            listenFnRef.current();
          }
          void reason;
        } catch {
          if (!activeRef.current) return;
          setError('Voice reply failed. Try again.');
          handlingFinalRef.current = false;
          setPhaseBoth('listening');
          listenFnRef.current();
        }
      })();
    };

    recognition.onerror = (event) => {
      const err = event.error || '';
      if (!activeRef.current) return;
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setError('Microphone permission denied. Allow mic access for Voice mode.');
        exitVoiceMode();
        return;
      }
      if (err === 'aborted' || err === 'no-speech') return;
      setError('Voice recognition failed. Try again.');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (!activeRef.current) return;
      if (wantListenRef.current && !handlingFinalRef.current && phaseRef.current !== 'thinking') {
        window.setTimeout(() => {
          if (
            activeRef.current &&
            wantListenRef.current &&
            !handlingFinalRef.current &&
            phaseRef.current !== 'thinking' &&
            !recognitionRef.current
          ) {
            listenFnRef.current();
          }
        }, 160);
      }
    };

    try {
      recognition.start();
      if (phaseRef.current !== 'speaking' && phaseRef.current !== 'thinking') {
        setPhaseBoth('listening');
      }
      setError(null);
    } catch {
      // start() can throw if already started; treat as soft failure
      if (activeRef.current && phaseRef.current === 'listening') {
        setError('Could not start Voice mode.');
        exitVoiceMode();
      }
    }
  }, [exitVoiceMode, stopRecognition]);

  useEffect(() => {
    listenFnRef.current = startListening;
  }, [startListening]);

  const enterVoiceMode = useCallback(() => {
    if (!supported) return;
    activeRef.current = true;
    setActive(true);
    setError(null);
    setPhaseBoth('listening');
    startListening();
  }, [startListening, supported]);

  const toggle = useCallback(() => {
    if (!supported) return;
    if (activeRef.current) exitVoiceMode();
    else enterVoiceMode();
  }, [enterVoiceMode, exitVoiceMode, supported]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitVoiceMode();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, exitVoiceMode]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      wantListenRef.current = false;
      stopRecognition();
      cancelSpeech();
    };
  }, [stopRecognition]);

  return {
    supported,
    active,
    phase,
    error,
    toggle,
    exit: exitVoiceMode,
  };
}
