// PostHog singleton — only import this from 'use client' components.
// Initialized via PostHogProvider in app/layout.tsx; safe to call capture()
// anywhere after that without re-initializing.
import posthog from 'posthog-js';
export { posthog };
