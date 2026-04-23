import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ModernBackground } from '@/components/ModernBackground'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ScrumPokr',
  description: 'Real-time planning poker for agile teams',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)})()`,
          }}
        />
      </head>
      <body className={`${inter.className} text-slate-900 dark:text-white antialiased`}>
        <ThemeProvider>
          <ModernBackground />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
