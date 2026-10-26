export interface PouleOption {
  id: string; // 'main' or a group id
  label: string;
}

interface PouleSelectorProps {
  poules: PouleOption[];
  value: string;
  onChange: (id: string) => void;
  label: string; // accessible name of the whole control
}

// Picks which poule the standings are about. Buttons that wrap onto more rows when a player is in
// many groups, so it stays readable at 320 px; long group names are cut with an ellipsis.
const PouleSelector = ({ poules, value, onChange, label }: PouleSelectorProps) => (
  <div role="group" aria-label={label} className="flex flex-wrap gap-1 p-1 bg-f1-neutral-900 border border-f1-neutral-800">
    {poules.map((p) => (
      <button
        key={p.id}
        type="button"
        onClick={() => onChange(p.id)}
        aria-pressed={value === p.id}
        title={p.label}
        className={`min-w-0 max-w-full flex-1 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${
          value === p.id ? 'bg-f1-yellow-500 text-black' : 'text-white hover:bg-f1-neutral-800'
        }`}
      >
        <span className="block truncate">{p.label}</span>
      </button>
    ))}
  </div>
);

export default PouleSelector;
