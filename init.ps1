$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = 'C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$server = Join-Path $projectRoot 'scripts\serve-workbench.mjs'

if (-not (Test-Path -LiteralPath $node)) {
    throw "Bundled Node.js not found: $node"
}

& $node --check (Join-Path $projectRoot 'scripts\serve-workbench.mjs')
& $node --check (Join-Path $projectRoot 'workbench-ui\app.js')
Write-Output 'Harness checks passed.'
Write-Output 'Start workbench with: node scripts\serve-workbench.mjs'
Write-Output 'Open: http://127.0.0.1:4188'
