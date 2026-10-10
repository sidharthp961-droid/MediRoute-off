import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioAlarm() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const activeTripIdRef = useRef<string | null>(null);
  const testTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize or resume AudioContext safely
  const getAudioContext = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          audioCtxRef.current = new AudioCtxClass();
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().then(() => {
          setAutoplayBlocked(false);
        }).catch((err) => {
          console.warn('[AudioAlarm] Autoplay resume pending user gesture:', err);
          setAutoplayBlocked(true);
        });
      }
      return audioCtxRef.current;
    } catch (err) {
      console.warn('[AudioAlarm] AudioContext initialization failed:', err);
      return null;
    }
  }, []);

  const stopAlarm = useCallback((targetTripId?: string) => {
    // If targetTripId specified, only stop if it matches the currently ringing trip
    if (targetTripId && activeTripIdRef.current && activeTripIdRef.current !== targetTripId) {
      return;
    }

    // Clear any test tone timeout
    if (testTimeoutRef.current) {
      clearTimeout(testTimeoutRef.current);
      testTimeoutRef.current = null;
    }

    try {
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
        } catch {}
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      if (lfoRef.current) {
        try {
          lfoRef.current.stop();
        } catch {}
        lfoRef.current.disconnect();
        lfoRef.current = null;
      }
      if (lfoGainRef.current) {
        lfoGainRef.current.disconnect();
        lfoGainRef.current = null;
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect();
        gainNodeRef.current = null;
      }
    } catch (err) {
      console.warn('[AudioAlarm] Node cleanup error:', err);
    }

    activeTripIdRef.current = null;
    setActiveTripId(null);
    setIsPlaying(false);
  }, []);

  const startAlarm = useCallback((tripId?: string) => {
    if (isMuted) return;

    // Stop any existing playing tone before starting a new one
    stopAlarm();

    const ctx = getAudioContext();
    if (!ctx) return;

    const assignedId = tripId || 'default-alert';
    activeTripIdRef.current = assignedId;
    setActiveTripId(assignedId);

    try {
      // Main Tone Oscillator (Indian/European Emergency Siren Warble ~700-1100Hz)
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
      setAutoplayBlocked(false);
    } catch (err) {
      console.warn('[AudioAlarm] Could not start synthesized alarm:', err);
      stopAlarm();
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
        gain.gain.setValueAtTime(0.2, ctx.currentTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        setIsPlaying(true);
        activeTripIdRef.current = 'test-tone';
        setActiveTripId('test-tone');

        testTimeoutRef.current = setTimeout(() => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {}
          if (activeTripIdRef.current === 'test-tone') {
            activeTripIdRef.current = null;
            setActiveTripId(null);
            setIsPlaying(false);
          }
          testTimeoutRef.current = null;
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

  // Teardown on unmount
  useEffect(() => {
    return () => {
      stopAlarm();
    };
  }, [stopAlarm]);

  return {
    isPlaying,
    activeTripId,
    isMuted,
    autoplayBlocked,
    startAlarm,
    stopAlarm,
    testAlarm,
    toggleMute,
  };
}
