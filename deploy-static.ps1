[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'build-static.ps1')
if (-not $?) {
    throw 'Static build failed.'
}

$npx = (Get-Command npx.cmd -ErrorAction Stop).Source
& $npx firebase deploy --only hosting
if ($LASTEXITCODE -ne 0) {
    throw "Firebase deployment failed with exit code $LASTEXITCODE"
}
