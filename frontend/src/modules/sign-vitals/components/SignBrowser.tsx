import { Search } from 'lucide-react'
import { useState } from 'react'
import type { GlossSign } from '../types/gloss'

interface SignBrowserProps {
  signs: GlossSign[]
  onSelect: (signId: string) => void
}

export default function SignBrowser({ signs, onSelect }: SignBrowserProps) {
  const [query, setQuery] = useState('')

  const filtered = signs.filter((sign) =>
    sign.display_name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search signs…"
          className="w-full rounded-[var(--radius-md)] border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand-blue)]"
        />
      </div>
      <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {filtered.map((sign) => (
          <button
            key={sign.id}
            type="button"
            onClick={() => onSelect(sign.id)}
            className="rounded-[var(--radius-md)] border border-slate-200 px-3 py-2 text-left text-sm capitalize text-slate-700 transition hover:border-[var(--brand-blue)] hover:bg-blue-50"
          >
            {sign.display_name}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full py-4 text-center text-sm text-slate-400">No signs match your search.</p>
        )}
      </div>
    </div>
  )
}
