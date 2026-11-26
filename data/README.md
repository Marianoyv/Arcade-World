# Game catalog

`games-data.js` is the catalog used by `games.html`.

## External provider mode

These games load a third-party iframe and may show provider ads.

```js
{
    "title": "Pac-Man",
    "embed": "https://www.retrogames.cc/embed/9406-pac-man-midway-1.html",
    "source": "https://www.retrogames.cc/arcade-games/pac-man-midway-1.html"
}
```

## EmulatorJS mode

These games load through Arcade World's own `player.html`.

```js
{
    "id": "example-homebrew",
    "title": "Example Homebrew",
    "mode": "emulatorjs",
    "core": "nes",
    "rom": "/roms/example-homebrew.nes",
    "source": "/player.html?id=example-homebrew"
}
```

For arcade/MAME titles, use a zipped ROM set and a matching EmulatorJS core, for example:

```js
{
    "mode": "emulatorjs",
    "core": "mame2003",
    "rom": "/roms/example-arcade.zip"
}
```

Only add ROM files that you own or have permission to distribute.
