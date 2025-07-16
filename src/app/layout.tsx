import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'QA ChatCanvas Backend API',
  description: 'Backend API for QA ChatCanvas Interactive System',
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