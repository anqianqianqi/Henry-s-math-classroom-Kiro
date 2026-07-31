import type { Metadata } from 'next'
import './globals.css'
import DesktopPetWrapper from '@/components/desktop-pet/DesktopPetWrapper'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Henry's Math Classroom",
  description: 'Math learning platform for students and parents',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: "Henry's Math Classroom",
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <body className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Provider and switcher live here so the control exists on every page.
            PageHeader would have covered only 16 of 36. */}
        <LanguageProvider>
          {children}
          <LanguageSwitcher />
          <DesktopPetWrapper />
        </LanguageProvider>
      </body>
    </html>
  )
}
