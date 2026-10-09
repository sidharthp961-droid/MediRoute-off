import {
  ShieldAlert,
  Clock,
  Navigation,
  CheckCircle2,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import { JunctionTask, JunctionClearanceStatus, OfficerUser } from '../types';

interface JunctionTableProps {
  junctions: JunctionTask[];
  currentOfficer: OfficerUser;
  selectedJunctionId: string | null;
  onSelectJunction: (id: string) => void;
  onUpdateStatus: (
    junctionId: string,
    status: JunctionClearanceStatus,
    notes?: string,
  ) => void;
}

export function JunctionTable({
  junctions,
  currentOfficer,
  selectedJunctionId,
  onSelectJunction,
  onUpdateStatus,
}: JunctionTableProps) {
  const total = junctions.length;
  const clearedCount = junctions.filter((j) => j.status === 'CLEARED').length;
  const progressPercent = total > 0 ? Math.round((clearedCount / total) * 100) : 0;

  const getStatusBadge = (status: JunctionClearanceStatus) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-sky-300 border border-blue-500/30">
            <ShieldAlert className="w-3 h-3" />
            Assigned
          </span>
        );
      case 'CLEARING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/30 animate-pulse">
            <AlertCircle className="w-3 h-3" />
            Clearing
          </span>
        );
      case 'CLEARED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Cleared
          </span>
        );
    }
  };

  return (
    <div className="bg-police-navy border border-police-border/90 rounded-2xl p-4 shadow-xl space-y-4">
      {/* Header and Progress Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-police-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-extrabold text-base text-white tracking-wide flex items-center gap-2">
              <Navigation className="w-4 h-4 text-sky-400" />
              ROUTE JUNCTION CLEARANCE COORDINATION
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Coordinate police presence & traffic halt along emergency corridor
          </p>
        </div>

        {/* Corridor Readiness Gauge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">
              Corridor Readiness
            </div>
            <div className="text-sm font-mono font-bold text-sky-400">
              {clearedCount} / {total} Junctions ({progressPercent}%)
            </div>
          </div>
          <div className="w-20 bg-police-surface rounded-full h-2.5 border border-police-border overflow-hidden">
            <div
              className="bg-gradient-to-r from-sky-400 to-emerald-400 h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Junctions List */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {junctions.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No junctions active. Start or dispatch an emergency corridor to load junction clearance tasks.
          </div>
        ) : (
          junctions.map((jnc) => {
            const isSelected = selectedJunctionId === jnc.id;
            const distKm =
              jnc.distanceFromAmbulanceMetres !== undefined
                ? (jnc.distanceFromAmbulanceMetres / 1000).toFixed(1)
                : '--';
            const etaMins =
              jnc.etaSeconds !== undefined
                ? Math.max(1, Math.round(jnc.etaSeconds / 60))
                : '--';

            return (
              <div
                key={jnc.id}
                onClick={() => onSelectJunction(jnc.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-tactical-blue/20 border-sky-400/70 shadow-lg shadow-tactical-blue/10'
                    : 'bg-police-surface/70 hover:bg-police-surface border-police-border/80'
                }`}
              >
                {/* Left: Sequence, Name & Distances */}
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-police-navy border border-police-border flex items-center justify-center font-mono text-xs font-bold text-sky-400 flex-shrink-0 mt-0.5">
                    {jnc.sequenceOrder}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{jnc.name}</span>
                      {getStatusBadge(jnc.status)}
                    </div>

                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span>{jnc.landmark || 'Corridor checkpoint'}</span>
                    </div>

                    {/* Officer Assigned & Station */}
                    <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                      <span>Station: <strong className="text-slate-300">{jnc.assignedOfficerStation || 'Local Unit'}</strong></span>
                      {jnc.assignedOfficerName && (
                        <span>• Officer: <strong className="text-sky-300">{jnc.assignedOfficerName}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Distance / ETA & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4 ml-10 sm:ml-0">
                  {/* Distance and ETA */}
                  <div className="text-left sm:text-right font-mono">
                    <div className="text-xs font-bold text-white">
                      {distKm} km
                    </div>
                    <div className="text-[10px] text-amber-400 font-medium">
                      ~{etaMins} mins ETA
                    </div>
                  </div>

                  {/* Quick Action Progression Buttons */}
                  <div className="flex items-center gap-1.5">
                    {jnc.status === 'PENDING' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateStatus(
                            jnc.id,
                            'ASSIGNED',
                            `Assigned to ${currentOfficer.name}`,
                          );
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition active:scale-95 shadow"
                      >
                        Assign to Me
                      </button>
                    )}

                    {jnc.status === 'ASSIGNED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateStatus(
                            jnc.id,
                            'CLEARING',
                            'Halting cross-traffic at junction',
                          );
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white transition active:scale-95 shadow animate-pulse"
                      >
                        Mark Clearing
                      </button>
                    )}

                    {jnc.status === 'CLEARING' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateStatus(
                            jnc.id,
                            'CLEARED',
                            'Green corridor confirmed clear. Intersection secured.',
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95 shadow flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Cleared
                      </button>
                    )}

                    {jnc.status === 'CLEARED' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Allow resetting if traffic flow changes
                          onUpdateStatus(jnc.id, 'CLEARING', 'Traffic holds re-evaluated');
                        }}
                        className="px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-police-border transition"
                        title="Click to re-open if needed"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
