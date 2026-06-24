'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { DashboardStats, CoverageEntry, CacheStats, AlertStats } from '@/app/api/admin/dashboard/route';
import type { PlatformStatus } from '@/app/api/admin/platform-status/route';

interface Props {
  password: string;
}

interface DashboardData {
  stats: DashboardStats;
  coverage: CoverageEntry[];
  cache: CacheStats;
  alerts: AlertStats;
}

export default function DashboardTab({ password }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [platformStatuses, setPlatformStatuses] = useState<PlatformStatus[] | null>(null);
  const [platformCheckedAt, setPlatformCheckedAt] = useState<Date | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  // Alert check state
  const [alertChecking, setAlertChecking] = useState(false);
  const [alertCheckResult, setAlertCheckResult] = useState<{ checked: number; notified: number } | null>(null);

  // Browser restart state
  const [browserRestarting, setBrowserRestarting] = useState(false);
  const [browserMsg, setBrowserMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const browserMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SeatGeek cookie state
  const [sgCookieSet, setSgCookieSet] = useState<boolean | null>(null);
  const [sgCookieInput, setSgCookieInput] = useState('');
  const [sgCookieSaving, setSgCookieSaving] = useState(false);
  const [sgCookieMsg, setSgCookieMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sgMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadCookieStatus = useCallback(() => {
    fetch('/api/admin/config', { headers: { 'x-admin-password': password } })
      .then((r) => r.json())
      .then((d: { seatgeekCookieSet?: boolean }) => setSgCookieSet(d.seatgeekCookieSet ?? false))
      .catch(() => setSgCookieSet(false));
  }, [password]);

  useEffect(() => { loadData(); loadCookieStatus(); }, [loadData, loadCookieStatus]);

  const restartBrowser = () => {
    setBrowserRestarting(true);
    setBrowserMsg(null);
    fetch('/api/admin/cleanup', {
      method: 'POST',
      headers: { 'x-admin-password': password },
    })
      .then((r) => r.json())
      .then((d: { ok?: boolean; error?: string }) => {
        setBrowserMsg(d.ok
          ? { ok: true, text: 'Browser restarted.' }
          : { ok: false, text: d.error ?? 'Restart failed' }
        );
      })
      .catch(() => setBrowserMsg({ ok: false, text: 'Network error' }))
      .finally(() => {
        setBrowserRestarting(false);
        if (browserMsgTimer.current) clearTimeout(browserMsgTimer.current);
        browserMsgTimer.current = setTimeout(() => setBrowserMsg(null), 5000);
      });
  };

  const runAlertCheck = () => {
    setAlertChecking(true);
    setAlertCheckResult(null);
    fetch('/api/alerts/check', {
      method: 'POST',
      headers: { Authorization: `Bearer ${password}` },
    })
      .then((r) => r.json())
      .then((d: { checked?: number; notified?: number; error?: string }) => {
        if (d.checked !== undefined) setAlertCheckResult({ checked: d.checked, notified: d.notified ?? 0 });
      })
      .catch(() => {})
      .finally(() => setAlertChecking(false));
  };

  const saveSgCookie = () => {
    if (!sgCookieInput.trim()) return;
    setSgCookieSaving(true);
    setSgCookieMsg(null);
    fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'x-admin-password': password, 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'SEATGEEK_DATADOME_COOKIE', value: sgCookieInput.trim() }),
    })
      .then((r) => r.json())
      .then((d: { ok?: boolean; error?: string }) => {
        if (d.ok) {
          setSgCookieSet(true);
          setSgCookieInput('');
          setSgCookieMsg({ ok: true, text: 'Cookie saved. Restart the server to pick up the new value.' });
        } else {
          setSgCookieMsg({ ok: false, text: d.error ?? 'Save failed' });
        }
      })
      .catch(() => setSgCookieMsg({ ok: false, text: 'Network error' }))
      .finally(() => {
        setSgCookieSaving(false);
        if (sgMsgTimer.current) clearTimeout(sgMsgTimer.current);
        sgMsgTimer.current = setTimeout(() => setSgCookieMsg(null), 6000);
      });
  };

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

  const { stats, coverage, cache, alerts } = data;

  return (
    <div className="space-y-6">
      {/* SeatGeek Cookie */}
      <Section
        title="SeatGeek Cookie"
        subtitle="DataDome cookie required for the SeatGeek scraper. Expires after ~7 days."
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {sgCookieSet === null ? (
              <span className="text-slate-400 text-xs">Checking…</span>
            ) : sgCookieSet ? (
              <>
                <span className="text-green-600">✅</span>
                <span className="text-slate-700 font-medium">Configured</span>
              </>
            ) : (
              <>
                <span className="text-red-500">❌</span>
                <span className="text-slate-700 font-medium">Not set</span>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              value={sgCookieInput}
              onChange={(e) => setSgCookieInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveSgCookie()}
              placeholder="Paste datadome cookie value…"
              className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={saveSgCookie}
              disabled={sgCookieSaving || !sgCookieInput.trim()}
              className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {sgCookieSaving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {sgCookieMsg && (
            <p className={`text-xs ${sgCookieMsg.ok ? 'text-green-700' : 'text-red-600'}`}>
              {sgCookieMsg.text}
            </p>
          )}

          <p className="text-xs text-slate-400">
            Cookie expires after 7 days. Refresh: open SeatGeek.com in Chrome → solve CAPTCHA if shown →
            DevTools → Application → Cookies → seatgeek.com → copy the <code className="font-mono">datadome</code> value.
          </p>
        </div>
      </Section>

      {/* Platform Health */}
      <Section
        title="Platform Health"
        action={
          <div className="flex items-center gap-3">
            {browserMsg && (
              <span className={`text-xs ${browserMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
                {browserMsg.text}
              </span>
            )}
            <button
              onClick={restartBrowser}
              disabled={browserRestarting}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:text-slate-300 transition-colors"
            >
              {browserRestarting ? 'Restarting…' : 'Restart browser'}
            </button>
            <button
              onClick={checkPlatforms}
              disabled={statusLoading}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:text-slate-300 transition-colors"
            >
              {statusLoading ? 'Checking…' : platformStatuses ? 'Refresh' : 'Check now'}
            </button>
          </div>
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

      {/* Price Alerts */}
      <Section
        title="Price Alerts"
        action={
          <div className="flex items-center gap-3">
            {alertCheckResult && (
              <span className="text-xs text-slate-500">
                Checked {alertCheckResult.checked}, sent {alertCheckResult.notified}
              </span>
            )}
            <button
              onClick={runAlertCheck}
              disabled={alertChecking}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:text-slate-300 transition-colors"
            >
              {alertChecking ? 'Checking…' : 'Run Alert Check'}
            </button>
          </div>
        }
      >
        <div className="mb-4">
          <StatTile label="Active Alerts" value={alerts?.totalActive ?? 0} color={alerts?.totalActive > 0 ? 'indigo' : undefined} />
        </div>
        {alerts?.byEvent?.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-100">
                <th className="pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Event</th>
                <th className="pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Alerts</th>
                <th className="pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Lowest Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {alerts.byEvent.map((row) => (
                <tr key={row.event_title}>
                  <td className="py-2 text-slate-700 text-sm">{row.event_title}</td>
                  <td className="py-2 text-slate-600 text-sm text-right">{row.active_count}</td>
                  <td className="py-2 text-slate-600 text-sm text-right">${Math.ceil(row.min_target)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">No active alerts.</p>
        )}
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
