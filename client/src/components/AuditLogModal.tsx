import { useEffect, useState } from 'react';
import { X, ShieldCheck, Clock, RefreshCw } from 'lucide-react';
import { AuditLogEntry } from '../types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuditLogModal({ isOpen, onClose }: AuditLogModalProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const hostname = window.location.hostname || 'localhost';
      const res = await fetch(`http://${hostname}:3002/api/v1/audit-logs`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-police-navy border border-police-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-police-border/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-white text-base">Traffic Clearance Audit Trail</h3>
              <p className="text-xs text-slate-400">
                Immutable chronological log of all officer actions and emergency dispatches
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="p-1.5 rounded-lg bg-police-surface hover:bg-police-border text-slate-300 transition"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-police-surface hover:bg-police-border text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              {loading ? 'Loading audit trail...' : 'No audit records logged yet.'}
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-police-surface/80 border border-police-border/70 space-y-1"
              >
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span className="flex items-center gap-1 text-sky-400 font-bold">
                    <Clock className="w-3 h-3" />
                    {new Date(log.timestamp).toLocaleTimeString()} ({new Date(log.timestamp).toLocaleDateString()})
                  </span>
                  <span className="text-slate-500">{log.id}</span>
                </div>

                <div className="font-bold text-white text-xs">{log.action}</div>

                <div className="text-slate-300 text-[11px]">
                  Actor: <span className="text-sky-300 font-semibold">{log.actorName}</span>{' '}
                  <span className="text-slate-500">({log.actorId})</span>
                </div>

                {log.details && (
                  <pre className="text-[10px] text-slate-400 bg-police-dark/60 p-2 rounded-lg overflow-x-auto mt-1 border border-police-border/40">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
