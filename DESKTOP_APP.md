# Arcade World desktop app

This project can be packaged as a desktop app with Electron.

## Setup

```powershell
npm install
```

## Run locally

```powershell
npm run desktop
```

Open `Game Room` and choose `Import local ROM` to launch a file from your computer.

Commercial console games configured in the catalog use the external emulator launcher. Arcade World validates the registered emulator and local game path before starting a separate emulator window.

## Build installer

```powershell
npm run desktop:build
```

The installer output is created in `dist/`.

The packaged app excludes local analytics configuration, credentials, reports, release scripts, editorial source files, tests, emulator binaries and ROM images. Its loopback web server serves only the explicit website allowlist and rejects encoded traversal paths.

If Windows blocks electron-builder's signing utilities from creating symbolic links, use the unsigned local build:

```powershell
npm run desktop:build:unsigned
```

That installer is created in `dist-release/`. It is suitable for local testing but is not code-signed for public distribution.

## Ad-free emulator mode

The desktop app uses the same catalog as the website. External RetroGames.cc games can still show provider ads. To make a game ad-free, add a legal ROM file to `roms/` and configure the game in `data/games-data.js` with:

```js
{
    "mode": "emulatorjs",
    "core": "mame2003",
    "rom": "/roms/example.zip"
}
```

Only use ROM files that you own or have permission to distribute.

## PlayStation 2 / PCSX2

Mercenaries 2: World in Flames is the first external-emulator entry. It uses PCSX2 because the PS2 release is listed as playable by the PCSX2 compatibility project and it provides a stable command-line launcher on Windows.

Setup:

1. Download PCSX2 from https://pcsx2.net/downloads/ and extract it to `emulators/pcsx2/`, or install it in a standard location.
2. Configure PCSX2 with a BIOS dumped from your own PlayStation 2: https://pcsx2.net/docs/setup/bios/
3. Dump your own Mercenaries 2 PS2 disc by following https://pcsx2.net/docs/setup/discs/
4. Put the resulting image at `roms/ps2/Mercenaries 2 - World in Flames.iso`.
5. Run `npm run desktop`, open Game Room, search for Mercenaries 2 and press Launch.

The web build shows the catalog entry and setup requirement but never tries to execute a local program. The Electron build exposes a narrow launcher bridge that accepts only registered emulators and game images within `roms/`.

## Where users can get games

Good user-facing sources for legal retro files:

- https://itch.io/games/free/tag-homebrew
- https://itch.io/games/tag-homebrew/tag-nes-rom
- https://itch.io/games/tag-gameboy-rom
- https://hh.gbdev.io/

Keep the app positioned as a library, launcher and emulator. Users can import their own local files, and the public website should focus on legal homebrew, guides and catalog discovery.

## Saves

EmulatorJS supports save states and loading save states. In the current version, the reliable user flow is local save/download through the emulator UI. A later desktop-only improvement can add app-managed save folders through Electron IPC.
