# SlipShare (React Native)

Mobile app and website for [SlipShare](https://github.com/tonyye99/slip-share): scan a receipt, tick who had what, and send everyone their total, including their share of tax, service charge and rounding.

Built with Expo (SDK 57, Expo Router) and TypeScript. It uses the same Supabase project as the web app.

## How it fits together

- **Auth and data**: the app talks to Supabase directly with `@supabase/supabase-js`. The schema and row-level security live in `supabase/migrations`. The first seven files are copied unchanged from the web repo, so they match what is already applied; anything after them is new for the app. Sessions are kept in the device keychain via `expo-secure-store`, or in the browser's localStorage on the website.
- **Receipt parsing**: the OpenAI call runs in a Supabase Edge Function (`supabase/functions/parse-receipt`), a port of the web app's `/api/openai/parse` route. The OpenAI key never ships in the app.
- **AI consent and privacy**: before the first scan, the scan screen asks permission to send receipt photos to OpenAI. Agreeing adds a row to `ai_consents`, and `parse-receipt` returns 403 without one, so no photo reaches OpenAI before the user agrees. Turning scanning off in Account deletes the row. The parser also sends `store: false`, so OpenAI doesn't keep the response. [`PRIVACY.md`](PRIVACY.md) is the privacy policy; the app links to it on GitHub from the sign-in, sign-up, scan and Account screens, and the App Store and Google Play listings need the same link.
- **Account deletion**: `supabase/functions/delete-account` deletes the signed-in user with the admin API. Every table is keyed on the user with `on delete cascade`, so their profile, receipts (with the people on them) and scan counts go with it. The service role key it needs stays on the server.
- **Splitting**: the person who scanned the receipt splits it for everyone, and friends don't need the app. They add people by name (`receipt_people`; names from their latest receipts come back as one-tap suggestions), tick who had each item (`receipt_item_people`; an item several people had is split evenly) and pick who paid. Every receipt has the owner's own "You" line, added by a trigger. Changes save as you tap. **Send totals** opens the share sheet with a text list for LINE, WhatsApp and the like. Only the receipt owner can read or change these rows.
- **Who paid and mark as paid**: the `set_receipt_payer` RPC moves the payer in one step and keeps `receipts.user_type` in step for the web app. The owner ticks off people who have paid the payer back (`receipt_people.paid_at`).
- **Share links (retired)**: the `payer_picks` migration drops `join_receipt` and the policies that let people who joined by link read a receipt. `receipt_participants` and `receipts.share_token` stay in the database, so this can be undone.
- **Split math**: `src/lib/split.ts`, ported from the web app's cost calculator, with tests in `src/lib/split.test.ts` and `src/lib/people-split.test.ts`.

## Screens

| Route | What it does |
|---|---|
| `sign-in`, `sign-up` | Email and password, plus Continue with Apple (iOS app only), Google and GitHub |
| `forgot-password`, `reset-password` | Emails a reset link; the link opens the app to choose a new password |
| `auth/callback` | Where email confirmation and OAuth links land |
| `(app)/index` | Your receipts (pull to refresh, infinite scroll) and "Scan a receipt" |
| `(app)/account` | Your email, sign out, turn receipt scanning off, the privacy policy, and delete your account (asks you to confirm first) |
| `(app)/scan` | Asks once for permission to send photos to OpenAI. Then camera or photo library, optional English translation, sends a resized JPEG to the parser |
| `(app)/review` | Parsed items and totals. Fix, add or remove misread items (warns when they don't add up to the printed total), save |
| `(app)/receipts/[id]` | Add who was there, tap who had each item (or split everything evenly), pick who paid, mark who has paid back, and send everyone their total. Saves as you tap |

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the slip-share Supabase URL and anon key.
3. Apply the database changes and deploy the parser to the same Supabase project:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push          # applies migrations not yet on the project; run before deploying parse-receipt
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

## Website (EAS Hosting)

The same app runs in a browser. `app.json` uses `web.output: "server"`, so every screen, including `receipts/<id>`, opens straight from a link. Try it locally with `npm run web`.

Differences from the phone app: no Sign in with Apple; Google and GitHub sign-in go to the provider in the same tab and come back to `/auth/callback`; Camera opens the phone's camera in a mobile browser and a file picker on a computer; pop-up messages use the browser's own dialogs (`src/lib/alert.ts`).

To publish it:

1. One time: `npx eas-cli@latest login`, and `npx eas-cli@latest init` if `app.json` has no EAS project ID yet.
2. Run `npm run deploy:web`. It builds the site with the Supabase settings from your `.env`, then uploads it. The first time, it asks you to pick a name, and the site lives at `https://<name>.expo.app`.
3. One time: in Supabase, **Authentication → URL Configuration → Redirect URLs**, add `https://<name>.expo.app/**` so sign-in and password reset links can come back to the site.

Run `npm run deploy:web` again whenever you want the site to have the latest code.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```
