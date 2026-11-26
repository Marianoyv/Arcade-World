const fs = require('fs');
const path = require('path');

function existingPcsx2Executables(directory) {
    if (!directory || !fs.existsSync(directory)) {
        return [];
    }

    try {
        return fs.readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isFile() && /^pcsx2(?:-qt|_qtx64[^.]*)?\.exe$/i.test(entry.name))
            .map((entry) => path.join(directory, entry.name));
    } catch (error) {
        return [];
    }
}

function pcsx2Candidates(rootDir) {
    const localAppData = process.env.LOCALAPPDATA;
    const programFiles = process.env.ProgramFiles;
    const programFilesX86 = process.env['ProgramFiles(x86)'];
    const portableDir = path.join(rootDir, 'emulators', 'pcsx2');
    const directories = [
        portableDir,
        localAppData && path.join(localAppData, 'Programs', 'PCSX2'),
        programFiles && path.join(programFiles, 'PCSX2'),
        programFilesX86 && path.join(programFilesX86, 'PCSX2')
    ].filter(Boolean);

    return [
        process.env.ARCADE_WORLD_PCSX2,
        path.join(portableDir, 'pcsx2-qt.exe'),
        path.join(portableDir, 'pcsx2.exe'),
        ...directories.flatMap(existingPcsx2Executables)
    ].filter(Boolean);
}

const emulatorRegistry = {
    pcsx2: {
        id: 'pcsx2',
        name: 'PCSX2',
        platform: 'PlayStation 2',
        website: 'https://pcsx2.net/downloads/',
        supportedExtensions: ['.iso', '.bin', '.chd', '.cso', '.gz'],
        executableCandidates: pcsx2Candidates,
        buildArguments: (gamePath) => ['-batch', '-fullscreen', '--', gamePath]
    }
};

module.exports = { emulatorRegistry };
