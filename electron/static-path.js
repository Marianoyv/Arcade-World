const path = require('path');

const publicRootFiles = new Set([
    '404.html', 'about.html', 'analytics-config.js', 'analytics.html', 'analytics.js',
    'arcade-games.html', 'blog.html', 'contact.html', 'creators.html', 'destino.html',
    'dmca.html', 'editorial-policy.html', 'emulators.html', 'feed.xml', 'freeplay.html',
    'games.html', 'get-games.html', 'guides.html', 'help.html', 'home-games.js',
    'homebrew-games.html', 'index.html', 'insights.html', 'legal-games.html',
    'legal-games.js', 'library.html', 'library.js', 'main.js', 'manifest.webmanifest',
    'news-sitemap.xml', 'player.html', 'player.js', 'press-kit.html', 'privacy.html',
    'ProductSans-Regular.woff', 'registro.html', 'retro-games.html', 'robots.txt',
    'sitemap.xml', 'submit-game.html', 'sw.js', 'terms.html', 'vanilla-tilt.js'
]);
const publicDirectories = new Set(['blog', 'categories', 'css', 'data', 'font', 'games', 'img', 'vendor']);
const publicExtensions = new Set(['.css', '.html', '.jpg', '.js', '.mp4', '.png', '.svg', '.ttf']);

function isPathInside(parent, target) {
    const relative = path.relative(parent, target);
    return relative === ''
        || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function resolveStaticPath(rootDir, requestUrl) {
    try {
        const url = new URL(requestUrl, 'http://localhost');
        const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
        const decodedPath = decodeURIComponent(pathname);

        if (decodedPath.includes('\0')) {
            return null;
        }

        const relativePath = decodedPath.replace(/^[/\\]+/, '');
        const target = path.resolve(rootDir, relativePath);
        if (!isPathInside(rootDir, target)) {
            return null;
        }

        const normalizedRelative = path.relative(rootDir, target);
        const segments = normalizedRelative.split(path.sep);
        const isPublicRootFile = segments.length === 1 && publicRootFiles.has(segments[0]);
        const isPublicAsset = segments.length > 1
            && publicDirectories.has(segments[0])
            && publicExtensions.has(path.extname(target).toLowerCase());
        return isPublicRootFile || isPublicAsset ? target : null;
    } catch (_) {
        return null;
    }
}

module.exports = { isPathInside, resolveStaticPath };
