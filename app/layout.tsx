import type { Metadata } from "next";
import { Baloo_2, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import PostHogProvider from '@/app/components/PostHogProvider';

const baloo2 = Baloo_2({
  weight: ['600', '700', '800'],
  variable: '--font-baloo-2',
  subsets: ['latin'],
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "chickets — find the cheapest seat",
  description: "Compare concert ticket prices across every major platform at once.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${baloo2.variable} ${plusJakarta.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
