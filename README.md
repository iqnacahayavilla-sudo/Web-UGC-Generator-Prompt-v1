# UGC Prompt Studio

Turn any product photo into a ready-to-copy UGC video prompt for AI video generators (e.g. Google Flow).

**Flow:** Upload Product Photo → Choose Video Settings → Choose Creator → Choose Language → Generate → Copy Google Flow Prompt. No account required.

## Tech stack
- **Frontend:** React (CRA + Tailwind + shadcn/ui + framer-motion)
- **Backend:** FastAPI (Python)
- **Database:** MongoDB (anonymous `projects`)
- **AI:** Gemini `gemini-3-flash-preview` (image analysis + prompt generation)
- **Storage:** object storage for product images

The backend is intentionally modular so the AI provider can be swapped later:
```
backend/services/ai_service.py          # provider abstraction (only file that talks to the model)
backend/services/product_analysis.py    # image → structured product JSON (runs once per image)
backend/services/prompt_templates.py    # reusable prompt templates
backend/services/prompt_generator.py    # orchestrates template + AI
backend/services/storage_service.py     # product image upload/serve
```

## Environment variables

Backend (`backend/.env`):
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CORS_ORIGINS=*
EMERGENT_LLM_KEY=<universal LLM key used for Gemini + object storage>
```
> To use your own Gemini key instead, replace `ai_service._api_key()` with `GEMINI_API_KEY` and configure the Gemini SDK. The API key is **only** ever read server-side and is never exposed to the browser.

Frontend (`frontend/.env`):
```
REACT_APP_BACKEND_URL=<backend base url>
```

**Never commit secrets.** All keys are read from environment variables only.

## Run locally
```bash
# backend
cd backend && pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001

# frontend
cd frontend && yarn install && yarn start
```

## API
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/analyze` | Upload image (jpg/png/webp) → store + analyze once → returns `project_id`, `product_analysis` |
| POST | `/api/projects/{id}/generate` | Generate/regenerate the Google Flow prompt from stored analysis + settings |
| GET | `/api/projects/{id}` | Fetch a stored project |
| GET | `/api/files/{path}` | Serve a stored product image |

## Cost optimization
Each image is analyzed **once** at upload; the structured analysis is stored and reused for every (re)generation, so changing style/creator/language never re-runs vision analysis.

## Deploying elsewhere (GitHub → Vercel/Render + managed Mongo)
1. Push the repo to GitHub (secrets excluded via `.env`).
2. Deploy `frontend` as a static React build; set `REACT_APP_BACKEND_URL` to your backend URL.
3. Deploy `backend` (FastAPI) to any Python host; set `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `EMERGENT_LLM_KEY`.
4. Use a managed MongoDB (e.g. MongoDB Atlas) for `MONGO_URL`.
