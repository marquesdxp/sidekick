@echo off
REM Sidekick - local install on Windows. Double-click this file.
REM Unsigned: CEP debug mode is turned on, which is what lets Premiere load a
REM panel without a certificate. It's a setting of yours, not the plugin's.
setlocal
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.andersonmarques.sidekick"

for %%v in (10 11 12 13) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul

if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
xcopy /e /i /y /q "%~dp0CSXS" "%DEST%\CSXS" >nul
xcopy /e /i /y /q "%~dp0css"  "%DEST%\css"  >nul
xcopy /e /i /y /q "%~dp0js"   "%DEST%\js"   >nul
xcopy /e /i /y /q "%~dp0i18n" "%DEST%\i18n" >nul
xcopy /e /i /y /q "%~dp0fonts" "%DEST%\fonts" >nul
copy /y "%~dp0host.jsx"   "%DEST%\" >nul
copy /y "%~dp0index.html" "%DEST%\" >nul
REM .debug opens the remote-debugging port (perf/perf.mjs) when PlayerDebugMode is on.
copy /y "%~dp0.debug"     "%DEST%\" >nul

echo.
echo Sidekick installed at:
echo   %DEST%
echo.
echo Restart Premiere Pro and open it from Window ^> Extensions ^> Sidekick.
pause
