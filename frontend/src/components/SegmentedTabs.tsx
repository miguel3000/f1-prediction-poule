interface SegmentedTabsProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  scrollable?: boolean;
}

// App-style segmented control: pink active pill, horizontally scrollable with snap
// when there are more options than fit on screen (used for session tabs on Stats).
function SegmentedTabs<T extends string>({ options, value, onChange, scrollable }: SegmentedTabsProps<T>) {
  return (
    <div
      className={`flex gap-1 p-1 bg-f1-neutral-900 border border-f1-neutral-800 ${
        scrollable ? 'overflow-x-auto snap-x snap-mandatory scrollbar-none' : ''
      }`}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-shrink-0 ${scrollable ? 'snap-start' : 'flex-1'} px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
            value === opt.value
              ? 'bg-f1-pink-500 text-white shadow-f1-glow'
              : 'text-f1-neutral-400 hover:text-white hover:bg-f1-neutral-800'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default SegmentedTabs;
