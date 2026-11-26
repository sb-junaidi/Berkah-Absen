# Gabungkan core.js + gas-adapter.js menjadi dist/Code.gs untuk ditempel di Apps Script
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $here 'dist'
New-Item -ItemType Directory -Force $out | Out-Null
$core = Get-Content -Raw -Encoding UTF8 (Join-Path $here '..\core.js')
$gas = Get-Content -Raw -Encoding UTF8 (Join-Path $here 'gas-adapter.js')
$txt = "// ==== Berkah Absen - Code.gs (hasil build, jangan diedit langsung) ====`r`n" + $core + "`r`n" + $gas
[IO.File]::WriteAllText((Join-Path $out 'Code.gs'), $txt, (New-Object Text.UTF8Encoding $false))
Copy-Item (Join-Path $here 'appsscript.json') (Join-Path $out 'appsscript.json') -Force
Write-Output "OK -> $out\Code.gs"
