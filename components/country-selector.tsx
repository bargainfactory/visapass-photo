'use client';

import * as React from 'react';
import { Check, ChevronRight, Search } from 'lucide-react';
import { COUNTRIES, type CountrySpec, type DocumentSpec, midpoint } from '@/lib/countries';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CountrySelectorProps {
  selectedDocId: string | null;
  onSelect: (country: CountrySpec, doc: DocumentSpec) => void;
}

export function CountrySelector({ selectedDocId, onSelect }: CountrySelectorProps) {
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.documents.some((d) => d.label.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search 20+ countries — passport, visa, ID…"
          className="pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search countries"
        />
      </div>
      <ScrollArea className="h-[420px] rounded-xl border bg-card/40">
        <ul className="divide-y">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matches — try “Schengen”, “India”, or “2x2”.
            </li>
          )}
          {filtered.map((country) => (
            <li key={country.code} className="px-1 py-1">
              <div className="flex items-center gap-2 px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="text-lg leading-none">{country.flag}</span>
                {country.name}
                <span className="text-[10px] text-muted-foreground/70">{country.code}</span>
              </div>
              <div className="grid gap-1 px-1 py-1">
                {country.documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => onSelect(country, doc)}
                    className={cn(
                      'group flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-all',
                      selectedDocId === doc.id
                        ? 'bg-brand-500/10 ring-1 ring-brand-500/30'
                        : 'hover:bg-accent'
                    )}
                    aria-pressed={selectedDocId === doc.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.label}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {doc.widthMm}×{doc.heightMm} mm · head {(midpoint(doc.headHeightRatio) * 100).toFixed(0)}% ·
                        bg {doc.background}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={doc.type === 'visa' ? 'warning' : 'brand'} className="capitalize">
                        {doc.type.replace('_', ' ')}
                      </Badge>
                      {selectedDocId === doc.id ? (
                        <Check className="size-4 text-brand-600" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
