'use client';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

interface StateSelectorProps {
  selected: string[];
  onChange: (states: string[]) => void;
}

export default function StateSelector({ selected, onChange }: StateSelectorProps) {
  function toggle(state: string) {
    if (selected.includes(state)) {
      onChange(selected.filter(s => s !== state));
    } else {
      onChange([...selected, state]);
    }
  }

  return (
    <div>
      <label className="block text-sm text-[#8899bb] mb-1.5">
        Target States ({selected.length} selected)
      </label>
      <div className="grid grid-cols-10 gap-1 bg-[#162035] border border-[#1e2d4a] rounded-lg p-3 max-h-28 overflow-y-auto">
        {US_STATES.map(state => (
          <button
            key={state}
            type="button"
            onClick={() => toggle(state)}
            className={`text-xs py-0.5 px-0.5 rounded transition-colors font-medium ${
              selected.includes(state)
                ? 'bg-[#1a4b8c] text-white'
                : 'text-[#8899bb] hover:text-white hover:bg-[#1e2d4a]'
            }`}
          >
            {state}
          </button>
        ))}
      </div>
    </div>
  );
}
