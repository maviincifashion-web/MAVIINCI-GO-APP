# MAVIINCI FARM mobile

Android app to watch the MAVIINCI FARM render farm and hand out work from a phone.
It talks to the phone bridge of the desktop app (`app/electron/mobile.js` in the MAVIINCI-GO repo) over the office Wi-Fi.

What it does: overview of the 3 PCs, the queue (move jobs, send a file to a PC, cancel), job details with the rendered looks,
the Review inbox (publish or render again), new jobs from materials already in the studio, turning a PC on or off for jobs,
re-rendering outfits that are live on the website, and the activity feed. Materials are made in the Lab on a PC, not here.

## Pairing

1. On the studio server (MAVIINCI3) open **Settings → Phone app**. It shows the address (for example `http://192.168.1.11:7861`) and a 6-digit code.
2. In the app enter the address and the code. Each phone pairs once; remove a phone from the same Settings page.

## Build

```sh
npm install
npm run dev          # browser preview against a running farm
npm run build        # typecheck + web build
npm run apk          # sync + debug APK: android/app/build/outputs/apk/debug/app-debug.apk
```

The APK build needs Java 21 (`JAVA_HOME` = Android Studio's `jbr`) and the Android SDK (`android/local.properties` → `sdk.dir`).

Dev only: `http://localhost:5173/#pair=<farm address>|<token>&tab=queue&screen=new` opens a screen directly (used for screenshots).

## Rule

Every feature added to the desktop app also comes to this app.
