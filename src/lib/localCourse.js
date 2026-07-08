// ── Local Course Reader ────────────────────────────────────────────────────────
// Uses File System Access API (Chrome/Edge/Brave only)
// Files never leave the user's machine — only FileSystemFileHandle references
// are stored in IndexedDB. No files are uploaded anywhere.

const VIDEO_TYPES = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']
const AUDIO_TYPES = ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac', 'opus']
const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif']
// Plain-text / code / data files we can safely show as raw source text.
const TEXT_TYPES = [
    'txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'xml', 'yml', 'yaml',
    'log', 'ini', 'conf', 'env', 'js', 'jsx', 'ts', 'tsx', 'py', 'java',
    'c', 'h', 'cpp', 'cc', 'cs', 'go', 'rs', 'rb', 'php', 'sh', 'bat',
    'css', 'scss', 'sass', 'less', 'sql',
]
const PDF_TYPES = ['pdf']
const HTML_TYPES = ['html', 'htm']
// Subtitle files are hidden from the course list — they're not study material,
// they're sidecars to the videos.
const SUBTITLE_TYPES = ['srt', 'vtt', 'sub', 'ass', 'ssa']

export function isSubtitleFile(name) {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    return SUBTITLE_TYPES.includes(ext)
}

export function getFileType(name) {
    const ext = name.split('.').pop()?.toLowerCase() || ''
    if (VIDEO_TYPES.includes(ext)) return 'video'
    if (AUDIO_TYPES.includes(ext)) return 'audio'
    if (IMAGE_TYPES.includes(ext)) return 'image'
    if (TEXT_TYPES.includes(ext)) return 'text'
    if (PDF_TYPES.includes(ext)) return 'pdf'
    if (HTML_TYPES.includes(ext)) return 'html'
    // Everything else (xlsx, pptx, docx, zip, …) can't render in a browser;
    // the player offers an Open/Download button for these instead.
    return 'other'
}

export function getFileIcon(fileType) {
    switch (fileType) {
        case 'video': return '▶'
        case 'audio': return '🎵'
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
    // Subtitle sidecars in THIS directory. Kept out of the course list, but
    // matched to their video below so they can be shown as captions.
    const subtitleNames = []

    const entries = []
    for await (const entry of dirHandle.values()) {
        entries.push(entry)
    }

    for (const entry of entries) {
        if (entry.kind === 'file') {
            // Skip hidden files
            if (entry.name.startsWith('.')) continue
            // Remember subtitle sidecars (.srt, .vtt, …) for caption matching,
            // but don't list them as their own study-material items.
            if (isSubtitleFile(entry.name)) { subtitleNames.push(entry.name); continue }
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

    // Attach a matching subtitle sidecar (same directory, same basename) to each
    // video so the player can show it as captions. Stored as a plain filename.
    for (const item of topItems) {
        if (item.fileType !== 'video') continue
        const sub = pickSubtitle(item.fullName, subtitleNames)
        if (sub) item.subtitle = sub
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

    // Safety cap. We only keep lightweight metadata + a folder handle in memory
    // (files are never all loaded at once), so this can be generous — it exists
    // only to guard against accidentally picking a huge folder.
    const allItemsCheck = sections.flatMap(s => s.items)
    if (allItemsCheck.length > 5000) {
        throw new Error(`This folder contains ${allItemsCheck.length} files. Please select a folder with 5000 files or fewer.`)
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
            positions: {},
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

// ── Subtitles ─────────────────────────────────────────────────────────────────
// Subtitle files are hidden from the course list (see readDirectory), but we
// still surface them as captions ON the matching video. The <track> element
// only accepts WebVTT, so .srt is converted on the fly. .ass/.ssa/.sub aren't
// convertible with a simple pass, so only .vtt/.srt sidecars are attached.

// Pick the sidecar subtitle (.vtt preferred, else .srt) whose basename matches
// the video's, e.g. "lecture01.mp4" ↔ "lecture01.srt" / "lecture01.en.vtt".
export function pickSubtitle(videoFullName, subtitleNames) {
    const base = videoFullName.replace(/\.[^/.]+$/, '').toLowerCase()
    let fallback = null
    for (const name of subtitleNames) {
        const ext = name.split('.').pop()?.toLowerCase() || ''
        if (ext !== 'vtt' && ext !== 'srt') continue
        const subBase = name.replace(/\.[^/.]+$/, '').toLowerCase()
        if (subBase === base || subBase.startsWith(base + '.')) {
            if (ext === 'vtt') return name
            if (!fallback) fallback = name
        }
    }
    return fallback
}

// Convert SubRip (.srt) text to WebVTT: add the header and turn the comma in
// timestamps (00:00:01,000) into a dot (00:00:01.000). Cue index lines are
// valid VTT cue identifiers, so they can stay.
function srtToVtt(srt) {
    const body = srt
        .replace(/^﻿/, '')                              // strip BOM
        .replace(/\r+/g, '')                                 // CRLF → LF
        .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')    // comma → dot
    return 'WEBVTT\n\n' + body
}

// Read `subtitleFullName` from `dirHandle` and return a same-origin WebVTT
// blob: URL for it (.srt converted). Caller owns the URL and must revoke it.
export async function getSubtitleUrl(dirHandle, subtitleFullName) {
    const handle = await dirHandle.getFileHandle(subtitleFullName)
    const file = await handle.getFile()
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    let text = await file.text()
    if (ext !== 'vtt') text = srtToVtt(text)
    return URL.createObjectURL(new Blob([text], { type: 'text/vtt' }))
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