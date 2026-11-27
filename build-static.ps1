[CmdletBinding()]
param(
    [string]$Destination
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
if ([string]::IsNullOrWhiteSpace($Destination)) {
    $Destination = Join-Path $projectRoot 'site-dist'
}
$destinationPath = [IO.Path]::GetFullPath($Destination).TrimEnd([IO.Path]::DirectorySeparatorChar)
$projectPrefix = $projectRoot + [IO.Path]::DirectorySeparatorChar

& node (Join-Path $projectRoot 'scripts/generate-blog-views.cjs')
if ($LASTEXITCODE -ne 0) {
    throw 'Could not generate blog view counts.'
}

if ($destinationPath -eq $projectRoot -or -not $destinationPath.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Static output must stay inside the project and cannot be the project root: $destinationPath"
}

$publicRootFiles = @(
    '404.html',
    'about.html',
    'analytics-config.js',
    'analytics.html',
    'analytics.js',
    'arcade-games.html',
    'blog.html',
    'contact.html',
    'creators.html',
    'destino.html',
    'dmca.html',
    'editorial-policy.html',
    'emulators.html',
    'feed.xml',
    'freeplay.html',
    'games.html',
    'get-games.html',
    'guides.html',
    'help.html',
    'home-games.js',
    'homebrew-games.html',
    'index.html',
    'insights.html',
    'legal-games.html',
    'legal-games.js',
    'library.html',
    'library.js',
    'main.js',
    'manifest.webmanifest',
    'news-sitemap.xml',
    'player.html',
    'player.js',
    'press-kit.html',
    'privacy.html',
    'ProductSans-Regular.woff',
    'registro.html',
    'retro-games.html',
    'robots.txt',
    'sitemap.xml',
    'submit-game.html',
    'sw.js',
    'terms.html',
    'vanilla-tilt.js'
)
$publicDirectories = @('blog', 'categories', 'css', 'data', 'font', 'games', 'img', 'vendor')

if (Test-Path -LiteralPath $destinationPath) {
    Remove-Item -LiteralPath $destinationPath -Recurse -Force
}
New-Item -ItemType Directory -Path $destinationPath | Out-Null

foreach ($relativePath in $publicRootFiles) {
    $source = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
        throw "Required public file is missing: $relativePath"
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $destinationPath $relativePath)
}

foreach ($relativePath in $publicDirectories) {
    $source = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $source -PathType Container)) {
        throw "Required public directory is missing: $relativePath"
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $destinationPath $relativePath) -Recurse
}

# Documentation beside public assets is useful in source control but is not website content.
Get-ChildItem -LiteralPath $destinationPath -Recurse -File -Filter '*.md' | Remove-Item -Force

$forbiddenNames = @(
    'analytics-local.json',
    'analytics-local.example.json',
    'analytics-ga4-setup.json',
    'ANALYTICS.md',
    'DESKTOP_APP.md',
    'EDITORIAL_PLAYBOOK.md',
    'firebase.json',
    'package.json',
    'package-lock.json'
)
foreach ($name in $forbiddenNames) {
    if (Test-Path -LiteralPath (Join-Path $destinationPath $name)) {
        throw "Private release file was copied unexpectedly: $name"
    }
}

$forbiddenExtensions = @('.bin', '.chd', '.cso', '.dll', '.exe', '.gz', '.iso', '.md', '.pdb')
$forbiddenFiles = Get-ChildItem -LiteralPath $destinationPath -Recurse -File | Where-Object {
    $forbiddenExtensions -contains $_.Extension.ToLowerInvariant()
}
if ($forbiddenFiles) {
    throw "Forbidden files reached the static release: $($forbiddenFiles.FullName -join ', ')"
}

$serviceWorker = Get-Content -LiteralPath (Join-Path $destinationPath 'sw.js') -Raw
$assetMatches = [regex]::Matches($serviceWorker, "(?m)^\s*'(/[^']+)'")
foreach ($match in $assetMatches) {
    $asset = $match.Groups[1].Value.Split('?')[0]
    $assetRelative = if ($asset -eq '/') { 'index.html' } else { $asset.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar) }
    if (-not (Test-Path -LiteralPath (Join-Path $destinationPath $assetRelative) -PathType Leaf)) {
        throw "Service worker asset is missing from the release: $asset"
    }
}

$releaseFiles = Get-ChildItem -LiteralPath $destinationPath -Recurse -File
$releaseBytes = ($releaseFiles | Measure-Object -Property Length -Sum).Sum
Write-Output "Static release ready: $destinationPath"
Write-Output "Files: $($releaseFiles.Count)"
Write-Output "Size: $([math]::Round($releaseBytes / 1MB, 2)) MB"
