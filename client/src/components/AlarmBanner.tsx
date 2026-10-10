import {
  AlertTriangle,
  Volume2,
  VolumeX,
  BellRing,
  BellOff,
  CheckCircle2,
  Activity,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { EmergencyTrip } from '../types';

interface AlarmBannerProps {
  trip: EmergencyTrip | null;
  isPlaying: boolean;
  activeTripId?: string | null;
  isMuted: boolean;
  autoplayBlocked?: boolean;
  onTestAlarm: () => void;
  onToggleMute: () => void;
  onSilenceAlarm: (tripId?: string) => void;
  onAcknowledge: (tripId?: string) => void;
}

export function AlarmBanner({
  trip,
  isPlaying,
  isMuted,
  autoplayBlocked = false,
  onTestAlarm,
  onToggleMute,
  onSilenceAlarm,
  onAcknowledge,
}: AlarmBannerProps) {
  const isCritical = trip?.priority === 'CRITICAL';
  const isAcknowledged = !!trip?.acknowledged;

  // Handle immediate acknowledge & stop sound
  const handleAcknowledgeAndStop = () => {
    if (!trip) return;
    onSilenceAlarm(trip.tripId);
    onAcknowledge(trip.tripId);
  };

  return (
    <div className="w-full space-y-2">
      {/* ── 1. ACTIVE SIREN FLASHING BAR (Visible when sound is actively playing) ── */}
      {isPlaying && !isAcknowledged && (
        <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white px-4 py-3.5 rounded-2xl shadow-xl shadow-red-950/60 flex flex-wrap items-center justify-between gap-3 animate-flashFast border-2 border-red-400">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center animate-bounce flex-shrink-0">
              <BellRing className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-sm sm:text-base tracking-wide flex items-center gap-2">
                <span>🚨 AUDIBLE SIREN ACTIVE: PRIORITY CLEARANCE IN PROGRESS</span>
              </div>
              <div className="text-xs text-red-100 font-medium">
                Ambulance #{trip?.vehicleId} en-route to {trip?.destinationName || 'Hospital Hub'}. Halt intersecting traffic immediately!
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-stop-alarm-acknowledge"
              onClick={handleAcknowledgeAndStop}
              className="bg-white text-rose-700 hover:bg-slate-100 active:scale-95 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold uppercase tracking-wider transition shadow-lg flex items-center gap-2 border border-rose-300"
            >
              <BellOff className="w-4 h-4 text-rose-600" />
              <span>Acknowledge / Stop Alarm</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 2. AUTOPLAY BLOCKED ADVISORY (If browser requires user interaction) ── */}
      {autoplayBlocked && !isAcknowledged && (
        <div className="bg-amber-500/15 border border-amber-500/40 text-amber-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Audio siren paused by browser autoplay policy. Tap anywhere or click button to acknowledge alert.</span>
          </div>
          <button
            onClick={handleAcknowledgeAndStop}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-lg text-xs transition"
          >
            Acknowledge Alert
          </button>
        </div>
      )}

      {/* ── 3. MAIN ALERT CARD ── */}
      {trip ? (
        <div
          className={`p-4 rounded-2xl border transition shadow-lg ${
            isAcknowledged
              ? 'bg-police-navy border-emerald-500/40 shadow-emerald-950/20'
              : isCritical
              ? 'bg-police-navy border-rose-500/40 shadow-rose-950/30'
              : 'bg-police-navy border-amber-500/40 shadow-amber-950/30'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Priority & Patient info */}
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                  isAcknowledged
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : isCritical
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                }`}
              >
                {isAcknowledged ? (
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                ) : (
                  <Activity className="w-6 h-6 animate-pulse" />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                      isAcknowledged
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : isCritical
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    }`}
                  >
                    {trip.priority} CORRIDOR
                  </span>

                  {/* Acknowledged Status Badge */}
                  {isAcknowledged ? (
                    <span className="text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ACKNOWLEDGED {trip.acknowledgedBy ? `BY ${trip.acknowledgedBy.toUpperCase()}` : ''}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold bg-rose-500/15 border border-rose-500/40 text-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                      <Radio className="w-3 h-3 text-rose-400" />
                      <span>PENDING ACKNOWLEDGEMENT</span>
                    </span>
                  )}

                  <span className="text-xs font-mono text-slate-400">
                    Vehicle: #{trip.vehicleId}
                  </span>
                  {trip.isSimulated && (
                    <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded font-mono">
                      DEMO MODE
                    </span>
                  )}
                </div>

                <div className="font-bold text-sm sm:text-base text-white mt-1">
                  Destination: <span className="text-sky-400">{trip.destinationName}</span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Condition: {trip.patientCondition}</span>
                  {isAcknowledged && (
                    <span className="text-emerald-400 ml-2 font-medium">
                      • Siren Silenced — Corridor tracking remains active
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Explicit Action & Audio Controls */}
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {/* PRIMARY ACKNOWLEDGE / STOP ALARM BUTTON */}
              {!isAcknowledged ? (
                <button
                  id="btn-acknowledge-alert"
                  onClick={handleAcknowledgeAndStop}
                  className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40 border border-emerald-400"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                  <span>Acknowledge / Stop Alarm</span>
                </button>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Corridor Acknowledged</span>
                </div>
              )}

              {/* Quick Stop Button if alarm playing and acknowledged */}
              {isPlaying && isAcknowledged && (
                <button
                  onClick={() => onSilenceAlarm(trip.tripId)}
                  className="bg-rose-600/80 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                >
                  <BellOff className="w-3.5 h-3.5" />
                  <span>Stop Sound</span>
                </button>
              )}

              {/* Test Alarm Button */}
              <button
                onClick={onTestAlarm}
                title="Test siren audio output"
                className="bg-police-surface hover:bg-police-border border border-police-border text-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition active:scale-95"
              >
                <Volume2 className="w-4 h-4 text-sky-400" />
                <span>Test Alarm</span>
              </button>

              {/* Mute Button */}
              <button
                onClick={onToggleMute}
                title={isMuted ? 'Unmute siren' : 'Mute siren'}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition active:scale-95 ${
                  isMuted
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : 'bg-police-surface hover:bg-police-border border-police-border text-slate-300'
                }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                <span>{isMuted ? 'Muted' : 'Sound On'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Standby state when no active trip */
        <div className="p-4 rounded-2xl bg-police-navy border border-police-border flex flex-wrap items-center justify-between gap-3 text-slate-400 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">All corridors standby:</span>
            <span>No active patient transport corridor reported. Listening for MediRoute dispatches...</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onTestAlarm}
              className="bg-police-surface hover:bg-police-border border border-police-border text-slate-300 px-3 py-1 rounded-xl text-xs flex items-center gap-1.5 transition"
            >
              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Test Audio Siren</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
