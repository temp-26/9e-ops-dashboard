@echo off
setlocal
title Update 9E Dashboard
cd /d "%~dp0"
echo.
echo  ==========================================
echo    HR Workforce Intelligence - update
echo  ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed. Install the LTS version from https://nodejs.org, restart, and try again.
  goto end
)

if not exist "node_modules" (
  echo  First run: installing what the dashboard needs. This takes a minute...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto failed
)

if not exist "excel-path.txt" (
  echo  Which Excel should the dashboard use?
  echo  Open File Explorer, find your synced SharePoint Excel file,
  echo  DRAG the file into this window, then press Enter.
  echo.
  set /p XLPATH=  Excel file: 
  call echo %%XLPATH%%> excel-path.txt
  echo.
  echo  Saved. Next time it will use this file automatically.
  echo  To pick a different file, delete excel-path.txt in this folder.
  echo.
)

where git >nul 2>nul
if not errorlevel 1 git pull -q 2>nul

echo  Reading the Excel and encrypting the data...
echo  (You will be asked for the dashboard password - the characters show as *)
call npm run update-data --silent
if errorlevel 1 goto failed

where git >nul 2>nul
if errorlevel 1 goto desktop

echo.
echo  Publishing to GitHub...
git add -A
git commit -q -m "Dashboard update %date% %time%"
if errorlevel 1 (
  echo  No changes since the last update - nothing to publish.
  goto end
)
git push -q
if errorlevel 1 goto desktop
echo.
echo  DONE. The live dashboard will show the new numbers in about 2 minutes.
goto end

:desktop
echo.
echo  Data is ready. Now open GitHub Desktop, click "Commit to main", then "Push origin".
echo  (Install "Git for Windows" from https://git-scm.com to make this step automatic.)
goto end

:failed
echo.
echo  Something went wrong - see the message above. Send a screenshot if you need help.

:end
echo.
pause
