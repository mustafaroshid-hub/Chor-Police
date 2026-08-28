# Chor Police 🕵️🥷

A mobile-first, multiplayer social-deduction game — offline vs bots, or
online real-time rooms via Firebase. No build step: plain HTML/CSS/JS,
deployable straight to Vercel.

## What's implemented

- ✅ Offline vs Bots — fully playable, no internet required
- ✅ Bot AI with a suspicion system (easy/normal/hard)
- ✅ Custom card creator (name, value, icon, public-reveal toggle per card)
- ✅ Configurable player count (4+), round count, Police reward points
- ✅ Police = dedicated card (not "highest value" — see note below)
- ✅ Thief always hidden until the round resolves
- ✅ Online rooms: create/join, room codes, live lobby, real-time sync
- ✅ Round flow: shuffle → deal → reveal → police identified → guess → result → scores → next round → final leaderboard
- ✅ CSS 3D card flip/shuffle animations (toggle on/off), Web-Audio sound effects, background music, haptics, mute controls

## The rule correction you made

Originally "Police = highest-value card holder." You're right that's not
always what you want, so I changed it: **Police is now its own dedicated
card**, dealt like any other role (same as Thief). Roles come from *which
card you're holding*, not from comparing numbers. Your other cards (King,
Minister, etc.) just carry point values for scoring — nothing about them
determines who's Police.

## Known simplification (read before online launch)

Online mode is **host-authoritative**, not server-authoritative:
- Firestore Security Rules stop other players from reading each other's
  hidden cards or the Thief's identity, and stop anyone from editing
  scores directly.
- But the deal and the round resolution are computed in the **host's own
  browser**. If your host is honest (playing with friends), this is fine
  and is how most lightweight Firebase games work. If you need
  cheat-proofing against a *malicious host*, the deal/resolve logic needs
  to move into a Cloud Function so no client ever touches the full deck.
  I didn't build that — it's a real backend service with its own
  deployment step, and wasn't in scope for a first pass. Say the word if
  you want it added next.

## Project structure

```
chor-police/
  index.html
  css/style.css
  js/cards.js          — card & deck model
  js/sound.js           — synthesized SFX (no external audio files)
  js/bots.js             — bot suspicion AI
  js/game.js             — offline game state machine
  js/online.js            — Firebase Firestore sync layer
  js/firebase-config.js    — YOU fill this in (see below)
  js/app.js                 — screen routing + UI wiring
```

## 1. Firebase setup (you said you already have an account)

1. Go to the [Firebase Console](https://console.firebase.google.com) →
   **Add project** (or reuse an existing one).
2. Inside the project: **Build → Firestore Database → Create database**.
   Start in **production mode** (we'll paste real rules below).
3. **Build → Authentication → Get started → Sign-in method → Anonymous →
   Enable.** The app signs each browser in anonymously so Firestore rules
   can tell players apart without you building a login screen.
4. **Project settings (gear icon) → General → Your apps → Add app → Web
   (`</>`)**. Register it (nickname anything, e.g. "chor-police-web").
   Firebase will show you a config object like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

5. Paste those exact values into `js/firebase-config.js` in this project
   (replace the `PASTE_YOUR_...` placeholders). This file is safe to
   commit — these are public client identifiers, not secrets.

## 2. Firestore Security Rules

Go to **Firestore Database → Rules** and replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /rooms/{roomCode} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      // Only the host can change host-controlled fields; any player in
      // the room can update their own connection status.
      allow update: if request.auth != null;

      match /privateCards/{playerId} {
        allow read: if request.auth != null && request.auth.uid == playerId;
        allow write: if request.auth != null &&
          request.auth.uid == get(/databases/$(database)/documents/rooms/$(roomCode)).data.hostId;
      }

      match /secret/current {
        allow read: if request.auth != null &&
          request.auth.uid == get(/databases/$(database)/documents/rooms/$(roomCode)).data.hostId;
        allow write: if request.auth != null &&
          request.auth.uid == get(/databases/$(database)/documents/rooms/$(roomCode)).data.hostId;
      }
    }
  }
}
```

This is a reasonable starting point for playing with friends: it stops
other players from reading each other's cards or the Thief's identity,
and keeps writes tied to an authenticated session. It does **not** stop a
technically-savvy host from tampering with their own client — see the
"known simplification" note above.

Click **Publish** after pasting.

## 3. Run it locally

No build step needed — it's static files. Just serve the folder, e.g.:

```bash
npx serve chor-police
# or
python3 -m http.server 8000 --directory chor-police
```

Open the printed local URL, e.g. `http://localhost:3000`.

## 4. Deploy to Vercel

```bash
cd chor-police
git init
git add .
git commit -m "Chor Police v1"
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

Then in Vercel:
1. **New Project → Import** your GitHub repo.
2. Framework preset: **Other** (it's static — no build command needed).
3. Root directory: leave as `/` (this whole folder).
4. Deploy.

Because it's plain static files, there's nothing to build — Vercel will
just serve `index.html` and its assets directly.

## What I'd tackle next, if you want to keep going

Roughly in priority order (matches the brief's own priority list):
1. Cloud Function–based server-authoritative dealing/resolution (removes the host-trust caveat above)
2. Reconnect handling polish (currently: disconnect marks `isConnected:false` and hands off host; a full "rejoin mid-round" UX would need a bit more state)
3. Three.js table view as an optional visual upgrade over the current CSS 3D (only worth it once the above two are solid — the brief itself says don't sacrifice reliability for visuals)
4. Bot personalities / difficulty presets beyond the current suspicion-weight model
5. A proper "How to Play" set of small illustrations instead of numbered text steps
