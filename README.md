![Logo](admin/fitbit-fitness.png)

# ioBroker.fitbit-fitness

[![NPM version](https://img.shields.io/npm/v/iobroker.fitbit-fitness.svg)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
[![Installationen (latest)](https://iobroker.live/badges/fitbit-fitness-installed.svg)](https://iobroker.live/badges/fitbit-fitness-installed.svg)
[![Downloads](https://img.shields.io/npm/dm/iobroker.fitbit-fitness)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
![Installationen (stable)](https://iobroker.live/badges/fitbit-fitness.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/Pocky2507/ioBroker.fitbit-fitness/badge.svg)](https://app.snyk.io/org/Pocky2507/ioBroker.fitbit-fitness)
[![NPM](https://nodei.co/npm/iobroker.fitbit-fitness.png?downloads=true)](https://nodei.co/npm/iobroker.fitbit-fitness/)

---

# 🩺 ioBroker Fitbit Adapter (v0.5.5)

Dieser Adapter ruft **Fitbit-Daten** in ioBroker ab und stellt sie als strukturierte Datenpunkte bereit.
Er basiert auf dem ursprünglichen Projekt von **@GermanBluefox** (*fitbit-api*)
und wurde von **Chris** und **Pocky2507** umfassend erweitert und modernisiert.

---

## 🧩 Voraussetzungen

Um den Adapter zu verwenden, benötigst du einen **Fitbit Developer Account**.

1. Besuche [https://dev.fitbit.com/apps/new](https://dev.fitbit.com/apps/new)
2. Melde dich mit deinem **normalen Fitbit-Konto** an.
3. Erstelle eine **neue App**:
   - Beliebiger Name (z. B. *ioBroker Fitbit Adapter*)
   - **Redirect URL:**
     `https://pocky2507.github.io/ioBroker.fitbit-fitness/getCode.html`
   - Berechtigungen aktivieren: *activity, heartrate, nutrition, profile, settings, sleep, weight*
4. Nach dem Speichern findest du:
   - **Client ID**
   - **Client Secret**
5. Trage diese Werte in den Adaptereinstellungen im ioBroker ein.

💡 Ohne gültige Client-ID und Secret ist keine Verbindung zu Fitbit möglich.

---

## ✨ Neue Funktionen in Version 0.5.5

- Neuer **kombinierter Echtzeit-Frühschlaf- & SmartSleep-Filter**
- Erkennt automatisch, wenn die aktuelle Uhrzeit **vor der Nachtschlaf-Grenze** liegt (z. B. 22:30 Uhr)
- Lange Hauptschlafphasen **vor der Uhrzeitgrenze** werden **intelligent akzeptiert**
- Erweiterte Debug-Ausgabe und stabilere Echtzeit-Schlafauswertung
- Erweiterte **Nickerchen-Summen** (Gesamtschlaf inkl. Naps, getrennt vom Nachtschlaf)
- Rückwärtskompatibel zu v0.5.4

---

## ⚙️ Hauptfunktionen

- Liest Daten aus **Körper**, **Aktivitäten**, **Ernährung**, **Schlaf** und **Geräten**
- Frei wählbares **Abrufintervall**
- **Intraday-Modus** für 1-Minuten-Herzfrequenzdaten
- **Nickerchen-Verwaltung** (erstes/letztes Nickerchen, automatisches Leeren)
- **Kombinierter EarlySleep & SmartSleep-Filter** mit Echtzeitprüfung
- **Debug-Modus** schaltbar im Admin-Panel
- Unterstützt **Compact-Mode** und **Cloud-Verbindung**

---

## 💤 Schlafdatenverarbeitung

Fitbit berechnet Schlafphasen **mehrere Stunden nach dem Aufstehen**.
Die Daten sind am **Abend (20–22 Uhr)** am vollständigsten.

| Modus | Beschreibung | Empfehlung |
|:------|:--------------|:------------|
| **Regelmäßig** | Abruf bei jedem Intervall | Für unregelmäßigen Schlafrhythmus |
| **Einmal täglich (20–22 Uhr)** | Abruf nur abends | Für gleichmäßigen Schlaf & weniger API-Aufrufe |

💡 Wenn du morgens sofort Daten brauchst, deaktiviere *„Schlafaufzeichnung nur einmal täglich“*.

---

## 🌙 Kombinierter Frühschlaf- & SmartSleep-Filter (Echtzeit)

Fitbit erkennt manchmal fälschlich frühe Ruhephasen als Hauptschlaf.
Der neue kombinierte Filter verbindet:

1. eine **Echtzeit-Prüfung** der aktuellen Uhrzeit und
2. eine **intelligente SmartSleep-Analyse** der Schlafdauer.

| Einstellung | Beschreibung |
|:-------------|:--------------|
| **Frühschlaf ignorieren** | Aktiviert den Uhrzeit-Filter. Schlafphasen, die **vor der Grenze** beginnen, werden geprüft. |
| **Uhrzeitgrenze (HH:MM)** | Standard: 22:30 oder 23:00 Uhr |
| **SmartSleep aktivieren** | Akzeptiert lange Schlafphasen auch vor der Grenze. |
| **Mindestdauer (h)** | z. B. 3 → Schlafphasen über 3 h gelten als Hauptschlaf. |

💡 **Beispiele:**
- Start 21:00 → Dauer 1 h → **ignoriert**
- Start 21:15 → Dauer 6 h → **akzeptiert** (SmartSleep)
- Aktuelle Zeit 20:30 < Grenze 23:00 → **Nachtschlaf-Analyse übersprungen**

---

## 🕒 Nickerchen-Optionen

| Einstellung | Beschreibung |
|:-------------|:--------------|
| **Letztes oder erstes Nickerchen anzeigen** | true = letztes, false = erstes |
| **Nachts automatisch leeren** | Löscht Liste nach Mitternacht |
| **Tägliches Leeren aktivieren** | Leert Liste einmal pro Tag |
| **Leerungszeit (HH:MM)** | Uhrzeit für erzwungenes Leeren (z. B. 02:45) |

---

## ⚙️ Standardkonfiguration (Default Settings)

| Schlüssel | Standardwert | Kurzbeschreibung |
|:-----------|:-------------|:------------------|
| `refresh` | 5 Minuten | Intervall, in dem Fitbit-Daten abgerufen werden |
| `intraday` | ❌ | Aktiviert den Intraday-Modus mit 1-Minuten-Herzfrequenzwerten |
| `ignoreEarlyMainSleepEnabled` | ✅ | Ignoriert Hauptschlafphasen, die vor der eingestellten Uhrzeit beginnen |
| `ignoreEarlyMainSleepTime` | 23:00 | Uhrzeit, ab der Schlafphasen als Nachtschlaf gelten |
| `smartEarlySleepEnabled` | ✅ | Erkennt lange Schlafphasen automatisch als Hauptschlaf (SmartSleep) |
| `minMainSleepHours` | 3 | Mindestdauer einer Hauptschlafphase für SmartSleep |
| `showLastOrFirstNap` | ✅ | Zeigt das **letzte** (true) oder **erste** (false) Nickerchen an |
| `clearNapListAtNight` | ✅ | Leert die Nickerchenliste automatisch nach Mitternacht |
| `enableDailyNapClear` | ❌ | Aktiviert zusätzliches tägliches Leeren der Liste |
| `forceClearNapListTime` | 02:45 | Uhrzeit, zu der die Nickerchenliste zwangsweise gelöscht wird |
| `debugEnabled` | ❌ | Aktiviert detaillierte Debug-Ausgabe im Log |

---

## 🧾 Changelog

### **0.5.5 (2025-10-28)**
- Kombinierter **Echtzeit-Frühschlaf- & SmartSleep-Filter**
- Lange Hauptschlafphasen vor der Grenze werden akzeptiert
- Verbesserte Debug-Ausgabe und Stabilität
- Erweiterte Nap-Summen und Gesamtschlaf-Datenpunkte

### **0.5.4 (2025-10-27)**
- Neuer **Debug & Advanced-Options-Tab**
- SmartSleep-Erkennung (Mindestdauer z. B. 3 h)
- Mehrsprachige UI-Anpassungen

---

## 👨‍💻 Autoren

- **Chris** (<besterquester@live.at>) – ursprünglicher Entwickler
- **Pocky2507** – Fork & Erweiterungen (SmartSleep, Frühschlaf, Nickerchen, Intraday, Realtime, Debug)

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
4. Copy the **Client ID** and **Client Secret** after saving.
5. Enter both in the adapter configuration within ioBroker.

💡 Without a valid Client ID and Secret, no Fitbit connection is possible.

---

## ✨ New in Version 0.5.5

- Added **combined real-time EarlySleep & SmartSleep filter**
- Automatically skips night-sleep analysis when current time < cutoff (e.g. 22:30)
- Long main-sleep blocks before cutoff are **accepted automatically**
- Improved debug logging and stability of sleep logic
- Added **total sleep and nap summary datapoints**
- Fully backward compatible with v0.5.4

---

## ⚙️ Main Features

- Retrieves **body**, **activity**, **nutrition**, **sleep**, and **device** data
- Adjustable **refresh interval**
- **Intraday mode** for 1-minute heart-rate data
- **Nap management** (first / last nap, auto-clear)
- **Combined EarlySleep & SmartSleep logic** with real-time clock check
- **Debug mode** toggle in Admin UI
- Supports **compact mode** and **cloud connection**

---

## 💤 Sleep Data Processing

Fitbit finalizes sleep data a few hours after wake-up.
Most complete data is available in the **evening (8 – 10 PM)**.

| Mode | Description | Recommended for |
|:------|:--------------|:----------------|
| **Regular** | Fetch sleep data on every interval | Irregular sleep patterns |
| **Once daily (8–10 PM)** | Fetch only in the evening | Regular schedules & API efficiency |

💡 If you need instant morning data, disable *“Fetch sleep once per day”*.

---

## 🌙 Combined EarlySleep & SmartSleep Filter (Realtime)

Fitbit sometimes marks early evening rest as night sleep.
This combined logic merges **time-based filtering** and **SmartSleep duration analysis**.

| Setting | Description |
|:----------|:-------------|
| **Ignore early main sleep** | Activates time-based filter for main-sleep blocks before cutoff time. |
| **Cutoff time (HH:MM)** | Default: 22:30 or 23:00 |
| **Enable SmartSleep detection** | Accepts long main-sleep blocks even if before cutoff. |
| **Minimum duration (hours)** | e.g. 3 → main sleeps > 3 h accepted, shorter ignored. |

💡 **Examples:**
- Start 21:00 → Duration 1 h → **ignored**
- Start 21:15 → Duration 6 h → **accepted** (SmartSleep)
- Current time 20:30 < cutoff 23:00 → **night analysis skipped**

---

## 🕒 Nap Options

| Setting | Description |
|:----------|:-------------|
| **Show last or first nap** | true = last, false = first |
| **Clear naps at night** | Clears list after midnight |
| **Enable daily nap clearing** | Clears once per day |
| **Forced clearing time (HH:MM)** | e.g. 02:45 AM |

---

## ⚙️ Default Configuration

| Key | Default | Short Description |
|:------|:----------|:------------------|
| `refresh` | 5 min | Interval in which Fitbit data is fetched |
| `intraday` | ❌ | Enables Intraday mode with 1-minute heart-rate values |
| `ignoreEarlyMainSleepEnabled` | ✅ | Ignores main-sleep blocks that start before the cutoff time |
| `ignoreEarlyMainSleepTime` | 23:00 | Cutoff time defining start of night-sleep window |
| `smartEarlySleepEnabled` | ✅ | Automatically accepts long main-sleep blocks before cutoff |
| `minMainSleepHours` | 3 | Minimum duration (hours) of main-sleep for SmartSleep |
| `showLastOrFirstNap` | ✅ | Show **last** (true) or **first** (false) nap |
| `clearNapListAtNight` | ✅ | Clears nap list automatically after midnight |
| `enableDailyNapClear` | ❌ | Enables additional daily nap list clearing |
| `forceClearNapListTime` | 02:45 | Fixed time when nap list is cleared |
| `debugEnabled` | ❌ | Enables detailed debug logging in the console |

---

## 🧾 Changelog

### **0.5.5 (2025-10-28)**
- Added **combined real-time EarlySleep & SmartSleep filter**
- Long main-sleep blocks before cutoff are now accepted
- Improved debug output and stability
- Added total sleep and nap summaries

---

## 👨‍💻 Authors

- **Chris** (<besterquester@live.at>) – original developer
- **Pocky2507** – extensions (SmartSleep, EarlySleep, Realtime, Debug, Naps, Intraday)

---

## 📜 License

MIT License
© 2025 Chris & Pocky2507
Software provided *as is*, without warranty.
Use at your own risk.
