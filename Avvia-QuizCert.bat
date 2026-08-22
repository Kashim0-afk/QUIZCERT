@echo off
REM Avvia QuizCert in locale (serve un server: aprire index.html col doppio click NON funziona)
cd /d "%~dp0"
echo Avvio QuizCert su http://localhost:8000 ...
start "" http://localhost:8000
python -m http.server 8000
