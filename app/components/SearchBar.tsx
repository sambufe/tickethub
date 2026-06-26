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

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[560px]">
      <div
        className="flex items-stretch bg-white rounded-[18px] border-[3px] border-chk-navy overflow-hidden"
        style={{ boxShadow: '6px 6px 0 #1A1A2E' }}
      >
        <label className="flex-1 flex flex-col gap-0.5 px-4 py-3 cursor-text" style={{ borderRight: '2px solid #EFE6C8' }}>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#9A8F66' }}>
            Artist or event
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search anything"
            className="border-none outline-none bg-transparent font-semibold text-[15px] text-chk-navy placeholder:font-normal placeholder:text-slate-400"
          />
        </label>
        <button
          type="submit"
          className="m-1.5 px-6 bg-chk-orange text-white border-[2.5px] border-chk-navy rounded-[12px] font-baloo font-bold text-base whitespace-nowrap hover:opacity-90 transition-opacity"
        >
          Find tickets
        </button>
      </div>
    </form>
  );
}
