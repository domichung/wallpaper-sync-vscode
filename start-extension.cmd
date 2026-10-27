@echo off
call code.cmd --new-window --user-data-dir "%~dp0.dev-runtime\user-data" --extensions-dir "%~dp0.dev-runtime\extensions" --disable-extensions --extensionDevelopmentPath="%~dp0."
