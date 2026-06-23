'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';

const AddEventsTab = dynamic(() => import('./components/AddEventsTab'), { ssr: false });
const DashboardTab = dynamic(() => import('./components/DashboardTab'), { ssr: false });
const EventCatalogTab = dynamic(() => import('./components/EventCatalogTab'), { ssr: false });
const ManualAddTab = dynamic(() => import('./components/ManualAddTab'), { ssr: false });

type Tab = 'dashboard' | 'catalog' | 'add' | 'manual';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'catalog', label: 'Event Catalog' },
  { id: 'add', label: 'Add Events' },
  { id: 'manual', label: 'Manual Add' },
];

const STORAGE_KEY = 'tickethub_admin_auth';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('add');
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      setPassword(stored);
      setAuthed(true);
    }
    setHydrated(true);
  }, []);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPwLoading(true);
    setPwError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwInput }),
      });
      const data = await res.json();

      if (data.ok) {
        sessionStorage.setItem(STORAGE_KEY, pwInput);
        setPassword(pwInput);
        setAuthed(true);
      } else {
        setPwError(data.error || 'Incorrect password.');
      }
    } catch {
      setPwError('Could not reach the server. Is the dev server running?');
    } finally {
      setPwLoading(false);
    }
  }, [pwInput]);

  const handleSignOut = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setAuthed(false);
    setPassword('');
    setPwInput('');
  };

  if (!hydrated) return null;

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="text-4xl">🎟</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-3">TicketHub Admin</h1>
            <p className="text-sm text-slate-500 mt-1">Enter your admin password to continue</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div>
              <label htmlFor="pw" className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                id="pw"
                type="password"
                value={pwInput}
                onChange={(e) => { setPwInput(e.target.value); setPwError(''); }}
                placeholder="Admin password"
                autoFocus
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {pwError && (
                <p className="mt-1.5 text-xs text-red-600">{pwError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pwLoading || !pwInput}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors"
            >
              {pwLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-4">
            Set your password in <code className="font-mono bg-slate-100 px-1 rounded">.env.local</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">🎟</span>
          <span className="font-semibold text-lg">TicketHub Admin</span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Tab nav */}
      <nav className="bg-white border-b border-slate-200 px-6">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && <DashboardTab password={password} />}
        {activeTab === 'catalog' && <EventCatalogTab password={password} />}
        {activeTab === 'add' && <AddEventsTab password={password} />}
        {activeTab === 'manual' && <ManualAddTab password={password} />}
      </main>
    </div>
  );
}
