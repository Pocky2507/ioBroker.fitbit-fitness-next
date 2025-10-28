![Logo](admin/fitbit-fitness.png)
# ioBroker.fitbit-fitness
[![NPM version](https://img.shields.io/npm/v/iobroker.fitbit-fitness.svg)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
[![Anzahl Installationen (latest)](https://iobroker.live/badges/fitbit-fitness-installed.svg)](https://iobroker.live/badges/fitbit-fitness-installed.svg)
[![Downloads](https://img.shields.io/npm/dm/iobroker.fitbit-fitness)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
![Number of Installations (stable)](https://iobroker.live/badges/fitbit-fitness.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/Pocky2507/ioBroker.fitbit-fitness/badge.svg)](https://app.snyk.io/org/Pocky2507/ioBroker.fitbit-fitness)

[![NPM](https://nodei.co/npm/iobroker.fitbit-fitness.png?downloads=true)](https://nodei.co/npm/iobroker.fitbit-fitness/)

---

## 🩺 ioBroker Fitbit Adapter (v0.5.5)

Dieser Adapter ruft **Fitbit-Daten** in ioBroker ab und stellt sie als strukturierte Datenpunkte bereit.
Er basiert auf dem ursprünglichen Projekt von **@GermanBluefox** (*fitbit-api*)
und wurde von **Chris** sowie **Pocky2507** umfassend erweitert und modernisiert.

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

- Neuer **kombinierter Echtzeit-Frühschlaf- & SmartSleep-Filter**
- Erkennt automatisch, wenn die aktuelle Uhrzeit **vor der eingestellten Nachtschlaf-Grenze** liegt (z. B. 22:30 Uhr)
- Lange Hauptschlafphasen **vor der Uhrzeitgrenze** werden jetzt **intelligent akzeptiert**
- Verbesserte Debug-Ausgabe bei der Schlafanalyse
- Stabilitäts- und Logik-Optimierungen in der Echtzeit-Schlafauswertung
- Erweiterte **Nickerchen-Summen** (Gesamtschlaf inkl. Naps, getrennt von Nachtschlaf)
- Rückwärtskompatibel zu v0.5.4

---

## ⚙️ Hauptfunktionen

- Liest Daten aus **Körper**, **Aktivitäten**, **Ernährung**, **Schlaf** und **Geräten**
- Frei wählbares **Abrufintervall**
- **Intraday-Modus** für hochauflösende 1-Minuten-Herzfrequenzdaten
- **Nickerchen-Verwaltung** (erstes/letztes Nickerchen, automatisches Leeren)
- **Kombinierter EarlySleep & SmartSleep-Filter** mit Echtzeitprüfung
- **Debug-Modus** schaltbar im Admin-Panel
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

## 🌙 Kombinierter Frühschlaf- & SmartSleep-Filter (Realtime)

Fitbit erkennt manchmal fälschlich frühe Ruhephasen als Hauptschlaf.
Der neue kombinierte Filter verbindet:
1. eine **Echtzeit-Prüfung** der aktuellen Uhrzeit und
2. eine **intelligente SmartSleep-Analyse** der Schlafdauer.

| Einstellung | Beschreibung |
|--------------|--------------|
| **Frühschlaf ignorieren** | Aktiviert den Uhrzeit-Filter. Schlafphasen, die **vor der Grenze** beginnen, werden geprüft. |
| **Uhrzeitgrenze (HH:MM)** | Standard: 22:30 oder 23:00 Uhr |
| **SmartSleep aktivieren** | Akzeptiert lange Schlafphasen auch vor der Grenze. |
| **Mindestdauer (Stunden)** | z. B. 3 → Schlafphasen über 3 h gelten als Hauptschlaf. |

💡 Beispiele:
- Start 21:00 → Dauer 1 h → **ignoriert**
- Start 21:15 → Dauer 6 h → **akzeptiert** (SmartSleep)
- Aktuelle Zeit 20:30 < Grenze 23:00 → **Nachtschlaf-Analyse wird übersprungen**

---

## 🕒 Nickerchen-Optionen

| Einstellung | Beschreibung |
|--------------|--------------|
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
- Kombinierter **Echtzeit-Frühschlaf- & SmartSleep-Filter**
  → Verbindet Uhrzeitprüfung und intelligente Schlafdauer-Analyse
- Lange Hauptschlafphasen vor der Grenze werden akzeptiert
- Verbesserte Debug-Ausgabe und Stabilität
- Erweiterte Nap-Summen und Gesamtschlaf-Datenpunkte
- Leichte Performance-Optimierungen

### **0.5.4 (2025-10-27)**
- Neuer Debug- & Advanced-Options-Tab
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
- **Pocky2507** – Fork & Erweiterungen (Nickerchen, Intraday, SmartSleep, Frühschlaf, Realtime-Filter, Debug)

---

## 📜 Lizenz

MIT License
© 2025 Chris & Pocky2507
Software wird „wie besehen“ bereitgestellt, ohne Garantie.
Verwendung auf eigene Verantwortung.

---

# 🇬🇧 English Version

## 🩺 Fitbit Adapter for ioBroker (v0.5.5)

This adapter retrieves **Fitbit data** into ioBroker and provides structured datapoints.
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
   - Enable permissions: *activity, heartrate, nutrition, profile, settings, sleep, weight*
4. After saving, copy:
   - **Client ID**
   - **Client Secret**
5. Enter both in the adapter configuration in ioBroker.

💡 Without a valid Client ID and Secret, no Fitbit connection is possible.

---

## ✨ New Features in Version 0.5.5

- Added **combined real-time EarlySleep & SmartSleep filter**
- If the current time is before the configured cutoff (e.g. 22:30), night sleep analysis is temporarily skipped
- Long main-sleep blocks starting before cutoff are **automatically accepted** via SmartSleep
- Improved debug logging and stability of sleep logic
- Added **total sleep and nap summary states**
- Backward compatible with v0.5.4

---

## ⚙️ Main Features

- Retrieves **body**, **activity**, **nutrition**, **sleep**, and **device** data
- Configurable **refresh interval**
- **Intraday mode** for 1-minute heart-rate data
- **Nap management** (first/last nap, automatic clearing)
- **Combined EarlySleep + SmartSleep logic** with real-time clock check
- **Debug mode** toggle in admin panel
- Supports **compact mode** and **cloud connection**

---

## 💤 Sleep Data Processing

Fitbit finalizes sleep data a few hours after wake-up.
Most complete data is available **in the evening (8 – 10 PM)**.

| Mode | Description | Recommended for |
|------|--------------|----------------|
| **Regular** | Fetch sleep data on every interval | Irregular sleep patterns |
| **Once daily (8 – 10 PM)** | Fetch only in the evening | Regular schedules & API efficiency |

💡 If you need instant morning data, disable *“Fetch sleep once per day”*.

---

## 🌙 Combined EarlySleep & SmartSleep Filter (Realtime)

Fitbit sometimes interprets early evening rest as night sleep.
This combined logic merges **time-based filtering** and **SmartSleep duration analysis**.

| Setting | Description |
|----------|--------------|
| **Ignore early main sleep** | Activates the time-based filter. Main-sleep blocks starting **before the cutoff** are evaluated. |
| **Cutoff time (HH:MM)** | Default: 22:30 or 23:00 |
| **Enable SmartSleep detection** | Accepts long main-sleep periods even if before cutoff. |
| **Minimum duration (hours)** | e.g. 3 h → main sleeps longer than 3 h are accepted; shorter ones ignored. |

💡 Examples:
- Start 21:00 → duration 1 h → **ignored**
- Start 21:15 → duration 6 h → **accepted** (SmartSleep)
- Current time 20:30 < cutoff 23:00 → **night analysis skipped**

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
| `clearNapListAtNight` | Clear naps at night |
| `enableDailyNapClear` | Enable daily clearing |
| `forceClearNapListTime` | Set fixed clearing time |
| `ignoreEarlyMainSleepEnabled` | Enable EarlySleep filter |
| `ignoreEarlyMainSleepTime` | Time cutoff (HH:MM) |
| `smartEarlySleepEnabled` | Enable SmartSleep filter |
| `minMainSleepHours` | Minimum main-sleep duration (hours) |
| `debugEnabled` | Enable debug logging |

---

## 🧾 Changelog

### **0.5.5 (2025-10-28)**
- Added **combined real-time EarlySleep & SmartSleep filter**
  → Combines current time check with sleep duration logic
- Long main-sleep blocks before cutoff are now accepted
- Improved debug output and sleep logic stability
- Added **total sleep and nap summary datapoints**
- Small performance optimizations

### **0.5.4 (2025-10-27)**
- Added **Debug & Advanced Options** tab
- SmartSleep detection with minimum duration (e.g. 3 h)
- Improved main-sleep filtering
- UI & translation improvements

### **0.5.3 (2025-10-26)**
- New configurable EarlySleep filter
- Improved sleep logic

### 0.5.2
- Nap options and intraday mode
- Improved sleep logic

### 0.5.1
- Maintenance update

---

## 👨‍💻 Authors

- **Chris** (<besterquester@live.at>) – original developer
- **Pocky2507** – extensions (nap handling, intraday mode, SmartSleep, EarlySleep, real-time filter, debug logic)

---

## 📜 License

MIT License
© 2025 Chris & Pocky2507
Software provided *as-is*, without warranty.
Use at your own risk.
