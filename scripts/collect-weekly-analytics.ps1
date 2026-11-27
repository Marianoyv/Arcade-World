$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$configPath = Join-Path $projectRoot 'analytics-local.json'
$config = if (Test-Path -LiteralPath $configPath) {
    Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
} else {
    $null
}

$pythonPath = if ($env:ARCADE_ANALYTICS_PYTHON) {
    $env:ARCADE_ANALYTICS_PYTHON
} elseif ($config -and $config.python_path) {
    [string]$config.python_path
} else {
    'python'
}

if (-not (Get-Command $pythonPath -ErrorAction SilentlyContinue)) {
    throw "No se encontro Python. Configura python_path en analytics-local.json."
}

$propertyId = if ($env:GA4_PROPERTY_ID) {
    $env:GA4_PROPERTY_ID
} elseif ($config -and $config.ga4_property_id) {
    [string]$config.ga4_property_id
} else {
    ''
}
if ($propertyId -notmatch '^\d+$') {
    throw 'Falta el ID numerico de la propiedad GA4 en GA4_PROPERTY_ID o analytics-local.json.'
}

$searchConsoleSite = if ($env:SEARCH_CONSOLE_SITE_URL) {
    $env:SEARCH_CONSOLE_SITE_URL
} elseif ($config -and $config.search_console_site_url) {
    [string]$config.search_console_site_url
} else {
    'https://arcade-world.web.app/'
}

if (-not $env:GOOGLE_APPLICATION_CREDENTIALS -and $config -and $config.credentials_path) {
    $credentialPath = [string]$config.credentials_path
    if (-not [System.IO.Path]::IsPathRooted($credentialPath)) {
        $credentialPath = Join-Path $projectRoot $credentialPath
    }
    if (-not (Test-Path -LiteralPath $credentialPath -PathType Leaf)) {
        throw "No se encontro la credencial de solo lectura: $credentialPath"
    }
    $env:GOOGLE_APPLICATION_CREDENTIALS = [System.IO.Path]::GetFullPath($credentialPath)
}

$runDate = Get-Date -Format 'yyyy-MM-dd'
$weeklyRoot = Join-Path $projectRoot 'analytics\weekly'
$runRoot = Join-Path $weeklyRoot $runDate
$sevenDayOutput = Join-Path $runRoot '7d'
$twentyEightDayOutput = Join-Path $runRoot '28d'
$importer = Join-Path $projectRoot 'scripts\import-analytics.py'
$previousMetadataPath = Join-Path $weeklyRoot 'latest-data.json'
$previousMetadata = if (Test-Path -LiteralPath $previousMetadataPath) {
    Get-Content -Raw -LiteralPath $previousMetadataPath | ConvertFrom-Json
} else { $null }

New-Item -ItemType Directory -Path $runRoot -Force | Out-Null
$env:GA4_PROPERTY_ID = $propertyId
$env:SEARCH_CONSOLE_SITE_URL = $searchConsoleSite

function Invoke-AnalyticsImport {
    param(
        [int]$Days,
        [string]$Output,
        [switch]$SkipGa4,
        [switch]$SkipSearchConsole
    )

    $arguments = @($importer, '--days', [string]$Days, '--output-dir', $Output)
    if ($SkipGa4) { $arguments += '--skip-ga4' }
    if ($SkipSearchConsole) { $arguments += '--skip-search-console' }
    & $pythonPath @arguments | Out-Host
    return $LASTEXITCODE
}

Push-Location $projectRoot
try {
    $ga4SevenStatus = Invoke-AnalyticsImport -Days 7 -Output (Join-Path $sevenDayOutput 'ga4') -SkipSearchConsole
    $ga4TwentyEightStatus = if ($ga4SevenStatus -eq 0) {
        Invoke-AnalyticsImport -Days 28 -Output (Join-Path $twentyEightDayOutput 'ga4') -SkipSearchConsole
    } else { 1 }
    $ga4Status = if ($ga4SevenStatus -eq 0 -and $ga4TwentyEightStatus -eq 0) { 'available' } else { 'unavailable' }
    if ($ga4Status -ne 'available') {
        Write-Warning 'GA4 no esta disponible. Se conservaran las ultimas metricas completas, identificadas como anteriores.'
    }

    $searchConsoleStatus = 'available'
    $searchSevenStatus = Invoke-AnalyticsImport -Days 7 -Output (Join-Path $sevenDayOutput 'search-console') -SkipGa4
    if ($searchSevenStatus -ne 0) {
        $searchConsoleStatus = 'unavailable'
        Write-Warning 'Search Console no esta disponible. Se conservara la ultima captura, si existe.'
    } else {
        $searchTwentyEightStatus = Invoke-AnalyticsImport -Days 28 -Output (Join-Path $twentyEightDayOutput 'search-console') -SkipGa4
        if ($searchTwentyEightStatus -ne 0) {
            $searchConsoleStatus = 'partial'
            Write-Warning 'Search Console de 28 dias fallo. Se conserva la ventana de 7 dias.'
        }
    }
} finally {
    Pop-Location
}

function Resolve-Summary {
    param([string]$Current, [string]$Previous)
    if (Test-Path -LiteralPath $Current -PathType Leaf) { return $Current }
    if ($Previous -and (Test-Path -LiteralPath $Previous -PathType Leaf)) { return $Previous }
    return $null
}

$ga4SevenSummary = Resolve-Summary (Join-Path $sevenDayOutput 'ga4\summary.md') $previousMetadata.seven_day_ga4_summary
$ga4TwentyEightSummary = Resolve-Summary (Join-Path $twentyEightDayOutput 'ga4\summary.md') $previousMetadata.twenty_eight_day_ga4_summary
$searchSevenSummary = Resolve-Summary (Join-Path $sevenDayOutput 'search-console\summary.md') $previousMetadata.seven_day_search_summary
$searchTwentyEightSummary = Resolve-Summary (Join-Path $twentyEightDayOutput 'search-console\summary.md') $previousMetadata.twenty_eight_day_search_summary

$metadata = [ordered]@{
    generated_on = $runDate
    ga4_status = $ga4Status
    search_console_status = $searchConsoleStatus
    seven_day_ga4_summary = $ga4SevenSummary
    twenty_eight_day_ga4_summary = $ga4TwentyEightSummary
    seven_day_search_summary = $searchSevenSummary
    twenty_eight_day_search_summary = $searchTwentyEightSummary
    ga4_snapshot_date = if ($ga4Status -eq 'available') { $runDate } elseif ($previousMetadata.ga4_snapshot_date) { $previousMetadata.ga4_snapshot_date } elseif ($previousMetadata) { $previousMetadata.generated_on } else { $null }
    seven_day_data = if ($ga4Status -eq 'available') { $sevenDayOutput } elseif ($ga4SevenSummary) { Split-Path -Parent (Split-Path -Parent $ga4SevenSummary) } else { $null }
    twenty_eight_day_data = if ($ga4Status -eq 'available') { $twentyEightDayOutput } elseif ($ga4TwentyEightSummary) { Split-Path -Parent (Split-Path -Parent $ga4TwentyEightSummary) } else { $null }
}
New-Item -ItemType Directory -Path $weeklyRoot -Force | Out-Null
$metadata | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $weeklyRoot 'latest-data.json') -Encoding utf8

Write-Output "Weekly analytics ready: $runRoot"
