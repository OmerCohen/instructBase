@echo off
rem Starts the editor on http://localhost:8765/ (this computer only). See README.md.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
