# Still

Still is a private, writing-first thought space. Open it, write without
organizing, and return later to continue.

## Included

- Email/password authentication with Supabase Auth
- Distraction-free long-form editor
- Debounced autosave with a visible sync state
- Local draft recovery when the network is unavailable
- Inbox, developing, pinned, review, and archive views
- Search across titles and writing
- Scheduled resurfacing dates
- Browser speech-to-text with phone-keyboard dictation as a fallback
- Installable web app manifest
- Ownership-based Row Level Security

## Local development

Copy the example environment file and add the project values:

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database

Apply the migration in
[`supabase/migrations/20260727173413_create_thoughts.sql`](supabase/migrations/20260727173413_create_thoughts.sql)
to the Supabase project. It creates the `thoughts` table, indexes, timestamp
trigger, grants, and owner-only RLS policies.

If email confirmation is enabled, add the deployed origin and
`/auth/callback` URL to the Supabase Auth redirect URL allowlist.

## Checks

```bash
npm run lint
npm run build
npm audit
```
