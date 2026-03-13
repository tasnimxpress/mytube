import './globals.css'
import Providers from '@/components/Providers'

export const metadata = {
  title: 'MyTube · FocusLearn',
  description: 'Watch YouTube playlists like a focused course. No distractions.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}