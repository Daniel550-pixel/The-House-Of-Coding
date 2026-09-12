$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

$apiCommand = "Set-Location '$root\apps\api'; npm run dev"
$webCommand = "Set-Location '$root\apps\web'; npm run dev"

Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $apiCommand
Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", $webCommand

Write-Host "API terminal started." -ForegroundColor Green
Write-Host "Web terminal started." -ForegroundColor Green
