@echo off
title ClassClash Server
echo Starting ClassClash on http://localhost:3000 ...
start "" http://localhost:3000
npm.cmd run dev
pause
