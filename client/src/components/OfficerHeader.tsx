import { useState } from 'react';
import { Shield, Radio, Wifi, WifiOff, UserCheck, ChevronDown, Check } from 'lucide-react';
import { OfficerUser } from '../types';

interface OfficerHeaderProps {
  officer: OfficerUser;
  onSelectOfficer: (officer: OfficerUser) => void;
  connected: boolean;
  bridgeStatus: { connectedToCore: boolean; coreUrl: string };
  onOpenAuditLogs: () => void;
}

const ROSTER_OPTIONS: OfficerUser[] = [
  {
    id: 'off-kl-02',
    badgeNumber: 'KP-TR-4055',
    name: 'SI Vinod Kumar',
    station: 'Muvattupuzha Traffic Enforcement Unit',
    role: 'officer',
  },
  {
    id: 'off-kl-01',
    badgeNumber: 'KP-TR-4012',
    name: 'Insp. Radhakrishnan Nair',
    station: 'Thodupuzha Traffic Police Unit',
    role: 'supervisor',
  },
  {
    id: 'off-kl-03',
    badgeNumber: 'KP-TR-5120',
    name: 'SCPO Priya Sasi',
    station: 'Thrippunithura Traffic Station',
    role: 'officer',
  },
  {
    id: 'off-kl-04',
    badgeNumber: 'KP-TR-6299',
    name: 'CPO Mathew Varghese',
    station: 'Kochi City Traffic West Unit (Vyttila)',
    role: 'officer',
  },
  {
    id: 'off-kl-05',
    badgeNumber: 'KP-TR-7001',
    name: 'CPO Anoop Das',
    station: 'Ernakulam City Traffic Central',
    role: 'officer',
  },
];

export function OfficerHeader({
  officer,
  onSelectOfficer,
  connected,
  bridgeStatus,
  onOpenAuditLogs,
}: OfficerHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="bg-police-navy border-b border-police-border/80 px-4 py-3 sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand / Department title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-tactical-blue to-tactical-navy flex items-center justify-center border border-sky-400/30 shadow-lg shadow-tactical-blue/20">
            <Shield className="w-5 h-5 text-sky-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base sm:text-lg text-white tracking-wide">
                MEDIROUTE <span className="text-sky-400 font-bold">OFFICER CONSOLE</span>
              </h1>
              <span className="text-[10px] bg-sky-500/15 border border-sky-500/30 text-sky-300 px-2 py-0.5 rounded-full font-mono font-semibold">
                TRAFFIC CORRIDOR
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Kerala Police Traffic Clearance & Emergency Corridor Management
            </p>
          </div>
        </div>

        {/* Status Indicators & Officer Profile Selector */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Core Server Bridge Status */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
              bridgeStatus.connectedToCore
                ? 'bg-tactical-emerald/10 border-tactical-emerald/40 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
            }`}
            title={`Core Server: ${bridgeStatus.coreUrl}`}
          >
            <Radio className={`w-3.5 h-3.5 ${bridgeStatus.connectedToCore ? 'animate-pulse' : ''}`} />
            <span className="hidden md:inline">Core Server:</span>
            <span>{bridgeStatus.connectedToCore ? 'SYNCED' : 'STANDALONE'}</span>
          </div>

          {/* Officer Server Connection */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
              connected
                ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-400'
            }`}
          >
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{connected ? 'LIVE' : 'OFFLINE'}</span>
          </div>

          {/* Audit Logs button */}
          <button
            onClick={onOpenAuditLogs}
            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-police-surface hover:bg-police-border border border-police-border text-slate-300 transition-colors"
          >
            Audit Logs
          </button>

          {/* Officer Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-police-surface hover:bg-police-border border border-police-border/90 px-3 py-1.5 rounded-xl text-xs transition shadow-sm text-left"
            >
              <UserCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <div className="hidden sm:block leading-tight">
                <div className="font-semibold text-white">{officer.name}</div>
                <div className="text-[10px] text-slate-400 truncate max-w-[140px] font-mono">
                  {officer.badgeNumber}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-police-navy border border-police-border rounded-xl shadow-2xl z-50 p-1.5">
                <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-police-border/60">
                  Switch On-Duty Officer (Roster)
                </div>
                <div className="py-1 max-h-60 overflow-y-auto">
                  {ROSTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        onSelectOfficer(opt);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                        officer.id === opt.id
                          ? 'bg-tactical-blue/30 text-sky-300 font-semibold'
                          : 'hover:bg-police-surface text-slate-200'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-white">{opt.name}</div>
                        <div className="text-[10px] text-slate-400">{opt.station}</div>
                        <div className="text-[10px] text-sky-400 font-mono mt-0.5">{opt.badgeNumber}</div>
                      </div>
                      {officer.id === opt.id && <Check className="w-4 h-4 text-sky-400" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
