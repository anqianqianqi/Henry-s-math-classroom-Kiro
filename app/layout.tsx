import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "Henry's Math Classroom",
  description: 'Math learning platform for students and parents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <body className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">{children}</body>
    </html>
  )
}
