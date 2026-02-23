# Amity AI – University Knowledge Assistant

Hackathon-ready RAG MVP using Next.js, Firebase, Supabase pgvector, Hugging Face embeddings, and OpenRouter DeepSeek chat.

## Tech Stack

- Next.js (App Router)
- Firebase Authentication + Firestore
- Supabase Postgres + pgvector
- Hugging Face Inference API (`sentence-transformers/all-MiniLM-L6-v2`)
- OpenRouter (`deepseek/deepseek-chat`)
- Tailwind CSS

## Project Structure

```
app/
	login/
	dashboard/
	admin-upload/
	api/
		embed/
		chat/
		admin-upload/
lib/
	firebase.js
	firebaseAdmin.js
	supabase.js
	rag.js
	pdfParser.js
	authServer.js
supabase/
	schema.sql
```

## Environment Variables

Copy `.env.example` to `.env.local` and set:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
HUGGINGFACE_API_KEY=
OPENROUTER_API_KEY=
```

`FIREBASE_SERVICE_ACCOUNT` must be a JSON string of the Firebase service account.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Run Supabase SQL in `supabase/schema.sql`.

3. In Firestore, store user roles in:

```
users/{uid}
	role: "Student" | "Admin"
	email: string
```

4. Start dev server:

```bash
npm run dev
```

## RAG Flow

1. Admin uploads PDF on `/admin-upload`.
2. PDF text is extracted and split into 600-word chunks.
3. Each chunk is embedded (384-dim) via Hugging Face.
4. Chunks and vectors are stored in Supabase `documents`.
5. User asks on `/dashboard`:
   - question embedding generated
   - top 3 chunks retrieved by cosine similarity
   - context + question sent to OpenRouter DeepSeek
   - response returned and chat history stored in Firestore

If no relevant chunks exist, response is:

`Information not available in university records.`

## Security

- Keys are only used in server routes.
- `/api/admin-upload` enforces Firebase auth + Admin role validation.
- Upload attempts by non-admin return `403`.
