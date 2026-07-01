'use client';

import { useState } from 'react';

interface Props {
  password: string;
}

export default function ManualAddTab({ password }: Props) {
  const [form, setForm] = useState({
    title: '',
    artist: '',
    venue: '',
    city: '',
    state: 'CA',
    event_date: '',
    image_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Event title is required.');
      return;
    }

    setSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`"${form.title}" added to the platform.`);
        setForm({ title: '', artist: '', venue: '', city: '', state: 'CA', event_date: '', image_url: '' });
      } else {
        setError(data.error || 'Failed to add event.');
      }
    } catch {
      setError('Network error while adding event.');
    } finally {
      setSubmitting(false);
    }
  };

  const US_STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
    'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
    'VA','WA','WV','WI','WY',
  ];

  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-5">Add Event Manually</h2>

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            ✗ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Event Title *" htmlFor="title">
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Taylor Swift — The Eras Tour"
              className={inputCls}
            />
          </Field>

          <Field label="Artist / Headliner" htmlFor="artist">
            <input
              id="artist"
              type="text"
              value={form.artist}
              onChange={(e) => set('artist', e.target.value)}
              placeholder="e.g. Taylor Swift"
              className={inputCls}
            />
          </Field>

          <Field label="Venue" htmlFor="venue">
            <input
              id="venue"
              type="text"
              value={form.venue}
              onChange={(e) => set('venue', e.target.value)}
              placeholder="e.g. SoFi Stadium"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="City" htmlFor="city">
              <input
                id="city"
                type="text"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="e.g. Inglewood"
                className={inputCls}
              />
            </Field>

            <Field label="State" htmlFor="state">
              <select
                id="state"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                className={inputCls}
              >
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Event Date & Time" htmlFor="event_date">
            <input
              id="event_date"
              type="datetime-local"
              value={form.event_date}
              onChange={(e) => set('event_date', e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Image URL (optional)" htmlFor="image_url">
            <input
              id="image_url"
              type="url"
              value={form.image_url}
              onChange={(e) => set('image_url', e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors mt-2"
          >
            {submitting ? 'Adding…' : 'Add to Platform'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
