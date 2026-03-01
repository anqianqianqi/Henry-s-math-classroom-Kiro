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
      <body>{children}</body>
    </html>
  )
}
