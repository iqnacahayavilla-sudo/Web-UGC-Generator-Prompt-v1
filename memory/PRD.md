# UGC Prompt Studio — PRD

## Original problem statement
Build a production-ready MVP SaaS web app "UGC Prompt Studio" that helps affiliate marketers and creators generate high-quality, ready-to-copy UGC video prompts for AI video generators (Google Flow). Core journey: Upload Product Photo → Choose Video Settings → Generate → Copy Google Flow Prompt. Feels like a modern AI SaaS product, not an admin dashboard. Beginner-friendly, no prompt knowledge required.

## User choices (confirmed)
- Stack: React + FastAPI + MongoDB (adapted from spec's Supabase/Next.js).
- AI: Gemini `gemini-3-flash-preview` via Emergent Universal LLM key.
- Auth: none (anonymous projects).
- Image storage: Emergent Object Storage.

## Architecture
- Frontend: React CRA, Tailwind, shadcn/ui, framer-motion, sonner toasts. Routes `/` (Landing) and `/create` (Studio wizard + result).
- Backend: FastAPI with `/api` prefix. Modular services (ai/product-analysis/prompt-templates/prompt-generator/storage) so the AI provider is swappable.
- DB: MongoDB `projects` collection (uuid string ids; anonymous; auth-ready via nullable `user_id`).

## User personas
- TikTok/Reels/Shorts affiliate creators, e-commerce sellers, small businesses, UGC & AI-video creators. Beginner-friendly; no AI terminology exposed.

## Core requirements (static)
1. Upload product image (jpg/png/webp), preview, remove/replace.
2. Analyze image once → structured product JSON, user-editable.
3. Step wizard: Product → Style → Creator → Generate (+ language).
4. Generate a Google Flow-ready plain-text prompt (overview, product, creator, location, camera, audio, timed scenes, CTA, negative prompt).
5. Copy full prompt + copy individual scenes; regenerate; quick tweaks; edit settings; new video.
6. Reuse stored analysis (no re-analysis on regenerate). API keys server-side only. Responsive.

## Implemented (2026-06)
- [x] Landing page (hero, how it works, UGC styles, features, example prompt, FAQ, CTA).
- [x] Studio wizard with animated steps, sidebar progress + image preview.
- [x] Image upload → object storage → Gemini image analysis → editable detected details.
- [x] All video/creator/language options with defaults per spec.
- [x] Prompt generation returning master_prompt + scenes + summary.
- [x] Result view: summary grid, GOOGLE FLOW PROMPT container, copy prompt, scene breakdown with per-scene copy, quick-regenerate actions, edit settings, new video.
- [x] Staged generate loading messages; friendly error handling; toasts.
- [x] Analysis reused on regenerate (cost optimization).
- [x] README + env var documentation.
- [x] End-to-end tested (backend 7/7, frontend all flows, 100%).

## Backlog / future
- P1: Persist & list past projects (needs history UI); add auth (JWT or Google) using nullable `user_id` already in schema.
- P2: Async storage client (httpx) instead of blocking `requests`; magic-byte image validation; FastAPI lifespan handlers; rate limiting.
- P2: Additional languages & UGC style presets (template-driven).

## Next tasks
- Await user feedback on generated prompt quality/tone; tune templates if needed.
