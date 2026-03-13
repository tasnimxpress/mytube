// ── Local Course Reader ────────────────────────────────────────────────────────
// Uses File System Access API (Chrome/Edge/Brave only)
// Files never leave the user's machine — only FileSystemFileHandle references
// are stored in IndexedDB. No files are uploaded anywhere.

const VIDEO_TYPES = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']
const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
const TEXT_TYPES = ['txt', 'md', 'markdown']
const PDF_TYPES = ['pdf']
const HTML_TYPES = ['html', 'htm']

export function getFileType(name) {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (VIDEO_TYPES.includes(ext)) return 'video'
    if (IMAGE_TYPES.includes(ext)) return 'image'
    if (TEXT_TYPES.includes(ext)) return 'text'
    if (PDF_TYPES.includes(ext)) return 'pdf'
    if (HTML_TYPES.includes(ext)) return 'html'
    return 'other'
}

export function getFileIcon(fileType) {
    switch (fileType) {
        case 'video': return '▶'
        case 'image': return '🖼'
        case 'pdf': return '📄'
        case 'text': return '📝'
        case 'html': return '🌐'
        default: return '📎'
    }
}

// Read a directory handle recursively, returning sections
// Each subfolder becomes a section, top-level files go in a null-titled section
async function readDirectory(dirHandle, depth = 0) {
    const topItems = []
    const sections = []

    const entries = []
    for await (const entry of dirHandle.values()) {
        entries.push(entry)
    }

    for (const entry of entries) {
        if (entry.kind === 'file') {
            // Skip hidden files
            if (entry.name.startsWith('.')) continue
            const fileType = getFileType(entry.name)
            topItems.push({
                id: `${dirHandle.name}__${entry.name}__${Date.now()}__${Math.random()}`,
                name: entry.name.replace(/\.[^/.]+$/, ''), // strip extension for display
                fullName: entry.name,
                fileType,
                handle: entry, // FileSystemFileHandle — stays local
            })
        } else if (entry.kind === 'directory' && depth < 2) {
            // Subfolder = section (max 2 levels deep)
            if (entry.name.startsWith('.')) continue
            const subItems = await readDirectory(entry, depth + 1)
            if (subItems.length > 0) {
                sections.push({
                    title: entry.name,
                    items: subItems,
                })
            }
        }
    }

    if (depth > 0) {
        // When called recursively, just return flat items + sub-section items
        const all = [...topItems]
        for (const s of sections) all.push(...s.items)
        return all
    }

    // Top level: build sections array
    const result = []
    if (topItems.length > 0) {
        result.push({ title: null, items: topItems })
    }
    result.push(...sections)
    return result
}

// Main function: open folder picker and build course object
export async function addLocalCourse(generateCourseId) {
    // Check browser support
    if (!window.showDirectoryPicker) {
        throw new Error('Your browser does not support local folders. Please use Chrome, Edge, or Brave.')
    }

    let dirHandle
    try {
        dirHandle = await window.showDirectoryPicker({ mode: 'read' })
    } catch (e) {
        if (e.name === 'AbortError') return null // user cancelled — not an error
        throw new Error('Could not open folder: ' + e.message)
    }

    const sections = await readDirectory(dirHandle)

    if (sections.length === 0 || sections.every(s => s.items.length === 0)) {
        throw new Error('This folder appears to be empty.')
    }

    // Count total items for progress tracking
    const allItems = sections.flatMap(s => s.items)
    const videoCount = allItems.filter(i => i.fileType === 'video').length

    // Store folder handle in IndexedDB for session re-use
    const courseId = generateCourseId()
    await saveFolderHandle(courseId, dirHandle)

    return {
        id: courseId,
        type: 'local',
        title: dirHandle.name,
        channelTitle: 'Local Course',
        thumbnail: null,
        videoCount: allItems.length, // count all items, not just videos
        sections,                    // local courses have sections
        videos: allItems,            // flat list for progress tracking compatibility
        addedAt: new Date().toISOString(),
        progress: {
            watchedVideos: [],
            percentage: 0,
            lastWatched: null,
        }
    }
}

// Re-request permission for a stored folder handle
export async function requestFolderAccess(courseId) {
    const dirHandle = await getFolderHandle(courseId)
    if (!dirHandle) return null

    try {
        const permission = await dirHandle.requestPermission({ mode: 'read' })
        if (permission !== 'granted') return null
        return dirHandle
    } catch (e) {
        return null
    }
}

// Get a blob URL for a file handle (used for video/image/pdf rendering)
export async function getFileUrl(fileHandle) {
    const file = await fileHandle.getFile()
    return URL.createObjectURL(file)
}

// Read text content from a file handle
export async function getFileText(fileHandle) {
    const file = await fileHandle.getFile()
    return await file.text()
}

// ── IndexedDB for folder handles ──────────────────────────────────────────────
// Folder handles are stored locally in the browser — never sent to any server

const DB_NAME = 'mytube-local'
const DB_VERSION = 1
const STORE = 'folderHandles'

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = e => {
            e.target.result.createObjectStore(STORE)
        }
        req.onsuccess = e => resolve(e.target.result)
        req.onerror = () => reject(req.error)
    })
}

export async function saveFolderHandle(courseId, handle) {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put(handle, courseId)
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
    })
}

export async function getFolderHandle(courseId) {
    try {
        const db = await openDB()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly')
            const req = tx.objectStore(STORE).get(courseId)
            req.onsuccess = () => resolve(req.result || null)
            req.onerror = () => reject(req.error)
        })
    } catch (e) {
        return null
    }
}

export async function deleteFolderHandle(courseId) {
    try {
        const db = await openDB()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            tx.objectStore(STORE).delete(courseId)
            tx.oncomplete = resolve
            tx.onerror = () => reject(tx.error)
        })
    } catch (e) {
        // ignore
    }
}