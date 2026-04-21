'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, signInWithGoogle, signUpWithGoogle, signOut } from './supabase'
import { loadCourses, saveCourse, deleteCourse, updateProgress, rowToCourse } from './storage'
import { deleteFolderHandle } from './localCourse'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [courses, setCourses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) fetchCourses()
      else setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) fetchCourses()
      else { setCourses([]); setIsLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchCourses() {
    setIsLoading(true)
    try {
      const rows = await loadCourses()
      setCourses(rows.map(rowToCourse))
    } catch (e) {
      console.error('Failed to load courses:', e)
    } finally {
      setIsLoading(false)
    }
  }

  const addCourse = useCallback(async (course) => {
    if (!user) return
    await saveCourse(course)
    setCourses(prev => [course, ...prev])
  }, [user])

  const removeCourse = useCallback(async (courseId) => {
    if (!user) return
    await deleteCourse(courseId)
    await deleteFolderHandle(courseId).catch(() => { })
    setCourses(prev => prev.filter(c => c.id !== courseId))
  }, [user])

  const markVideoWatched = useCallback(async (courseId, videoId, watched) => {
    if (!user) return
    setSaveError(null)
    setCourses(prev => prev.map(c => {
      if (c.id !== courseId) return c
      const watchedSet = new Set(c.progress.watchedVideos)
      if (watched) watchedSet.add(videoId)
      else watchedSet.delete(videoId)
      const watchedVideos = Array.from(watchedSet)
      const total = c.videos.length
      const percentage = total > 0 ? Math.round((watchedVideos.length / total) * 100) : 0
      const updated = {
        ...c,
        progress: { ...c.progress, watchedVideos, percentage, lastWatched: videoId }
      }
      updateProgress(courseId, updated.progress).catch(err => {
        console.error('Progress save failed:', err)
        setSaveError('Progress could not be saved. Check your connection.')
      })
      return updated
    }))
  }, [user])

  const setLastWatched = useCallback(async (courseId, videoId) => {
    if (!user) return
    setCourses(prev => prev.map(c => {
      if (c.id !== courseId) return c
      const updated = { ...c, progress: { ...c.progress, lastWatched: videoId } }
      updateProgress(courseId, updated.progress).catch(err => {
        console.error('Progress save failed:', err)
      })
      return updated
    }))
  }, [user])

  const getCourse = useCallback((id) => {
    return courses.find(c => c.id === id) || null
  }, [courses])

  return (
    <AppContext.Provider value={{
      user, courses, isLoading, saveError, setSaveError,
      signInWithGoogle, signUpWithGoogle, signOut,
      addCourse, removeCourse, markVideoWatched, setLastWatched, getCourse,
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
