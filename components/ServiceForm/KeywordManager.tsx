'use client';

import { useState } from 'react';

interface KeywordManagerProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
  serviceName?: string;
  serviceDescription?: string;
}

export default function KeywordManager({ keywords, onChange, serviceName, serviceDescription }: KeywordManagerProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  function add(kw?: string) {
    const value = (kw ?? input).trim().toLowerCase();
    if (value && !keywords.includes(value)) {
      onChange([...keywords, value]);
    }
    if (!kw) setInput('');
  }

  function addSuggestion(kw: string) {
    if (!keywords.includes(kw)) onChange([...keywords, kw]);
    setSuggestions(prev => prev.filter(s => s !== kw));
  }

  function addAllSuggestions() {
    const toAdd = suggestions.filter(s => !keywords.includes(s));
    onChange([...keywords, ...toAdd]);
    setSuggestions([]);
  }

  async function handleAiSuggest() {
    if (!serviceName?.trim()) {
      setSuggestError('Enter a service name first.');
      return;
    }
    setLoadingSuggest(true);
    setSuggestError('');
    setSuggestions([]);
    try {
      const res = await fetch('/api/suggest-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: serviceName, description: serviceDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      // Filter out already-added keywords
      setSuggestions((data.keywords as string[]).filter(k => !keywords.includes(k)));
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : 'AI suggest failed');
    } finally {
      setLoadingSuggest(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm text-[#8899bb]">Keywords</label>
        <button
          type="button"
          onClick={handleAiSuggest}
          disabled={loadingSuggest}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-[#1a1040] border border-[#4a2d8c] text-[#a78bfa] hover:bg-[#2d1a6e] hover:text-white disabled:opacity-50 transition-colors"
        >
          {loadingSuggest ? (
            <>
              <div className="w-3 h-3 border border-[#a78bfa] border-t-transparent rounded-full animate-spin" />
              Analyzing…
            </>
          ) : (
            <>✦ AI Suggest</>
          )}
        </button>
      </div>

      {suggestError && (
        <p className="text-red-400 text-xs mb-2">{suggestError}</p>
      )}

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-3 p-3 rounded-xl bg-[#0e0a1f] border border-[#4a2d8c]/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#a78bfa] font-medium">✦ AI suggested keywords for your customers</span>
            <button
              type="button"
              onClick={addAllSuggestions}
              className="text-xs px-2 py-0.5 rounded-md bg-[#4a2d8c]/40 text-[#a78bfa] hover:bg-[#4a2d8c] hover:text-white transition-colors"
            >
              Add all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map(kw => (
              <button
                key={kw}
                type="button"
                onClick={() => addSuggestion(kw)}
                className="flex items-center gap-1 bg-[#1a1040] border border-[#4a2d8c]/60 text-[#c4b5fd] text-xs px-2.5 py-1 rounded-full hover:bg-[#2d1a6e] hover:border-[#a78bfa] hover:text-white transition-colors"
              >
                + {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual input */}
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          className="flex-1 bg-[#162035] border border-[#1e2d4a] rounded-lg px-3 py-2 text-[#e8edf5] focus:outline-none focus:border-[#2563eb] text-sm"
          placeholder="e.g. office cleaning, janitorial"
        />
        <button
          type="button"
          onClick={() => add()}
          className="bg-[#162035] border border-[#1e2d4a] hover:border-[#2563eb] text-[#8899bb] hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
        >
          Add
        </button>
      </div>

      {/* Added keywords */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map(kw => (
            <span key={kw} className="flex items-center gap-1 bg-[#1a4b8c]/30 border border-[#1a4b8c] text-[#2563eb] text-xs px-2.5 py-1 rounded-full">
              {kw}
              <button
                type="button"
                onClick={() => onChange(keywords.filter(k => k !== kw))}
                className="text-[#2563eb] hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
