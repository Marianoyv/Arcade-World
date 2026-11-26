const { contextBridge, ipcRenderer } = require('electron');

function gamePayload(game) {
    return {
        id: game?.id,
        title: game?.title,
        emulator: game?.emulator,
        romPath: game?.romPath
    };
}

contextBridge.exposeInMainWorld('arcadeWorldDesktop', {
    isDesktop: true,
    getGameStatus: (game) => ipcRenderer.invoke('desktop:game-status', gamePayload(game)),
    launchGame: (game) => ipcRenderer.invoke('desktop:launch-game', gamePayload(game))
});
