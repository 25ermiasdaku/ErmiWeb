# Ermi Coffee — mobile app

The customer half of Ermi Coffee: order ahead, track the ticket from the bar to
your hands, and watch loyalty points bank when you collect.

Built with **Expo SDK 53** (`expo-router` v5, React 19, TypeScript, React Native
0.79). It talks to the Next.js backend's JSON API (`/api/*`); the server is the
single source of truth for menu, pricing, stock and points.

## Running it

The app needs the backend running first (from the repo root: `npm run dev`),
then:

```bash
cd mobile
npm install
npx expo start
```

That prints a QR code for **Expo Go** (scan it from the phone) plus `a` / `i` /
`w` shortcuts for the Android emulator, iOS simulator and web.

`npx expo install --fix` right after `npm install` is a good idea too — it
reconciles any dependency version Expo wants that the lockfile already pinned.

## Pointing at the API

The client reads `process.env.EXPO_PUBLIC_API_URL` and falls back to
`http://localhost:3000`. Set it when starting the dev server:

```bash
# Android emulator reaches the host machine via 10.0.2.2, not localhost
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 npx expo start

# Physical phone on the same wifi, using your machine's LAN IP
EXPO_PUBLIC_API_URL=http://192.168.1.50:3000 npx expo start

# Windows PowerShell
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:3000"; npx expo start
```

The variable is inlined into the bundle at build time, so it must be present
when `expo start`/`expo export` runs, not when the OS hands it to the running
app later.

## Features

- **Home** — this-season promotions, the loyalty tiers and the café list, with
  pull-to-refresh.
- **Menu** — the live catalogue with search, category and roast filters; tap a
  drink to customise it.
- **Item** — single-select option groups (size, milk, extras), a quantity
  stepper and a live price.
- **Cart** — lines are keyed by item + options so two builds of the same drink
  stay separate; optional bar note; reward redemption for members; places real
  orders.
- **Orders** — your tickets. Confirm a pending order, confirm collection when
  it is ready (that is when points bank), and withdraw a pending order.
- **Account** — name, email, live points balance, the rewards you can afford,
  sign-in/sign-out, and deleting your own account (password re-confirmed;
  permanent, own record only).
- **Auth** — username/password login and self-registration, with the session
  held in `expo-secure-store`.

## Structure

```
app/
  _layout.tsx          providers + the themed root Stack
  (tabs)/              Home · Menu · Cart · Orders · Account
  item/[id].tsx        drink customisation
  login.tsx register.tsx
src/
  api.ts               the only file that touches the network (all types + calls)
  format.ts            money, status text, and what a customer can do per status
  theme.ts             palette + shared styles
  store/auth.tsx       session context (expo-secure-store)
  store/cart.tsx       the basket context
  components/          shared loading / error / empty states
```

## Notes

- Money is integer cents end to end. The client only ever posts item and option
  **ids**; the server recomputes every price and refuses a tampered basket.
- Icons are emoji in `<Text>` nodes — no icon font is bundled.
- The app ships without `icon`/`splash` image assets in `app.json` (Expo falls
  back to defaults). Drop a `1024×1024` PNG at `assets/icon.png` and re-add
  `"icon": "./assets/icon.png"` when you want branded art.