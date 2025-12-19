import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PromptStudio - AI Prompt Engineering Platform',
  description: 'Design, test, and deploy AI prompts with SDK auto-generation and cloud deployment',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-dark-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
