import type { Filters } from '../lib/filters';
import { inputClass } from './ui';

export function ListFilters({
  value,
  onChange,
  statuses,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  statuses: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="Search number or customer"
          className={`${inputClass} sm:max-w-xs`}
        />
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <input type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className={inputClass} aria-label="From date" />
          <span>to</span>
          <input type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} className={inputClass} aria-label="To date" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[{ id: '', label: 'All' }, ...statuses].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange({ ...value, status: s.id })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              value.status === s.id ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
