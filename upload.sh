#!/bin/bash

GREEN="\e[32m"
YELLOW="\e[33m"
RED="\e[31m"
BLUE="\e[34m"
RESET="\e[0m"

echo -e "${BLUE}🚀 GitHub Upload wird ausgeführt...${RESET}"

echo -e "${BLUE}📂 Änderungen im Arbeitsverzeichnis:${RESET}"
git status -s
echo ""

# Änderungen erfassen
echo -e "${BLUE}📦 Hinzufügen von Änderungen (git add) ...${RESET}"
git add .

# Prüfen, ob es Änderungen gibt
if git diff --cached --quiet; then
    echo -e "${YELLOW}ℹ️ Keine Änderungen – nichts zu committen.${RESET}"
    exit 0
fi

# Commit Message (dein Wunschformat)
MSG="Update – $(date +"%Y-%m-%d %H:%M")"

echo -e "${BLUE}📝 Erstelle Commit:${RESET} ${GREEN}$MSG${RESET}"
git commit -m "$MSG"
echo ""

echo -e "${BLUE}🌐 Sende Änderungen zu GitHub (git push)...${RESET}"

if git push; then
    echo -e "${GREEN}✔ Push erfolgreich!${RESET}"
    echo -e "${GREEN}↪ Commit: ${YELLOW}$MSG${RESET}"
else
    echo -e "${RED}❌ Push fehlgeschlagen!${RESET}"
    echo -e "${YELLOW}👉 Prüfe Token, Internet oder GitHub.${RESET}"
    exit 1
fi

echo ""
echo -e "${BLUE}📊 Neuer Repository-Status:${RESET}"
git status -s

echo ""
echo -e "${GREEN}✨ Upload abgeschlossen!${RESET}"
