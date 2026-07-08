# MyTube · FocusLearn

**Watch YouTube playlists like a focused course. No recommendations. No distractions.**
> Beta v0.1 — Live at [mytube-learn.vercel.app](https://mytube-learn.vercel.app/)

---

## The Problem

YouTube is great for learning — but terrible for focus. The moment a video ends, you're pulled into recommendations, shorts, and unrelated content. Most people never finish what they started.

## The Solution

MyTube strips everything away. Paste a YouTube playlist, and it becomes a clean course interface — just like Udemy. Watch, track progress, and actually finish what you start.

---

## Features

- **Distraction-free player** — YouTube embedded with no sidebar, no recommendations, no comments
- **Import playlists or single videos** — paste a YouTube playlist URL, or a single video
- **Local courses** — point MyTube at a folder on your computer and it becomes a structured course: videos, PDFs, audio, images, and text files, organized by subfolder. Files never leave your device — only file references are stored
- **Subtitles for local videos** — matching `.srt`/`.vtt` sidecar files show automatically as captions (`.srt` is converted to WebVTT on the fly), without cluttering the content list
- **Course progress tracking** — check off videos as you watch, see your % completion per course
- **Resume where you left off** — returns to your last video *and the exact second you stopped*, for both YouTube and local videos
- **Notes per video** — jot multiple notes in the sidebar while the video plays; they autosave and sync to your account
- **Google login** — your courses sync to your account, access from any device
- **Stats dashboard** — see total courses, videos watched, and completed courses at a glance

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 + Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase + Google OAuth |
| Playlist data | YouTube Data API v3 + Supadata fallback |
| Hosting | Vercel |

## Future Scope - AI integration

- [ ] AI Q&A — ask questions about what you just watched
- [x] Notes per video
- [ ] Keyboard shortcuts
- [ ] Mobile app
- [ ] Test your knowledge with a curated exam

---
