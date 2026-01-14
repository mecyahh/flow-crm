import './globals.css'

export const metadata = {
  title: 'Flow',
  description: 'Everything is flowing.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
