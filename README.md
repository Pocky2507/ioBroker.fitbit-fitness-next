![Logo](admin/fitbit-fitness.png)
# ioBroker.fitbit-fitness
[![NPM version](https://img.shields.io/npm/v/iobroker.fitbit-fitness.svg)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
[![Anzahl Installationen (latest)](https://iobroker.live/badges/fitbit-fitness-installed.svg)](https://iobroker.live/badges/fitbit-fitness-installed.svg)
[![Downloads](https://img.shields.io/npm/dm/iobroker.fitbit-fitness)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
![Number of Installations (stable)](https://iobroker.live/badges/fitbit-fitness.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/Pocky2507/ioBroker.fitbit-fitness/badge.svg)](https://app.snyk.io/org/Pocky2507/ioBroker.fitbit-fitness)

[![NPM](https://nodei.co/npm/iobroker.fitbit-fitness.png?downloads=true)](https://nodei.co/npm/iobroker.fitbit-fitness/)

---

## 🩺 Fitbit Adapter für ioBroker

Dieser Adapter ruft **Fitbit-Daten** in ioBroker ab und stellt sie strukturiert als Datenpunkte bereit.  
Er basiert auf dem ursprünglichen Projekt von **@GermanBluefox** (*fitbit-api*, vielen Dank!)  
und wurde von **Chris** sowie **Pocky2507** erweitert und modernisiert.

---

## 🧩 Voraussetzungen

Um den Adapter zu verwenden, benötigst du einen **Fitbit Developer Account**.

1. Besuche [https://dev.fitbit.com/apps/new](https://dev.fitbit.com/apps/new)
2. Melde dich mit deinem **normalen Fitbit-Konto** an.
3. Erstelle eine **neue App**:
   - Trage einen beliebigen Namen ein (z. B. *ioBroker Fitbit Adapter*).
   - Gib als **Redirect URL** den Wert aus der Adapter-Konfiguration an (Standard:  
     `https://pocky2507.github.io/ioBroker.fitbit-fitness/getCode.html`)
   - Aktiviere die Berechtigungen:  
     *activity, heartrate, nutrition, profile, settings, sleep, weight*
4. Nach dem Speichern findest du in deinem Dashboard:
   - **Client ID**
   - **Client Secret**
5. Trage diese Werte im ioBroker-Adapter unter  
   **Client ID** und **Client Secret** ein.

💡 **Hinweis:** Ohne Developer-Account und gültige ID/Secret kann keine Verbindung zu Fitbit hergestellt werden.

---

## ✨ Funktionen

- Liest Daten aus den Bereichen **Körper**, **Aktivitäten**, **Lebensmittel**, **Schlaf** und **Geräte**
- Frei wählbares **Abrufintervall** (in Minuten)  
  ⚠️ **Hinweis zum Abrufintervall:**  
  Die Fitbit-API erlaubt nur eine begrenzte Anzahl an Abfragen pro Stunde und Tag.  
  Ein zu kurzes Intervall (z. B. unter 2–3 Minuten) kann zu **API-Fehlern oder temporären Sperren** führen.  
  Empfohlen wird ein Intervall von **mindestens 5 Minuten**, um zuverlässig Daten zu erhalten.  
  ▲ Die Option *„Schlafdaten nur einmal täglich“* entfällt, wenn das Intervall mindestens 5 Minuten beträgt – dann kann der reguläre Abruf genutzt werden.
- Option, **Schlafdaten nur einmal täglich** zu laden (zur Reduzierung der API-Aufrufe)
- **Nickerchen-Verwaltung (Nap Management)**  
  - Letztes oder erstes Nickerchen anzeigen  
  - Nickerchen-Liste nachts oder zu einer festen Uhrzeit automatisch leeren  
- **Intraday-Modus** (aktiviert den Abruf hochauflösender Minutendaten)
- Moderne **OAuth2-Authentifizierung** direkt über die Admin-Oberfläche
- Unterstützt **Compact-Mode** und **Cloud-Verbindung**

---

## 💤 Verarbeitung von Schlafdaten (Warum der Abruf abends erfolgt)

Fitbit verarbeitet Schlafdaten erst **mehrere Stunden nach dem Aufstehen** vollständig.  
Während Schritte oder Puls sofort sichtbar sind, werden die finalen Schlafphasen und Gesamtdauern  
erst im Laufe des Tages auf den Fitbit-Servern berechnet.

Der Adapter bietet dafür zwei Optionen:

| Modus | Beschreibung | Empfohlen für |
|--------|---------------|----------------|
| **Regelmäßiger Abruf** | Schlafdaten werden bei jedem normalen Aktualisierungsintervall (z. B. alle 5 Minuten) mit abgerufen. | Nutzer mit unregelmäßigem oder spätem Schlafrhythmus |
| **Einmal täglich (20–22 Uhr)** | Der Adapter ruft die Schlafdaten nur einmal täglich zwischen **20:00 und 22:00 Uhr** ab. Zu diesem Zeitpunkt sind die Werte der letzten Nacht vollständig und stabil. | Nutzer mit regelmäßigem Schlaf oder geringem API-Verbrauch |

🧠 **Warum 20–22 Uhr?**  
Fitbit stellt endgültige Schlafdaten erst am Nachmittag oder Abend bereit.  
Ein Abruf am Morgen kann unvollständige oder doppelte Einträge liefern.  
Mit dem abendlichen Zeitfenster sind die Daten vollständig und konsistent.

💡 **Tipp:**  
Wenn du nach dem Aufstehen sofort aktuelle Schlafdaten sehen möchtest,  
deaktiviere die Option *„Schlafaufzeichnung nur einmal am Tag“*.  
Dann werden die Werte im normalen Intervall regelmäßig abgerufen.

---

## 🕒 Nickerchen-Optionen

| Einstellung | Beschreibung |
|--------------|---------------|
| **Letztes oder erstes Nickerchen anzeigen** | Zeigt entweder das erste oder das letzte Nickerchen des Tages an. |
| **Nickerchen-Liste nachts automatisch leeren** | Leert die Liste nach Mitternacht automatisch, um alte Einträge zu vermeiden. |
| **Tägliches Leeren aktivieren** | Leert die Nickerchen-Liste einmal täglich zu einer definierten Zeit. |
| **Leerungszeit (HH:MM)** | Uhrzeit, zu der die Nickerchen-Liste erzwungenermaßen geleert wird (z. B. 02:45). |

---

## ⚙️ Übersicht der Adapter-Einstellungen

| Einstellung | Beschreibung |
|--------------|---------------|
| `refresh` | Aktualisierungsintervall in Minuten |
| `sleeprecordsschedule` | Schlafdaten nur einmal täglich abrufen (20–22 Uhr) |
| `showLastOrFirstNap` | Letztes oder erstes Nickerchen anzeigen |
| `clearNapListAtNight` | Nickerchen-Liste nachts automatisch leeren |
| `enableDailyNapClear` | Tägliches Leeren der Nickerchen-Liste aktivieren |
| `forceClearNapListTime` | Feste Leerungszeit der Liste (HH:MM) |
| `intraday` | Aktiviert den Abruf von Intraday-Daten (Minutenauflösung) |

---

## 🪲 Bekannte Probleme

Zurzeit sind keine Probleme bekannt.  

---

## 📜 Changelog

### **0.5.2 (2025-10-26)**
- Neue konfigurierbare Nickerchen-Optionen  
- Neuer Intraday-Modus  
- Verbesserte Verarbeitung der Schlafdaten und Dokumentation  

### 0.5.1
- Wartungs-Update

*(Ältere Änderungen siehe im [Original-Repository](https://github.com/Chris-656/ioBroker.fitbit-fitness))*  

---

## 👨‍💻 Autoren

- **Chris** (<besterquester@live.at>) – ursprünglicher Entwickler  
- **Pocky2507** – Fork & Erweiterungen (Nickerchen-Optionen, Intraday, neue Logik)

---

## 📄 Lizenz

MIT License  
Copyright (c) 2025 Chris & Pocky2507  

Die Software wird „wie besehen“ bereitgestellt, ohne Garantie jeglicher Art.  
Nutzung auf eigene Verantwortung.

---

---

# 🇬🇧 English Version

## FITBIT Adapter for ioBroker

This adapter retrieves **Fitbit data** into ioBroker and provides it as structured datapoints.  
It is based on the original project by **@GermanBluefox** (*fitbit-api*, many thanks!)  
and has been extended and modernized by **Chris** and **Pocky2507**.

---

## 🧩 Requirements

To use this adapter, you need a **Fitbit Developer Account**.

1. Visit [https://dev.fitbit.com/apps/new](https://dev.fitbit.com/apps/new)
2. Log in using your **regular Fitbit account**.
3. Create a **new app**:
   - Enter any name (e.g. *ioBroker Fitbit Adapter*).
   - Use the **Redirect URL** from the adapter configuration (default:  
     `https://pocky2507.github.io/ioBroker.fitbit-fitness/getCode.html`)
   - Enable permissions:  
     *activity, heartrate, nutrition, profile, settings, sleep, weight*
4. After saving, you will find:
   - **Client ID**
   - **Client Secret**
5. Enter these values into the ioBroker adapter configuration.

💡 **Note:** Without a valid Developer Account, Client ID and Secret, the adapter cannot connect to Fitbit.

---

## ✨ Features

- Retrieves **Body**, **Activity**, **Food**, **Sleep**, and **Device** data  
- Customizable **refresh interval** (in minutes)  
  ⚠️ **API Rate Limit Warning:**  
  The Fitbit API allows only a limited number of requests per hour and per day.  
  Setting the interval too low (e.g., below 2–3 minutes) may lead to **API errors or temporary blocking**.  
  A **minimum of 5 minutes** is recommended for reliable data retrieval.  
  ▲ The *“once-per-day sleep record”* option is ignored when the interval is at least 5 minutes, since regular updates are sufficient.  
- Optional **once-per-day sleep record retrieval** (to reduce API calls)
- **Nap Management**  
  - Show last or first nap  
  - Automatically clear nap list at night or at a defined time  
- **Intraday mode** for minute-level detailed data
- Modern **OAuth2 authentication** directly via Admin UI
- Supports **compact mode** and **cloud connection**

---

## 💤 Sleep Data Handling (Why 20–22 h)

Fitbit finalizes sleep data **several hours after waking up**.  
While steps and heart rate are updated instantly, the final sleep phases and totals  
are only available later in the day.

The adapter provides two modes:

| Mode | Description | Recommended for |
|------|--------------|-----------------|
| **Regular refresh** | Sleep data is retrieved during every normal update interval (e.g. every 5 minutes). | Users with irregular or late sleep schedules |
| **Once per day (20–22 h)** | Retrieves sleep data once a day between **20:00 and 22:00**, when the data is complete and stable. | Users with regular sleep or reduced API usage |

🧠 **Why 20–22 h?**  
Fitbit finalizes sleep data in the afternoon or evening.  
Fetching in the morning may return incomplete or duplicate entries.  
The evening window ensures complete and consistent results.

💡 **Tip:**  
If you want to see sleep data right after waking up,  
disable the *“once-per-day sleep record”* option to update sleep data continuously.

---

## 🕒 Nap Options

| Setting | Description |
|----------|--------------|
| **Show last or first nap** | Displays either the first or last nap of the day. |
| **Automatically clear nap list at night** | Clears the list after midnight to remove old entries. |
| **Enable daily clearing** | Clears the nap list daily at a defined time. |
| **Clear time (HH:MM)** | Time at which the nap list will be forcibly cleared (e.g. 02:45). |

---

## ⚙️ Adapter Settings Overview

| Setting | Description |
|----------|--------------|
| `refresh` | Refresh interval in minutes |
| `sleeprecordsschedule` | Retrieve sleep data once per day (20–22 h) |
| `showLastOrFirstNap` | Show last or first nap |
| `clearNapListAtNight` | Automatically clear nap list at night |
| `enableDailyNapClear` | Enable daily clearing of nap list |
| `forceClearNapListTime` | Fixed clear time (HH:MM) |
| `intraday` | Enable intraday (minute-level) data retrieval |

---

## 🪲 Known Issues

Currently, no known issues.  

---

## 🧾 Changelog

### **0.5.2 (2025-10-26)**
- Added configurable nap options  
- Added intraday mode  
- Improved sleep data handling and documentation  

### 0.5.1
- Maintenance update  

*(Older changes see in [Original Repository](https://github.com/Chris-656/ioBroker.fitbit-fitness))*  

---

## 👩‍💻 Authors

- **Chris** (<besterquester@live.at>) – original developer  
- **Pocky2507** – fork & extensions (nap options, intraday, new logic)

---

## 📜 License

MIT License  
Copyright (c) 2025 Chris & Pocky2507  
Software provided "as is", without warranty of any kind.
