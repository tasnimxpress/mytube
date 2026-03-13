'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { initStorage, loadData, saveData, setupFileStorage, exportJSON, importJSON } from '@/lib/storage'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [data, setData] = useState(null)
  const [storageType, setStorageType] = useState(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const result = await initStorage()
      setData(result.data)
      setStorageType(result.storageType)
      setNeedsSetup(result.needsSetup)
      setIsLoading(false)
    }
    init()
  }, [])

  const persist = useCallback(async (newData) => {
    const saved = await saveData(newData, storageType)
    setData({ ...saved })
    return saved
  }, [storageType])

  const addCourse = useCallback(async (courseObj) => {
    const newData = { ...data, courses: [...(data.courses || []), courseObj] }
    return persist(newData)
  }, [data, persist])

  const deleteCourse = useCallback(async (courseId) => {
    const newData = { ...data, courses: data.courses.filter(c => c.id !== courseId) }
    return persist(newData)
  }, [data, persist])

  const markVideoWatched = useCallback(async (courseId, videoId, watched) => {
    const courses = data.courses.map(c => {
      if (c.id !== courseId) return c
      const watchedSet = new Set(c.progress?.watchedVideos || [])
      if (watched) watchedSet.add(videoId)
      else watchedSet.delete(videoId)
      const watchedVideos = Array.from(watchedSet)
      const percentage = Math.round((watchedVideos.length / c.videos.length) * 100)
      return {
        ...c,
        progress: {
          ...c.progress,
          watchedVideos,
          percentage,
          lastWatched: videoId,
          lastWatchedAt: new Date().toISOString(),
        }
      }
    })
    return persist({ ...data, courses })
  }, [data, persist])

  const setLastWatched = useCallback(async (courseId, videoId) => {
    const courses = data.courses.map(c => {
      if (c.id !== courseId) return c
      return { ...c, progress: { ...c.progress, lastWatched: videoId } }
    })
    return persist({ ...data, courses })
  }, [data, persist])

  const handleSetupFile = useCallback(async () => {
    const ok = await setupFileStorage()
    if (ok) setNeedsSetup(false)
    return ok
  }, [])

  const handleExport = useCallback(() => exportJSON(data), [data])

  const handleImport = useCallback(async (file) => {
    const imported = await importJSON(file)
    return persist(imported)
  }, [persist])

  const getCourse = useCallback((id) => {
    return data?.courses?.find(c => c.id === id) || null
  }, [data])

  return (
    <AppContext.Provider value={{
      data, isLoading, storageType, needsSetup,
      addCourse, deleteCourse, markVideoWatched, setLastWatched,
      getCourse,
      handleSetupFile, handleExport, handleImport,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
