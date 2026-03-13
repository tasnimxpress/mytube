# MyTube · FocusLearn

**Watch YouTube playlists like a focused course. No recommendations. No distractions.**
> Beta v0.1 — Live at [mytube-learn.vercel.app]([https://mytube-learn.vercel.app/])

---

## The Problem

YouTube is great for learning — but terrible for focus. The moment a video ends, you're pulled into recommendations, shorts, and unrelated content. Most people never finish what they started.

## The Solution

MyTube strips everything away. Paste a YouTube playlist, and it becomes a clean course interface — just like Udemy. Watch, track progress, and actually finish what you start.

---

## Features

- **Distraction-free player** — YouTube embedded with no sidebar, no recommendations, no comments
- **Course progress tracking** — check off videos as you watch, see your % completion per course
- **Resume where you left off** — automatically returns to your last watched video
- **Google login** — your courses sync to your account, access from any device
- **Stats dashboard** — see total courses, videos watched, and completed courses at a glance

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 + Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase + Google OAuth |
| Playlist data | YouTube Data API v3 + Supadata fallback |
| Hosting | Vercel |

## Future Scope - AI integration

- [ ] AI Q&A — ask questions about what you just watched
- [ ] Notes per video
- [ ] Keyboard shortcuts
- [ ] Mobile app
- [ ] Test your knowledge with a curated exam

---
