import './globals.css'

export const metadata = {
  title: 'Next.js security mapping',
  description: 'Topic 08 — how the browser-security lessons map onto Next.js App Router',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
