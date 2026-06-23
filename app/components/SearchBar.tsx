'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') || '');

  useEffect(() => {
    setValue(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : '/');
  };

  const handleClear = () => {
    setValue('');
    router.push('/');
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-2xl mx-auto">
      <div className="relative flex items-center">
        <svg
          className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search artists, events, venues, cities…"
          className="w-full pl-12 pr-28 py-4 rounded-2xl border-0 shadow-lg text-slate-900 placeholder-slate-400 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-24 text-slate-400 hover:text-slate-600 p-1"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          className="absolute right-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
        >
          Search
        </button>
      </div>
    </form>
  );
}
