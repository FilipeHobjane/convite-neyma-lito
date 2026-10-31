@echo off
rem Duplo clique para abrir o painel neste computador.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Falta instalar o Node.js: descarregue a versao LTS em https://nodejs.org e volte a tentar.
  pause
  exit /b 1
)
node --no-warnings scripts\setup.mjs
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8788/admin/"
echo Para terminar, feche esta janela.
node --no-warnings server\local.mjs
pause
