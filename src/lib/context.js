'use client'
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, signInWithGoogle, signUpWithGoogle, signOut } from './supabase'
import { loadCourses, saveCourse, deleteCourse, updateProgress, rowToCourse } from './storage'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [courses, setCourses] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // ── Auth listener ───────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) fetchCourses(session.user.id)
      else setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) fetchCourses(session.user.id)
      else { setCourses([]); setIsLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchCourses(userId) {
    setIsLoading(true)
    try {
      const rows = await loadCourses(userId)
      setCourses(rows.map(rowToCourse))
    } catch (e) {
      console.error('Failed to load courses:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Course actions ──────────────────────────────────────────────────────────
  const addCourse = useCallback(async (course) => {
    await saveCourse(course, user.id)
    setCourses(prev => [course, ...prev])
  }, [user])

  const removeCourse = useCallback(async (courseId) => {
    await deleteCourse(courseId)
    setCourses(prev => prev.filter(c => c.id !== courseId))
  }, [])

  const markVideoWatched = useCallback(async (courseId, videoId, watched) => {
    setCourses(prev => prev.map(c => {
      if (c.id !== courseId) return c
      const watchedSet = new Set(c.progress.watchedVideos)
      if (watched) watchedSet.add(videoId)
      else watchedSet.delete(videoId)
      const watchedVideos = Array.from(watchedSet)
      const percentage = Math.round((watchedVideos.length / c.videos.length) * 100)
      const updated = {
        ...c,
        progress: { ...c.progress, watchedVideos, percentage, lastWatched: videoId }
      }
      updateProgress(courseId, user.id, updated.progress).catch(console.error)
      return updated
    }))
  }, [user])

  const setLastWatched = useCallback(async (courseId, videoId) => {
    setCourses(prev => prev.map(c => {
      if (c.id !== courseId) return c
      const updated = { ...c, progress: { ...c.progress, lastWatched: videoId } }
      updateProgress(courseId, user.id, updated.progress).catch(console.error)
      return updated
    }))
  }, [user])

  const getCourse = useCallback((id) => {
    return courses.find(c => c.id === id) || null
  }, [courses])

  return (
    <AppContext.Provider value={{
      user, courses, isLoading,
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