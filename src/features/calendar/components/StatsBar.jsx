import React from 'react';
import { ClipboardList, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

const STAT_CARDS = [
  {
    key: 'total',
    label: 'Total del Mes',
    icon: ClipboardList,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    key: 'pending',
    label: 'Pendientes',
    icon: AlertCircle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
  },
  {
    key: 'inProgress',
    label: 'En Proceso',
    icon: Clock,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    key: 'completed',
    label: 'Completados',
    icon: CheckCircle2,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
  },
];

export function StatsBar({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {STAT_CARDS.map(({ key, label, icon: Icon, color, bg }) => (
        <div
          key={key}
          className={`flex items-center gap-3 p-3 rounded-xl border ${bg}`}
        >
          <div className={`${color} shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-100 leading-none">{stats?.[key] ?? 0}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
