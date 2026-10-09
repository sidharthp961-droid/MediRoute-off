import { useState } from 'react';
import { OfficerHeader } from './components/OfficerHeader';
import { AlarmBanner } from './components/AlarmBanner';
import { OfficerMap } from './components/OfficerMap';
import { JunctionTable } from './components/JunctionTable';
import { AuditLogModal } from './components/AuditLogModal';
import { useOfficerSocket } from './hooks/useOfficerSocket';
import { useAudioAlarm } from './hooks/useAudioAlarm';
import {
  Play,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';

export function App() {
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // Audio siren hook
  const {
    isPlaying: isAlarmPlaying,
    isMuted,
    startAlarm,
    stopAlarm,
    testAlarm,
    toggleMute,
  } = useAudioAlarm();

  // Officer socket connection
  const {
    connected,
    activeTrip,
    junctions,
    officer,
    setOfficer,
    bridgeStatus,
    updateJunctionStatus,
    acknowledgeTrip,
    triggerDemoTrip,
  } = useOfficerSocket(() => {
    // Fired when server sends new alert with alarmTrigger = true
    startAlarm();
  });

  const handleStartDemoTrip = async () => {
    setDemoLoading(true);
    try {
      await triggerDemoTrip();
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-police-dark text-slate-100 flex flex-col font-sans">
      {/* Top Police Header Bar */}
      <OfficerHeader
        officer={officer}
        onSelectOfficer={setOfficer}
        connected={connected}
        bridgeStatus={bridgeStatus}
        onOpenAuditLogs={() => setIsAuditModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* Audible Alert Strip */}
        <AlarmBanner
          trip={activeTrip}
          isPlaying={isAlarmPlaying}
          isMuted={isMuted}
          onTestAlarm={() => testAlarm(2500)}
          onToggleMute={toggleMute}
          onSilenceAlarm={stopAlarm}
          onAcknowledge={acknowledgeTrip}
        />

        {/* Demo Controls Strip & PWA Notice */}
        <div className="bg-police-navy/60 border border-police-border/70 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-sky-500/15 border border-sky-500/30 text-sky-300 px-2 py-0.5 rounded font-mono font-bold uppercase">
              Demo Simulation
            </span>
            <span className="text-slate-300">
              {activeTrip
                ? `Active corridor: #${activeTrip.vehicleId} en-route to ${activeTrip.destinationName}`
                : 'No active emergency. You can trigger a demo trip or wait for MediRoute Core Server dispatch.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleStartDemoTrip}
              disabled={demoLoading}
              className="bg-tactical-blue hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{demoLoading ? 'Starting...' : 'Trigger Demo Emergency Corridor'}</span>
            </button>
          </div>
        </div>

        {/* Tactical Grid: Map & Clearance Coordination */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Map Column */}
          <div className="lg:col-span-7 h-[420px] sm:h-[520px]">
            <OfficerMap
              trip={activeTrip}
              junctions={junctions}
              selectedJunctionId={selectedJunctionId}
              onSelectJunction={setSelectedJunctionId}
            />
          </div>

          {/* Junction Clearance Table Column */}
          <div className="lg:col-span-5">
            <JunctionTable
              junctions={junctions}
              currentOfficer={officer}
              selectedJunctionId={selectedJunctionId}
              onSelectJunction={setSelectedJunctionId}
              onUpdateStatus={updateJunctionStatus}
            />
          </div>
        </div>

        {/* PWA & System Information Banner */}
        <div className="bg-police-navy/40 border border-police-border/60 rounded-2xl p-4 space-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <Smartphone className="w-4 h-4 text-sky-400" />
            <span>Mobile Police Experience (PWA on LAN):</span>
          </div>
          <p>
            This Officer Console is configured as an installable Progressive Web App (PWA). Traffic officers on patrol can open{' '}
            <code className="text-sky-300 font-mono">http://&lt;YOUR_LAN_IP&gt;:5174</code> on their mobile browsers, tap{' '}
            <strong>"Add to Home Screen"</strong>, and receive real-time junction alerts full-screen with tactile audio alarms.
          </p>
          <div className="flex items-center gap-2 pt-1 text-[11px] text-amber-300/80 border-t border-police-border/40">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>
              Disclaimer: Automatic traffic signal preemption and siren audio triggers are simulated for this demonstration.
              Does not replace official police wireless dispatch networks.
            </span>
          </div>
        </div>
      </main>

      {/* Audit Log Modal */}
      <AuditLogModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-police-border/60 bg-police-navy px-4 py-3 text-center text-xs text-slate-400 mt-auto">
        MediRoute Officer Alert Server & Clearance Console • Kerala Police Hackathon Demo 2026
      </footer>
    </div>
  );
}
export default App;
