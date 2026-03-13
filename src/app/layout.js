import './globals.css'

export const metadata = {
  title: 'MyTube · FocusLearn',
  description: 'Watch YouTube playlists like a focused course. No recommendations. No distractions.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
