import './globals.css'
import { AppProvider } from '@/lib/context'

export const metadata = {
  title: 'MyTube · FocusLearn',
  description: 'Watch YouTube playlists like a focused course. No recommendations. No distractions.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  )
}