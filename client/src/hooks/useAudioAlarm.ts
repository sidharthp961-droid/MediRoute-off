import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioAlarm() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);

  // Initialize or resume AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtxRef.current = new AudioCtxClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const stopAlarm = useCallback(() => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (lfoRef.current) {
        lfoRef.current.stop();
        lfoRef.current.disconnect();
        lfoRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    } catch {
      // ignore cleanup errors
    }
    setIsPlaying(false);
  }, []);

  const startAlarm = useCallback(() => {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    stopAlarm(); // Stop any existing nodes

    try {
      // Main Tone Oscillator (European/Indian Police Siren Warble ~700-1100Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // LFO for pitch modulation (frequency modulation siren effect)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(850, ctx.currentTime);

      lfo.type = 'triangle';
      lfo.frequency.setValueAtTime(1.8, ctx.currentTime); // 1.8 Hz warble rate
      lfoGain.gain.setValueAtTime(250, ctx.currentTime); // modulate pitch +-250 Hz

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.22, ctx.currentTime); // Safe audible volume

      osc.connect(gain);
      gain.connect(ctx.destination);

      lfo.start();
      osc.start();

      oscillatorRef.current = osc;
      lfoRef.current = lfo;
      lfoGainRef.current = lfoGain;
      gainNodeRef.current = gain;

      setIsPlaying(true);
    } catch (err) {
      console.warn('[AudioAlarm] Could not start synthesized alarm:', err);
    }
  }, [getAudioContext, isMuted, stopAlarm]);

  const testAlarm = useCallback(
    (durationMs = 2200) => {
      const ctx = getAudioContext();
      if (!ctx) return;

      stopAlarm();

      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        // Beep sequence
        gain.gain.setValueAtTime(0.2, ctx.currentTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();

        setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            // ignore
          }
        }, durationMs);
      } catch (err) {
        console.warn('[AudioAlarm] Test sound failed:', err);
      }
    },
    [getAudioContext, stopAlarm],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        stopAlarm();
      }
      return next;
    });
  }, [stopAlarm]);

  useEffect(() => {
    return () => {
      stopAlarm();
    };
  }, [stopAlarm]);

  return {
    isPlaying,
    isMuted,
    startAlarm,
    stopAlarm,
    testAlarm,
    toggleMute,
  };
}
