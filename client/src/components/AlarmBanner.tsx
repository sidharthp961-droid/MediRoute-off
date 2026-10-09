import {
  AlertTriangle,
  Volume2,
  VolumeX,
  BellRing,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { EmergencyTrip } from '../types';

interface AlarmBannerProps {
  trip: EmergencyTrip | null;
  isPlaying: boolean;
  isMuted: boolean;
  onTestAlarm: () => void;
  onToggleMute: () => void;
  onSilenceAlarm: () => void;
  onAcknowledge: () => void;
}

export function AlarmBanner({
  trip,
  isPlaying,
  isMuted,
  onTestAlarm,
  onToggleMute,
  onSilenceAlarm,
  onAcknowledge,
}: AlarmBannerProps) {
  const isCritical = trip?.priority === 'CRITICAL';

  return (
    <div className="w-full space-y-2">
      {/* Active Siren Flashing Bar */}
      {isPlaying && (
        <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white px-4 py-3 rounded-2xl shadow-xl shadow-red-950/60 flex flex-wrap items-center justify-between gap-3 animate-flashFast border-2 border-red-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center animate-bounce">
              <BellRing className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-extrabold text-sm sm:text-base tracking-wide flex items-center gap-2">
                <span>🚨 AUDIBLE SIREN ACTIVE: PRIORITY CLEARANCE IN PROGRESS</span>
              </div>
              <div className="text-xs text-red-100 font-medium">
                Ambulance en-route to {trip?.destinationName || 'Hospital Hub'}. Halt intersecting traffic immediately!
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onSilenceAlarm();
                onAcknowledge();
              }}
              className="bg-white text-rose-700 hover:bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Silence & Acknowledge
            </button>
          </div>
        </div>
      )}

      {/* Main Alert Info Bar */}
      {trip ? (
        <div
          className={`p-4 rounded-2xl border transition shadow-lg ${
            isCritical
              ? 'bg-police-navy border-rose-500/40 shadow-rose-950/30'
              : 'bg-police-navy border-amber-500/40 shadow-amber-950/30'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Priority & Patient info */}
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                  isCritical
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                }`}
              >
                <Activity className="w-6 h-6 animate-pulse" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                      isCritical
                        ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                        : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    }`}
                  >
                    {trip.priority} CORRIDOR
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Vehicle: #{trip.vehicleId}
                  </span>
                  {trip.isSimulated && (
                    <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded font-mono">
                      DEMO MODE
                    </span>
                  )}
                </div>

                <div className="font-bold text-sm sm:text-base text-white mt-0.5">
                  Destination: <span className="text-sky-400">{trip.destinationName}</span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Condition: {trip.patientCondition}</span>
                </div>
              </div>
            </div>

            {/* Right: Audio Siren Controls (Test Alarm, Mute, Volume) */}
            <div className="flex items-center gap-2 ml-auto">
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
