# Script de lancement de QueenMama pour Windows
# Ce script restaure, compile et lance l'application

Write-Host "=== Lancement de QueenMama Windows ===" -ForegroundColor Cyan
Write-Host ""

# Définir le chemin complet vers dotnet.exe
$dotnetExe = "C:\Program Files\dotnet\dotnet.exe"

# Vérifier .NET SDK
Write-Host "Vérification de .NET SDK..." -ForegroundColor Yellow
$dotnetVersion = & $dotnetExe --version
Write-Host ".NET SDK version: $dotnetVersion" -ForegroundColor Green
Write-Host ""

# Se placer dans le répertoire du projet
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "Répertoire de travail: $scriptDir" -ForegroundColor Yellow
Write-Host ""

# Restaurer les packages NuGet
Write-Host "Restauration des packages NuGet..." -ForegroundColor Yellow
& $dotnetExe restore
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la restauration des packages!" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}
Write-Host ""

# Compiler le projet
Write-Host "Compilation du projet..." -ForegroundColor Yellow
& $dotnetExe build --configuration Debug --no-restore
if ($LASTEXITCODE -ne 0) {
    Write-Host "Erreur lors de la compilation!" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}
Write-Host ""

# Lancer l'application
Write-Host "Lancement de l'application QueenMama..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

& $dotnetExe run --project src/QueenMama.App --no-build --configuration Debug
