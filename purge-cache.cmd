@echo off
rem Purge the Cloudflare edge cache for ravenstaging.co.uk - run after every deploy.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0purge-cache.ps1"
