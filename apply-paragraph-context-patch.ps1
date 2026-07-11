$ErrorActionPreference = "Stop"

$RepoRoot = (Get-Location).Path
$ScriptPath = Join-Path $PSScriptRoot "rebuild-grey-book-paragraph-context.py"
$ContextPath = Join-Path $RepoRoot "data\grey-book-context.json"
$PdfPath = Join-Path $RepoRoot "literature\grey-book-memphis-1981-review-form.pdf"
$AppPath = Join-Path $RepoRoot "js\app.js"

Write-Host "GBRNA complete-paragraph source patch" -ForegroundColor Cyan
Write-Host "Repository: $RepoRoot"

$Missing = @()
foreach ($Path in @($ContextPath, $PdfPath, $AppPath, $ScriptPath)) {
    if (-not (Test-Path $Path)) {
        $Missing += $Path
    }
}

if ($Missing.Count -gt 0) {
    Write-Host "" 
    Write-Host "Missing required files:" -ForegroundColor Red
    $Missing | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    Write-Host "Extract both patch files into the GBRNA repository root, then run this command there:" 
    Write-Host ".\apply-paragraph-context-patch.ps1" -ForegroundColor Yellow
    exit 1
}

py -c "import fitz" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Installing PyMuPDF…" -ForegroundColor Yellow
    py -m pip install pymupdf
}

Write-Host "Rebuilding Grey Book contexts around complete paragraphs…" -ForegroundColor Cyan
py $ScriptPath --root $RepoRoot
if ($LASTEXITCODE -ne 0) {
    throw "The paragraph-context rebuild failed. Your backup files were preserved."
}

Write-Host ""
Write-Host "Patch complete." -ForegroundColor Green
Write-Host "Review the changed files with:" -ForegroundColor Cyan
Write-Host "git diff -- data/grey-book-context.json js/app.js" -ForegroundColor Yellow
Write-Host ""
Write-Host "Then test locally with:" -ForegroundColor Cyan
Write-Host "py -m http.server 8000" -ForegroundColor Yellow
Write-Host "Open: http://localhost:8000" 
