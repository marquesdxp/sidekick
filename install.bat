@echo off
REM Sidekick - instalacion local en Windows. Doble clic sobre este fichero.
REM Sin firma: se activa el modo depuracion de CEP, que es lo que permite a
REM Premiere cargar un panel sin certificado. Es un ajuste tuyo, no del plugin.
setlocal
set "DEST=%APPDATA%\Adobe\CEP\extensions\com.andersonmarques.sidekick"

for %%v in (10 11 12 13) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul

if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
xcopy /e /i /y /q "%~dp0CSXS" "%DEST%\CSXS" >nul
xcopy /e /i /y /q "%~dp0css"  "%DEST%\css"  >nul
xcopy /e /i /y /q "%~dp0js"   "%DEST%\js"   >nul
xcopy /e /i /y /q "%~dp0i18n" "%DEST%\i18n" >nul
copy /y "%~dp0host.jsx"   "%DEST%\" >nul
copy /y "%~dp0index.html" "%DEST%\" >nul

echo.
echo Sidekick instalado en:
echo   %DEST%
echo.
echo Reinicia Premiere Pro y abrelo en Ventana ^> Extensiones ^> Sidekick.
pause
