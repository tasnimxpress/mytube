// FocusLearn Storage Layer
// Primary: File System Access API (Chrome/Edge) — saves focuslearn-data.json to user's chosen folder
// Fallback: IndexedDB — for Firefox/Safari

const DB_NAME = 'focuslearn'
const DB_VERSION = 1
const STORE_NAME = 'data'
const DATA_KEY = 'appData'
const FILE_NAME = 'focuslearn-data.json'

// ─── Default data shape ───────────────────────────────────────────────────────
export function defaultData() {
  return {
    version: 1,
    courses: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ─── File System Access API ───────────────────────────────────────────────────
let _fileHandle = null // remembered for the session
const FS_HANDLE_KEY = 'focuslearn_fs_handle'

export async function isFileSystemSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

// Try to restore file handle from IndexedDB (handles survive page reload via IndexedDB)
async function restoreFileHandle() {
  try {
    const db = await openIDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const result = await idbGet(store, 'fileHandle')
    if (result) {
      // Verify permission
      const perm = await result.queryPermission({ mode: 'readwrite' })
      if (perm === 'granted') {
        _fileHandle = result
        return true
      }
      const req = await result.requestPermission({ mode: 'readwrite' })
      if (req === 'granted') {
        _fileHandle = result
        return true
      }
    }
  } catch (e) {}
  return false
}

async function saveFileHandle(handle) {
  try {
    const db = await openIDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    await idbPut(store, 'fileHandle', handle)
  } catch (e) {}
}

export async function pickSaveFolder() {
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' })
    _fileHandle = await dirHandle.getFileHandle(FILE_NAME, { create: true })
    await saveFileHandle(_fileHandle)
    return true
  } catch (e) {
    return false
  }
}

async function readFromFile() {
  try {
    if (!_fileHandle) return null
    const file = await _fileHandle.getFile()
    const text = await file.text()
    if (!text.trim()) return null
    return JSON.parse(text)
  } catch (e) {
    return null
  }
}

async function writeToFile(data) {
  try {
    if (!_fileHandle) return false
    const writable = await _fileHandle.createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
    return true
  } catch (e) {
    return false
  }
}

// ─── IndexedDB fallback ───────────────────────────────────────────────────────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet(store, key) {
  return new Promise((resolve, reject) => {
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(store, key, value) {
  return new Promise((resolve, reject) => {
    const req = store.put(value, key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function readFromIDB() {
  try {
    const db = await openIDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    return await idbGet(store, DATA_KEY)
  } catch (e) {
    return null
  }
}

async function writeToIDB(data) {
  try {
    const db = await openIDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    await idbPut(store, DATA_KEY, data)
    return true
  } catch (e) {
    return false
  }
}

// ─── Unified API ─────────────────────────────────────────────────────────────

export async function initStorage() {
  const fsSupported = await isFileSystemSupported()
  if (fsSupported) {
    const restored = await restoreFileHandle()
    if (restored) {
      const data = await readFromFile()
      if (data) return { data, storageType: 'file', needsSetup: false }
      // File exists but empty — init it
      const fresh = defaultData()
      await writeToFile(fresh)
      return { data: fresh, storageType: 'file', needsSetup: false }
    }
    // Has FS support but no handle yet — needs setup
    return { data: defaultData(), storageType: 'file', needsSetup: true }
  }
  // Fallback to IndexedDB
  const data = (await readFromIDB()) || defaultData()
  return { data, storageType: 'idb', needsSetup: false }
}

export async function loadData(storageType) {
  if (storageType === 'file') {
    return (await readFromFile()) || defaultData()
  }
  return (await readFromIDB()) || defaultData()
}

export async function saveData(data, storageType) {
  data.updatedAt = new Date().toISOString()
  if (storageType === 'file') {
    await writeToFile(data)
    // Also mirror to IDB as backup
    await writeToIDB(data)
  } else {
    await writeToIDB(data)
  }
  return data
}

export async function setupFileStorage() {
  const picked = await pickSaveFolder()
  if (!picked) return false
  // After picking, write current IDB data (or fresh) to file
  const idbData = (await readFromIDB()) || defaultData()
  await writeToFile(idbData)
  return true
}

export async function exportJSON(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = FILE_NAME
  a.click()
  URL.revokeObjectURL(url)
}

export async function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target.result))
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
