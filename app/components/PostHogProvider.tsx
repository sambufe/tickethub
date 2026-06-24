'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || key === 'your_key_here') return;
    posthog.init(key, {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
    });
  }, []);

  return <>{children}</>;
}
