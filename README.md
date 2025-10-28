![Logo](admin/fitbit-fitness.png)
# ioBroker.fitbit-fitness
[![NPM version](https://img.shields.io/npm/v/iobroker.fitbit-fitness.svg)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
[![Anzahl Installationen (latest)](https://iobroker.live/badges/fitbit-fitness-installed.svg)](https://iobroker.live/badges/fitbit-fitness-installed.svg)
[![Downloads](https://img.shields.io/npm/dm/iobroker.fitbit-fitness)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
![Number of Installations (stable)](https://iobroker.live/badges/fitbit-fitness.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/Pocky2507/ioBroker.fitbit-fitness/badge.svg)](https://app.snyk.io/org/Pocky2507/ioBroker.fitbit-fitness)

[![NPM](https://nodei.co/npm/iobroker.fitbit-fitness.png?downloads=true)](https://nodei.co/npm/iobroker.fitbit-fitness/)

---

## 🩺 Fitbit Adapter für ioBroker (v0.5.5)

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

## ✨ Neue Funktionen in Version 0.5.5

- Neuer **kombinierter Frühschlaf- & SmartSleep-Filter**
- Lange Hauptschlafphasen **vor der Uhrzeitgrenze** werden **akzeptiert**
- Verbesserte Debug-Ausgabe bei Schlafanalyse
- Stabilitäts- und Logikoptimierungen
- Rückwärtskompatibel zu v0.5.4

---

## ⚙️ Hauptfunktionen

- Liest Daten aus **Körper**, **Aktivitäten**, **Ernährung**, **Schlaf** und **Geräten**
- Frei wählbares **Abrufintervall**
- **Intraday-Modus** für hochauflösende 1-Minuten-Daten
- **Nickerchen-Verwaltung** (erstes/letztes Nickerchen, automatisches Leeren)
- **Kombinierter Frühschlaf- und SmartSleep-Filter**
- **Debug-Modus** schaltbar in Admin
- Unterstützt **Compact-Mode** und **Cloud-Verbindung**

---

## 💤 Schlafdatenverarbeitung

Fitbit berechnet Schlafphasen **mehrere Stunden nach dem Aufstehen**.
Die Daten sind am **Abend (20–22 Uhr)** am vollständigsten.

| Modus | Beschreibung | Empfehlung |
|-------|---------------|------------|
| **Regelmäßig** | Abruf bei jedem Intervall | Für unregelmäßigen Schlafrhythmus |
| **Einmal täglich (20–22 Uhr)** | Abruf nur abends | Für gleichmäßigen Schlaf & weniger API-Aufrufe |

💡 Wenn du morgens sofort Daten brauchst, deaktiviere *„Schlafaufzeichnung nur einmal täglich“*.

---

## 🌙 Kombinierter Frühschlaf- & SmartSleep-Filter

Fitbit erkennt manchmal fälschlich frühe Ruhephasen als Schlafbeginn.
Dieser kombinierte Filter korrigiert das Verhalten intelligent.

| Einstellung | Beschreibung |
|--------------|--------------|
| **Frühe Schlafphasen ignorieren** | Aktiviert den Uhrzeit-Filter. Hauptschlafphasen, die **vor der eingestellten Zeit** beginnen, werden geprüft. |
| **Uhrzeitgrenze (HH:MM)** | Standard: 22:30 oder 23:00 Uhr |
| **Intelligente Frühschlaf-Erkennung (SmartSleep)** | Erkennt lange Schlafphasen automatisch und akzeptiert sie, selbst wenn sie vor der Grenze beginnen. |
| **Mindestdauer (Stunden)** | z. B. 3 h → Schlafphasen über 3 h werden als Hauptschlaf akzeptiert. Kürzere Phasen werden ignoriert. |

💡 Beispiel:
- Start 21:00 → Dauer 1 h → **wird ignoriert**
- Start 21:15 → Dauer 6 h → **wird akzeptiert** (SmartSleep)

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
| `ignoreEarlyMainSleepEnabled` | Frühschlaf-Filter aktivieren |
| `ignoreEarlyMainSleepTime` | Uhrzeitgrenze für Frühschlaf |
| `smartEarlySleepEnabled` | SmartSleep aktivieren |
| `minMainSleepHours` | Mindestdauer Hauptschlaf (Std.) |
| `debugEnabled` | Debug-Ausgabe aktivieren |

---

## 🧾 Changelog

### **0.5.5 (2025-10-28)**
- Kombinierter **Frühschlaf- & SmartSleep-Filter**
  → Lange Hauptschlafphasen vor Uhrzeitgrenze werden akzeptiert
- Verbesserte Debug-Ausgabe & Stabilität
- Kleine Logik- und Performance-Optimierungen

### **0.5.4 (2025-10-27)**
- Neuer **Debug- & Advanced Options-Tab**
- SmartSleep-Erkennung (Mindestdauer, z. B. 3 h)
- Verbesserte Hauptschlaf-Filterung
- Mehrsprachige UI-Anpassungen

### **0.5.3 (2025-10-26)**
- Neuer Frühschlaf-Filter (konfigurierbare Uhrzeit)
- Verbesserte Schlaflogik

### 0.5.2
- Neue Nickerchen-Optionen & Intraday-Modus
- Verbesserte Schlaflogik

### 0.5.1
- Wartungsupdate

---

## 👨‍💻 Autoren

- **Chris** (<besterquester@live.at>) – ursprünglicher Entwickler
- **Pocky2507** – Fork & Erweiterungen (Nickerchen, Intraday, SmartSleep, Frühschlaf, Debug)

---

## 📜 Lizenz

MIT License
© 2025 Chris & Pocky2507
Software wird „wie besehen“ bereitgestellt, ohne Garantie.
Verwendung auf eigene Verantwortung.

---

# 🇬🇧 English Version

## 🩺 Fitbit Adapter for ioBroker (v0.5.5)

This adapter retrieves **Fitbit data** into ioBroker and provides them as structured datapoints.
Based on the original **fitbit-api** by *@GermanBluefox*,
extended and modernized by **Chris** and **Pocky2507**.

---

## 🧩 Requirements

To use this adapter, you need a **Fitbit Developer Account**.

1. Visit [https://dev.fitbit.com/apps/new](https://dev.fitbit.com/apps/new)
2. Log in with your **regular Fitbit account**
3. Create a **new app**:
   - Any name (e.g. *ioBroker Fitbit Adapter*)
   - **Redirect URL:**
     `https://pocky2507.github.io/ioBroker.fitbit-fitness/getCode.html`
   - Enable permissions:
     *activity, heartrate, nutrition, profile, settings, sleep, weight*
4. After saving, copy:
   - **Client ID**
   - **Client Secret**
5. Enter both in the adapter configuration within ioBroker.

💡 Without a valid Client ID and Secret, no Fitbit connection is possible.

---

## ✨ New Features in Version 0.5.5

- Added **combined EarlySleep + SmartSleep filter**
- Long main-sleep blocks **before cutoff time** are now accepted
- Improved debug logging during sleep analysis
- Stability and logic improvements
- Fully backward compatible with v0.5.4

---

## ⚙️ Main Features

- Retrieves **body**, **activity**, **nutrition**, **sleep**, and **device** data
- Customizable **refresh interval**
- **Intraday mode** for 1-minute heart-rate data
- **Nap management** (first/last nap, automatic clearing)
- **Combined EarlySleep & SmartSleep filter**
- **Debug mode** toggle in admin panel
- Supports **compact mode** and **cloud connection**

---

## 💤 Sleep Data Processing

Fitbit finalizes sleep data **a few hours after waking up**.
Complete results are usually available **in the evening (8 – 10 PM)**.

| Mode | Description | Recommended for |
|------|--------------|----------------|
| **Regular** | Fetch sleep data on every interval | Irregular sleep patterns |
| **Once daily (8 – 10 PM)** | Fetch only in the evening | Regular sleepers & API efficiency |

💡 If you want instant morning data, disable *“fetch sleep once per day”*.

---

## 🌙 Combined EarlySleep & SmartSleep Filter

Fitbit sometimes interprets early evening rest as real sleep.
This combined logic now handles that gracefully.

| Setting | Description |
|----------|--------------|
| **Ignore early main sleep** | Activates the time-based filter. Main-sleep blocks starting **before the configured time** are checked. |
| **Cutoff time (HH:MM)** | Default: 22:30 or 23:00 |
| **Enable SmartSleep detection** | Automatically accepts long main-sleep periods, even if they start before cutoff. |
| **Minimum duration (hours)** | e.g. 3 h → main-sleep blocks longer than 3 h are accepted; shorter ones are ignored. |

💡 Example:
- Start 21:00 → duration 1 h → **ignored**
- Start 21:15 → duration 6 h → **accepted** (SmartSleep)

---

## 🕒 Nap Options

| Setting | Description |
|----------|--------------|
| **Show last or first nap** | true = last, false = first |
| **Clear naps at night** | Clears the list after midnight |
| **Enable daily nap clearing** | Clears once per day |
| **Forced clearing time (HH:MM)** | e.g. 02:45 AM |

---

## ⚙️ Adapter Configuration Overview

| Key | Description |
|------|--------------|
| `refresh` | Refresh interval (minutes) |
| `sleeprecordsschedule` | Fetch sleep data once daily |
| `intraday` | Enable 1-minute heart-rate data |
| `showLastOrFirstNap` | Show first/last nap |
| `clearNapListAtNight` | Clear naps during night |
| `enableDailyNapClear` | Enable daily clearing |
| `forceClearNapListTime` | Set fixed clearing time |
| `ignoreEarlyMainSleepEnabled` | Enable early sleep filter |
| `ignoreEarlyMainSleepTime` | Time cutoff (HH:MM) |
| `smartEarlySleepEnabled` | Enable SmartSleep filter |
| `minMainSleepHours` | Minimum main-sleep duration (h) |
| `debugEnabled` | Enable debug logging |

---

## 🧾 Changelog

### **0.5.5 (2025-10-28)**
- Added **combined EarlySleep & SmartSleep filter**
  → Long main-sleep blocks before cutoff are now accepted
- Enhanced debug logging & stability
- Small performance and logic optimizations

### **0.5.4 (2025-10-27)**
- Added **Debug & Advanced Options tab**
- SmartSleep detection with minimum threshold (e.g. 3 h)
- Improved main-sleep filtering
- UI & translation improvements

### **0.5.3 (2025-10-26)**
- New configurable EarlySleep filter
- Improved sleep logic

### 0.5.2
- Nap options & intraday mode
- Improved sleep logic

### 0.5.1
- Maintenance update

---

## 👨‍💻 Authors

- **Chris** (<besterquester@live.at>) – original author
- **Pocky2507** – nap handling, intraday mode, SmartSleep logic, EarlySleep integration and debug options

---

## 📜 License

MIT License
© 2025 Chris & Pocky2507
Software provided *as-is*, without warranty.
Use at your own risk.
