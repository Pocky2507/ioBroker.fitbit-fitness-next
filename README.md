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
Er basiert auf dem ursprünglichen Projekt von **@GermanBluefox** (*fitbit-api*)
und wurde von **Chris** sowie **Pocky2507** erweitert und modernisiert.

---

## 🧩 Voraussetzungen

Um den Adapter zu verwenden, benötigst du einen **Fitbit Developer Account**.

1. Besuche [https://dev.fitbit.com/apps/new](https://dev.fitbit.com/apps/new)
2. Melde dich mit deinem **normalen Fitbit-Konto** an.
3. Erstelle eine **neue App**:
   - Beliebiger Name (z. B. *ioBroker Fitbit Adapter*)
   - **Redirect URL:**
     `https://pocky2507.github.io/ioBroker.fitbit-fitness/getCode.html`
   - Berechtigungen aktivieren:
     *activity, heartrate, nutrition, profile, settings, sleep, weight*
4. Nach dem Speichern findest du:
   - **Client ID**
   - **Client Secret**
5. Trage diese Werte in den Adaptereinstellungen im ioBroker ein.

💡 Ohne gültige Client-ID und Secret ist keine Verbindung zu Fitbit möglich.

---

## ✨ Funktionen

- Liest Daten aus **Körper**, **Aktivitäten**, **Ernährung**, **Schlaf** und **Geräten**
- Frei wählbares **Abrufintervall** (in Minuten)
- **Intraday-Modus** für hochauflösende 1-Minuten-Daten
- **Schlafdaten nur einmal täglich** abrufbar (zwischen 20 – 22 Uhr)
- **Nickerchen-Verwaltung** (letztes/erstes Nickerchen, automatisches Leeren)
- **Frühschlaf-Filter** (ignoriert frühe Schlafphasen, z. B. vor 23:00)
- Moderne **OAuth2-Authentifizierung** über die Admin-Oberfläche
- Unterstützt **Compact-Mode** und **Cloud-Verbindung**

---

## ⚠️ Hinweise zum Abrufintervall

Fitbit limitiert API-Abfragen pro Stunde und Tag.
Ein zu kurzes Intervall (< 3 Minuten) kann **Fehler oder Sperren** verursachen.
Empfohlen: **mindestens 5 Minuten** Intervall.

Wenn du den Adapter nur einmal täglich die Schlafdaten laden lässt,
reduzierst du den API-Verbrauch erheblich.

---

## 💤 Schlafdatenverarbeitung

Fitbit berechnet Schlafphasen **mehrere Stunden nach dem Aufstehen**.
Daher sind die Daten am **Abend (20–22 Uhr)** am vollständigsten.

### Modi:
| Modus | Beschreibung | Empfehlung |
|-------|---------------|------------|
| **Regelmäßig** | Abruf bei jedem Intervall | Für unregelmäßigen Schlafrhythmus |
| **Einmal täglich (20–22 Uhr)** | Abruf nur abends | Für gleichmäßigen Schlaf und weniger API-Aufrufe |

💡 Wenn du morgens sofort Daten brauchst, deaktiviere *„Schlafaufzeichnung nur einmal täglich“*.

---

## 🌙 Frühschlaf-Filter (neu in v0.5.3)

Fitbit erkennt manchmal am Abend versehentlich „Schlafbeginn“.
Diese Abschnitte kannst du nun automatisch **ignorieren**:

| Einstellung | Beschreibung |
|-------------|---------------|
| **Frühe Schlafphasen ignorieren** | Aktiviert Filter für frühe Schlafabschnitte |
| **Schlaf ignorieren vor (HH:MM)** | Definiert die Uhrzeit, ab wann Schlaf als Nachtschlaf gilt (Standard: 23:00) |

💡 Beispiel:
Wenn du `23:00` einstellst, wird alles, was Fitbit vor 23 Uhr als Schlaf erkennt, **nicht** gezählt.

---

## 🕒 Nickerchen-Optionen

| Einstellung | Beschreibung |
|-------------|---------------|
| **Letztes oder erstes Nickerchen anzeigen** | true = letztes, false = erstes |
| **Nachts automatisch leeren** | Löscht Liste nach Mitternacht |
| **Tägliches Leeren aktivieren** | Leert Liste einmal pro Tag |
| **Leerungszeit (HH:MM)** | Uhrzeit für erzwungenes Leeren (z. B. 02:45) |

---

## ⚙️ Übersicht der Adapter-Einstellungen

| Schlüssel | Beschreibung |
|------------|--------------|
| `refresh` | Aktualisierungsintervall (Minuten) |
| `sleeprecordsschedule` | Schlafdaten nur einmal täglich abrufen |
| `intraday` | Intraday-Modus aktivieren |
| `showLastOrFirstNap` | Erstes/letztes Nickerchen anzeigen |
| `clearNapListAtNight` | Nickerchenliste nachts leeren |
| `enableDailyNapClear` | Tägliches Leeren aktivieren |
| `forceClearNapListTime` | Feste Leerungszeit (HH:MM) |
| `ignoreEarlyMainSleepEnabled` | Frühschlaffilter aktivieren |
| `ignoreEarlyMainSleepTime` | Uhrzeitgrenze für Frühschlaf |

---

## 🧾 Changelog

### **0.5.3 (2025-10-26)**
- Neuer **Frühschlaf-Filter** (konfigurierbare Uhrzeit)
- Verbesserte Schlaflogik
- Dokumentation & Übersetzungen aktualisiert

### 0.5.2
- Neue **Nickerchen-Optionen**
- Neuer **Intraday-Modus**
- Verbesserte Schlafdatenlogik

### 0.5.1
- Wartungsupdate

---

## 👨‍💻 Autoren

- **Chris** (<besterquester@live.at>) – ursprünglicher Entwickler
- **Pocky2507** – Fork & Erweiterungen (Nickerchen-Optionen, Intraday, Frühschlaf-Filter, neue Logik)

---

## 📜 Lizenz

MIT License
Copyright © 2025
**Chris & Pocky2507**

Software wird „wie besehen“ bereitgestellt, ohne Garantie.
Verwendung auf eigene Verantwortung.

---

# 🇬🇧 English Version

## 🩺 Fitbit Adapter for ioBroker

This adapter retrieves **Fitbit data** into ioBroker and provides structured datapoints.
Based on the original **fitbit-api** by *@GermanBluefox* and enhanced by **Chris** and **Pocky2507**.

---

## 🧩 Requirements

You need a **Fitbit Developer Account**:

1. Go to [https://dev.fitbit.com/apps/new](https://dev.fitbit.com/apps/new)
2. Log in with your **Fitbit account**
3. Create an app with:
   - Any name (e.g. *ioBroker Fitbit Adapter*)
   - Redirect URL:
     `https://pocky2507.github.io/ioBroker.fitbit-fitness/getCode.html`
   - Scopes: *activity, heartrate, nutrition, profile, settings, sleep, weight*
4. Copy **Client ID** and **Client Secret** into ioBroker config.

---

## ✨ Features

- Retrieves **body**, **activity**, **food**, **sleep**, and **device** data
- Custom **refresh interval** (minutes)
- **Intraday mode** for 1-minute heart-rate data
- **Once-per-day** sleep fetch (20–22 h)
- **Nap management** (show last/first nap, auto-clear)
- **Early-sleep filter** (ignore before defined time)
- Full **OAuth2 login** inside Admin UI
- Supports **compact mode** & **cloud connection**

---

## 💤 Sleep Handling

Fitbit finalizes sleep data only in the **afternoon/evening**.
Fetching between **20–22 h** ensures stable results.

---

## 🌙 Early Sleep Filter (v0.5.3)

Prevents Fitbit from counting early “dozing” as night sleep.

| Setting | Description |
|----------|--------------|
| **Ignore early sleep** | Enables early-sleep filter |
| **Ignore sleep before (HH:MM)** | Time cutoff (default 23:00) |

---

## 🕒 Nap Options

| Setting | Description |
|----------|--------------|
| **Show last/first nap** | true = last, false = first |
| **Clear nap list at night** | Clears list after midnight |
| **Enable daily clearing** | Clears once per day |
| **Force clear time** | e.g. 02:45 |

---

## 🧾 Changelog

### **0.5.3 (2025-10-26)**
- Added configurable early-sleep filter
- Improved sleep-data logic
- Updated docs & translations

---

## 👩‍💻 Authors

- **Chris** (<besterquester@live.at>) – original author
- **Pocky2507** – nap options, intraday mode, early-sleep filter

---

## 📄 License

MIT License
© 2025 Chris & Pocky2507
Software provided *as-is*, without warranty.
