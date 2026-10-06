# SlipShare (React Native)

Mobile app for [SlipShare](https://github.com/tonyye99/slip-share): scan a receipt, tap what you had, and see what you owe, including your share of tax, service charge and rounding.

Built with Expo (SDK 57, Expo Router) and TypeScript. It uses the same Supabase project as the web app.

## How it fits together

- **Auth and data**: the app talks to Supabase directly with `@supabase/supabase-js`. The schema and row-level security live in `supabase/migrations`. The first seven files are copied unchanged from the web repo, so they match what is already applied; anything after them is new for the app. Sessions are kept in the device keychain via `expo-secure-store`.
- **Receipt parsing**: the OpenAI call runs in a Supabase Edge Function (`supabase/functions/parse-receipt`), a port of the web app's `/api/openai/parse` route. The OpenAI key never ships in the app.
- **Sharing**: each receipt has a `share_token`. The owner shares `slipshare://join/<token>`; opening it calls the `join_receipt` RPC, which adds the person to `receipt_participants` so RLS lets them read the receipt and save their own selection. This needs the `receipt_sharing` migration in `supabase/migrations`.
- **Split math**: `src/lib/split.ts`, ported from the web app's cost calculator, with tests in `src/lib/split.test.ts`.

## Screens

| Route | What it does |
|---|---|
| `sign-in`, `sign-up` | Email and password auth |
| `(app)/index` | Your receipts (pull to refresh, infinite scroll) and "Scan a receipt" |
| `(app)/scan` | Camera or photo library, optional English translation, sends a resized JPEG to the parser |
| `(app)/review` | Parsed items and totals, choose "I paid" or "Someone else paid", save |
| `(app)/receipts/[id]` | Tap items you had, set how many people shared each, live total, save your share. The owner can share a link and sees who owes what |
| `join/[token]` | Opened from a share link; joins the receipt (after sign-in if needed) and opens it |

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the slip-share Supabase URL and anon key.
3. Apply the database changes and deploy the parser to the same Supabase project:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push          # applies migrations not yet on the project
   npx supabase secrets set OPENAI_API_KEY=sk-...
   npx supabase functions deploy parse-receipt
   ```
4. `npx expo start`, then open it in Expo Go or a development build.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```
