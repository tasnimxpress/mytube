'use client'
import { AppProvider } from '@/lib/context'

export default function Providers({ children }) {
    return <AppProvider>{children}</AppProvider>
}