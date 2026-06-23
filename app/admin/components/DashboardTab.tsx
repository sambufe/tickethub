'use client';

import { useEffect, useState, useCallback } from 'react';
import type { DashboardStats, CoverageEntry, CacheStats } from '@/app/api/admin/dashboard/route';
import type { PlatformStatus } from '@/app/api/admin/platform-status/route';

interface Props {
  password: string;
}

interface DashboardData {
  stats: DashboardStats;
  coverage: CoverageEntry[];
  cache: CacheStats;
}

export default function DashboardTab({ password }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[] | null>(null);
  const [platformCheckedAt, setPlatformCheckedAt] = useState<Date | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadData = useCallback(() => {
    setDataError(null);
    fetch('/api/admin/dashboard', { headers: { 'x-admin-password': password } })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setDataError(d.error);
        else setData(d as DashboardData);
      })
      .catch(() => setDataError('Failed to load dashboard data.'));
  }, [password]);

  useEffect(() => { loadData(); }, [loadData]);

  const checkPlatforms = () => {
    setStatusLoading(true);
    setPlatformStatuses(null);
    fetch('/api/admin/platform-status', { headers: { 'x-admin-password': password } })
      .then((r) => r.json())
      .then((d) => {
        setPlatformStatuses(d.statuses ?? []);
        setPlatformCheckedAt(new Date());
      })
      .catch(() => setPlatformStatuses([]))
      .finally(() => setStatusLoading(false));
  };

  if (dataError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {dataError}
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-slate-400 py-8 text-center">Loading…</div>;
  }

  const { stats, coverage, cache } = data;

  return (
    <div className="space-y-6">
      {/* Platform Health */}
      <Section
        title="Platform Health"
        action={
          <button
            onClick={checkPlatforms}
            disabled={statusLoading}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:text-slate-300 transition-colors"
          >
            {statusLoading ? 'Checking…' : platformStatuses ? 'Refresh' : 'Check now'}
          </button>
        }
      >
        {!platformStatuses && !statusLoading && (
          <p className="text-sm text-slate-400 text-center py-3">
            Click &ldquo;Check now&rdquo; to verify all platform connections.
          </p>
        )}
        {statusLoading && <Spinner />}
        {platformStatuses && (
          <>
            <div className="divide-y divide-slate-100">
              {platformStatuses.map((p) => (
                <div key={p.platform} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <StatusIcon status={p.status === 'ok' ? 'ok' : p.status === 'unconfigured' ? 'warn' : 'error'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{p.platform}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        p.type === 'api' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {p.type === 'api' ? 'API' : 'Scraper'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{p.message}</p>
                  </div>
                </div>
              ))}
            </div>
            {platformCheckedAt && (
              <p className="text-xs text-slate-400 mt-3">
                Last checked: {platformCheckedAt.toLocaleTimeString()}
              </p>
            )}
          </>
        )}
      </Section>

      {/* Event Stats */}
      <Section title="Event Catalog">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatTile label="Total Events" value={stats.total} />
          <StatTile label="Active" value={stats.active} color="green" />
          <StatTile label="Inactive" value={stats.inactive} color={stats.inactive > 0 ? 'amber' : undefined} />
          <StatTile label="Next 30 Days" value={stats.upcoming30d} color="indigo" />
        </div>

        {Object.keys(stats.byRegion).length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Active Events by Region</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byRegion)
                .sort((a, b) => b[1] - a[1])
                .map(([region, count]) => (
                  <span
                    key={region}
                    className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1"
                  >
                    <span className="font-semibold">{count}</span>
                    <span>{region}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </Section>

      {/* Platform Coverage */}
      <Section title="Platform Coverage" subtitle="How many events have a URL linked per platform">
        <div className="space-y-2">
          {coverage.map((c) => {
            const pct = c.total > 0 ? (c.linked / c.total) * 100 : 0;
            return (
              <div key={c.key} className="flex items-center gap-3">
                <span className="text-sm text-slate-700 w-28 flex-shrink-0">{c.platform}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      pct === 100 ? 'bg-green-400' : pct > 50 ? 'bg-indigo-400' : pct > 0 ? 'bg-amber-400' : 'bg-slate-200'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 w-16 text-right flex-shrink-0">
                  {c.linked} / {c.total}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Cache Stats */}
      <Section title="Ticket Cache">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Active Events" value={cache.totalActive} />
          <StatTile label="Fresh (< 1 hr)" value={cache.fresh} color="green" />
          <StatTile label="Stale (≥ 1 hr)" value={cache.stale} color={cache.stale > 0 ? 'amber' : undefined} />
          <StatTile label="No Cache" value={cache.none} color={cache.none > 0 ? 'slate' : undefined} />
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Cache is populated when users load an event page. Stale or missing cache is refreshed automatically on next page load.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'green' | 'amber' | 'indigo' | 'slate';
}) {
  const numClass =
    color === 'green' ? 'text-green-600' :
    color === 'amber' ? 'text-amber-600' :
    color === 'indigo' ? 'text-indigo-600' :
    color === 'slate' ? 'text-slate-400' :
    'text-slate-900';

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${numClass}`}>{value}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: 'ok' | 'warn' | 'error' }) {
  if (status === 'ok') return <span className="text-green-500 text-base w-5 flex-shrink-0">✅</span>;
  if (status === 'warn') return <span className="text-amber-500 text-base w-5 flex-shrink-0">⚠️</span>;
  return <span className="text-red-500 text-base w-5 flex-shrink-0">❌</span>;
}

function Spinner() {
  return (
    <div className="flex justify-center py-4">
      <svg className="animate-spin h-5 w-5 text-indigo-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
    </div>
  );
}
