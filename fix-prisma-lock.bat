@echo off
REM Workaround for Prisma file lock on Windows
REM This script helps clear the locked query engine and regenerate Prisma Client

echo Attempting to fix Prisma Client lock...
echo.

REM Step 1: Stop any running Node processes (optional - uncomment if needed)
REM taskkill /F /IM node.exe 2>nul

REM Step 2: Wait a moment
timeout /t 2 /nobreak

REM Step 3: Try to clear npm cache
echo Clearing npm cache...
call npm cache clean --force 2>nul

REM Step 4: Remove node_modules/.prisma if possible
echo Attempting to remove .prisma directory...
for /d %%x in ("node_modules\.prisma") do (
    rmdir /s /q "%%x" 2>nul
)

REM Step 5: Reinstall with npm
echo Running npm install to regenerate Prisma Client...
call npm install

echo.
echo If the above completed successfully, run:
echo   npm run dev
echo.
echo If you still get file lock errors, you may need to:
echo   1. Close all editors/terminals using this project
echo   2. Restart your machine
echo   3. Use Process Explorer to find what's holding the query_engine-windows.dll.node file
