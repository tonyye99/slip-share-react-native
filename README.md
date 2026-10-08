# SlipShare (React Native)

Mobile app for [SlipShare](https://github.com/tonyye99/slip-share): scan a receipt, tap what you had, and see what you owe, including your share of tax, service charge and rounding.

Built with Expo (SDK 57, Expo Router) and TypeScript. It uses the same Supabase project as the web app.

## How it fits together

- **Auth and data**: the app talks to Supabase directly with `@supabase/supabase-js`. The schema and row-level security live in `supabase/migrations`. The first seven files are copied unchanged from the web repo, so they match what is already applied; anything after them is new for the app. Sessions are kept in the device keychain via `expo-secure-store`.
- **Receipt parsing**: the OpenAI call runs in a Supabase Edge Function (`supabase/functions/parse-receipt`), a port of the web app's `/api/openai/parse` route. The OpenAI key never ships in the app.
- **Account deletion**: `supabase/functions/delete-account` deletes the signed-in user with the admin API. Every table is keyed on the user with `on delete cascade`, so their profile, receipts, shares and scan counts go with it. The service role key it needs stays on the server.
- **Sharing**: each receipt has a `share_token`. The owner shares `slipshare://join/<token>`; opening it calls the `join_receipt` RPC, which adds the person to `receipt_participants` so RLS lets them read the receipt and save their own selection. This needs the `receipt_sharing` migration in `supabase/migrations`.
- **Mark as paid**: when the owner paid the bill, they tick off friends who paid them back. The `set_participant_paid` RPC (owner only) sets `paid_at` on the friend's `receipt_participants` row and copies their saved total into `paid_amount`. Friends can read their own row, so they see it too.
- **Split math**: `src/lib/split.ts`, ported from the web app's cost calculator, with tests in `src/lib/split.test.ts`.

## Screens

| Route | What it does |
|---|---|
| `sign-in`, `sign-up` | Email and password, plus Continue with Apple (iOS), Google and GitHub |
| `forgot-password`, `reset-password` | Emails a reset link; the link opens the app to choose a new password |
| `auth/callback` | Where email confirmation and OAuth links land |
| `(app)/index` | Your receipts (pull to refresh, infinite scroll) and "Scan a receipt" |
| `(app)/account` | Your email, sign out, and delete your account (asks you to confirm first) |
| `(app)/scan` | Camera or photo library, optional English translation, sends a resized JPEG to the parser |
| `(app)/review` | Parsed items and totals. Fix, add or remove misread items (warns when they don't add up to the printed total), choose "I paid" or "Someone else paid", save |
| `(app)/receipts/[id]` | Tap items you had, set how many people shared each, live total, save your share. The owner can share a link, sees who owes what, and marks who has paid them back |
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
   npx supabase functions deploy delete-account
   ```
4. Set up sign-in in the Supabase dashboard (see below).
5. `npx expo start`, then open it in Expo Go or a development build. To install the app on your phone instead, see [Install on your phone](#install-on-your-phone-eas-build).

## Sign-in setup (Supabase dashboard)

Auth links use PKCE: they come back to the app as `slipshare://…?code=…`, and `src/lib/auth-links.ts` exchanges the code for a session.

- **Authentication → URL Configuration → Redirect URLs**: add `slipshare://**`. For Expo Go during development, also add `exp://**`.
- **Google** and **GitHub** providers: these are the same ones the web app uses. Nothing else is needed, because the app signs in through Supabase's web flow in an in-app browser.
- **Apple** provider: enable it and add the bundle ID `com.tonyye99.slipshare` under *Client IDs*. iOS uses native Sign in with Apple (`usesAppleSignIn` in `app.json`), so test it in a development build. In Expo Go the token is issued to `host.exp.Exponent`, which you would also have to list. The App Store requires Apple sign-in when other social logins are offered.
- **Password reset** and **email confirmation** links use the same redirect URLs. Open them on the phone that asked for them, because the PKCE verifier is stored there.

## Install on your phone (EAS Build)

EAS builds the app in Expo's cloud, so you don't need Xcode or Android Studio. `eas.json` has three profiles:

| Profile | What you get |
|---|---|
| `preview` | The app as users will see it, installed from a link. Android gets an APK. |
| `development` | A dev build that loads code from `npx expo start` on your computer, with live reload. Needed for native modules Expo Go lacks. |
| `production` | Store builds. The build number goes up on each build. |

Builds need a free [Expo account](https://expo.dev/signup). An iPhone also needs a paid Apple Developer account, because builds outside the App Store must be signed for your device. Android needs nothing extra.

1. Sign in and link this repo to an EAS project. `init` writes the project ID into `app.json`, so commit that change:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
2. Give the builds the Supabase settings. `.env` is not uploaded to EAS, and the anon key is safe to ship in the app because RLS protects the data:
   ```bash
   npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://<project-ref>.supabase.co \
     --environment preview --environment development --environment production --visibility plaintext
   npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon-key> \
     --environment preview --environment development --environment production --visibility plaintext
   ```
3. Build and install:
   - **Android:** `npx eas-cli@latest build --profile preview --platform android`. When it finishes, open the link or scan the QR code on your phone and install the APK.
   - **iPhone:** register the phone once with `npx eas-cli@latest device:create`, then run `npx eas-cli@latest build --profile preview --platform ios`. Sign in with your Apple Developer account when asked, and let EAS manage the certificates. It turns on Sign in with Apple from `app.json`. Open the link on the iPhone to install. A phone you register later only gets the next build.

Builds use the `slipshare://` redirect URL, so `exp://**` in Supabase is only needed for Expo Go.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```
