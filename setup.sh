#!/bin/bash

BLUE="\e[34m"
GREEN="\e[32m"
RED="\e[31m"
YELLOW="\e[33m"
RESET="\e[0m"

echo -e "${BLUE}🔧 GitHub Setup wird gestartet...${RESET}"

# Prüfen ob Git installiert ist
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git ist nicht installiert!${RESET}"
    exit 1
fi

# Prüfen ob Ordner ein Git-Repository ist
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}⚠️  Dieser Ordner ist noch kein Git-Repository.${RESET}"
    read -p "Möchtest du 'git init' ausführen? (j/n): " yn
    if [[ "$yn" =~ ^[Jj]$ ]]; then
        git init
        echo -e "${GREEN}✔ Git-Repository erstellt.${RESET}"
    else
        echo -e "${RED}❌ Abgebrochen.${RESET}"
        exit 1
    fi
fi

# GitHub-URL abfragen
read -p "🔗 Bitte deine GitHub-Repo-URL eingeben: " GHURL

# origin setzen (neu oder ersetzen)
git remote remove origin &> /dev/null
git remote add origin "$GHURL"

echo -e "${GREEN}✔ GitHub Remote gesetzt:${RESET} $GHURL"

# Token speichern
echo -e "${BLUE}🔐 GitHub Login wird automatisch gespeichert...${RESET}"
git config --global credential.helper store

echo -e "${YELLOW}ℹ️ Beim nächsten 'git push' wirst du einmalig nach Username & Token gefragt.${RESET}"
echo -e "${YELLOW}   Danach speichert Git alles automatisch und du musst NIE wieder eingeben.${RESET}"

echo -e "${GREEN}✔ Setup abgeschlossen!${RESET}"
