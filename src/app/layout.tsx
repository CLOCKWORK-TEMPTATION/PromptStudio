import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'PromptStudio - منصة هندسة الـ Prompts بالذكاء الاصطناعي',
  description: 'صمم، اختبر، وانشر الـ Prompts بتوليد SDK تلقائي ونشر سحابي',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${inter.className} bg-dark-950 text-white antialiased dark`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
