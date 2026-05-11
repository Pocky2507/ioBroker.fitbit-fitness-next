![Logo](admin/fitbit-fitness-next.png)

# ioBroker.fitbit-fitness-next

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/Pocky2507/ioBroker.fitbit-fitness-next?logo=github)](https://github.com/Pocky2507/ioBroker.fitbit-fitness-next/releases/latest)
[![ioBroker stable installs](https://img.shields.io/badge/ioBroker-stable%20release-blue?logo=iobroker&logoColor=white)](https://iobroker.live/badges/fitbit-fitness-next.svg)
[![ioBroker installs (latest)](https://img.shields.io/badge/ioBroker-latest%20installed-blueviolet?logo=iobroker&logoColor=white)](https://iobroker.live/badges/fitbit-fitness-next-installed.svg)
[![GitHub issues](https://img.shields.io/github/issues/Pocky2507/ioBroker.fitbit-fitness-next?logo=github)](https://github.com/Pocky2507/ioBroker.fitbit-fitness-next/issues)
[![Known Vulnerabilities](https://snyk.io/test/github/Pocky2507/ioBroker.fitbit-fitness-next/badge.svg)](https://app.snyk.io/org/Pocky2507/project/ioBroker.fitbit-fitness-next)

---

📖 **Sprachen / Languages:** [Deutsch](#-über-diesen-fork) | [English](#-about-this-fork-english)

---

## 🧠 Über diesen neuen Adapter

Dieser Adapter ist **eine erweiterte und modernisierte Version** des ursprünglichen ioBroker-Fitbit-Adapters von *besterquester*.
Der neue Adapter von **Pocky2507** enthält zahlreiche neue Funktionen, Stabilitätsverbesserungen und Debug-Optionen,
um Fitbit-Daten zuverlässiger, detaillierter und in Echtzeit in ioBroker bereitzustellen.

**Neue Schwerpunkte dieses Adapters:**
- Erweiterte **Schlafanalyse** mit *SmartSleep*, *EarlySleep* und *Nap-Erkennung*
- **Intraday-Modus** mit eingestellten Refresh Abruf der Herzfrequenzwerte
- **Stabilitäts- und Fehler-Filter** zur Datenvalidierung
- Überarbeitete **Admin-Oberfläche** mit Debug- und Entwickler-Tab
- Verbesserte **Token-Verwaltung** (automatischer Refresh, Introspect-Prüfung)

> 💡 Ziel dieses neuen Adapters ist es, Fitbit-Daten nicht nur periodisch,
> sondern *intelligent und kontextbasiert* zu analysieren — insbesondere Schlaf- und Herzfrequenzmuster in Echtzeit.

---

## 🚀 Installation

### 1. Alten Adapter entfernen (falls vorhanden)

Falls der ursprüngliche Adapter `fitbit-fitness` installiert ist:

```bash
cd /opt/ipbroker
iobroker del fitbit-fitness
```

### 2. Neuen Adapter installieren (npm)

Dieser Adapter wird offiziell über **npm** verteilt:

```bash
cd /opt/iobroker
npm install iobroker.fitbit-fitness-next
```

Oder im ioBroker Admin unter *Adapter → Expertenmodus → aus npm installieren*.

### 3. GitHub-Installation (nur für Entwickler)

Du möchtest die neueste Entwickler-Version installieren?

```bash
cd /opt/iobroker
iobroker url "https://github.com/Pocky2507/ioBroker.fitbit-fitness-next/tarball/main"
```
---

## 🩺 ioBroker Fitbit Adapter (v1.1.3)

Dieser Adapter ruft **Fitbit-Daten** in ioBroker ab und stellt sie als strukturierte Datenpunkte bereit.
Er basiert auf dem ursprünglichen Projekt von **@GermanBluefox** (*fitbit-api*)
und wurde von **Chris-656** und **Pocky2507** umfassend erweitert und modernisiert.

---

## 🧩 Voraussetzungen

Um den Adapter zu verwenden, benötigst du einen **Fitbit Developer Account**.

1. Besuche [https://dev.fitbit.com/apps/new](https://dev.fitbit.com/apps/new)
2. Melde dich mit deinem **normalen Fitbit-Konto** an.
3. Erstelle eine **neue App**:
   - Beliebiger Name (z. B. *ioBroker Fitbit Adapter*)
   - **Redirect URL:**
     `https://pocky2507.github.io/ioBroker.fitbit-fitness-next/getCode.html`
   - Berechtigungen aktivieren: *activity, heartrate, nutrition, profile, settings, sleep, weight*
4. Nach dem Speichern findest du:
   - **Client ID**
   - **Client Secret**
5. Trage diese Werte in den Adaptereinstellungen im ioBroker ein.

💡 Ohne gültige Client-ID und Secret ist keine Verbindung zu Fitbit möglich.

---

## ✨ Neue Funktionen in Version 1.1.3

- Noch einmal den Code komplett aufgeräumt, sortiert und neu Verschachtelt
- Vorbereitung für persönliche KI Analyse über History
- Intelligenter Vorfilter für Filmabende, Lesen, Fernsehen
- Verwendet den HF-Abfall (vor/nach dem Schlafen), um echten Schlaf zu erkennen
- Erfordert Herzfrequenzabfall ≥ 2,5 BPM + stabile Phase (Standard 20 Min.)
- Respektiert die IgnoreEarlyMainSleep-Grenze
- Legt die Zustände HRDropAtSleep, HRBeforeSleep und HRAfterSleep fest
- Vollständig abwärtskompatibel – keine Breaking Changes
- Schichtarbeit unterstützt
- Keine Fehlalarme durch abendliche Entspannung
- Nickerchen werden auf Dauer und Herzfrequenz-Aktivität geprüft
- Optionale Korrektur für zu früh erkannte Aufwachzeiten hinzugefügt (konfigurierbarer Minutenpuffer)
- Code komplett aufgeräumt, sortiert und neu Verschachtelt
- Nochmaliges Feintuning der Schlaflogik.
- Fertig für Finale Version auf 1.0.0
- Neue Option **Schlaf-Stabilität (Minuten)** zur Definition, wie lange ein Schlaf stabil sein muss, bevor er als Hauptschlaf zählt
- Standardwert: **20 Minuten**
- **Debug-Ausgabe** wird jetzt nur noch **einmalig beim Adapterstart** angezeigt
- Verbesserte Struktur und Darstellung des **Debug-Tabs**
- Interne Optimierungen für Konfigurations- und Logverhalten
- Rückwärtskompatibel zu v0.5.7

---

## ⚙️ Hauptfunktionen

- **History** über 90 Tage wird für persönliche Schlafauswertungen heran gezogen
- Liest Daten aus **Körper**, **Aktivitäten**, **Ernährung**, **Schlaf** und **Geräten**
- Frei wählbares **Abrufintervall**
- **Intraday-Modus** mit eingestellten Refresh Abruf der Herzfrequenzwerte
- **Nickerchen-Verwaltung** (erstes/letztes Nickerchen, automatisches Leeren)
- **Kombinierter EarlySleep & SmartSleep-Filter** mit Echtzeitprüfung
- **Schlaf-Stabilitäts-Option** für präzisere Nachtschlaf-Erkennung
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
Der kombinierte Filter verbindet:

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
| `refresh` | 5 Minuten | Intervall für den Datenabruf |
| `intraday` | ✅ | Aktiviert Herzfrequenzwerte mit eingestelltem Refresh Intervall |
| `ignoreEarlyMainSleepEnabled` | ✅ | Ignoriert Hauptschlafphasen vor der Uhrzeitgrenze |
| `ignoreEarlyMainSleepTime` | 23:00 | Beginn des Nachtschlaf-Fensters |
| `smartEarlySleepEnabled` | ✅ | Erkennt lange Schlafphasen automatisch |
| `minMainSleepHours` | 3 | Mindestdauer für SmartSleep |
| `sleepStabilityMinutes` | 20 | Dauer für stabile Schlafphase (Minuten) |
| `sleepLateWakeCorrectionMinutes` | 0 | Optionale Korrektur für zu früh erkannte Aufwachzeiten (Minuten) |
| `smartNapValidationEnabled` | ❌ | (Optional) Nickerchen werden auf Dauer und Herzfrequenz-Aktivität geprüft |
| `showLastOrFirstNap` | ✅ | Zeigt letztes (true) oder erstes (false) Nickerchen |
| `clearNapListAtNight` | ✅ | Leert Nickerchenliste nach Mitternacht |
| `enableDailyNapClear` | ❌ | Aktiviert tägliches Leeren |
| `forceClearNapListTime` | 02:45 | Uhrzeit für Zwangsleerung |
| `kiEnabled` | ❌ | KI  Aktivierung |
| `kiMode` | ❌ | KI Modus |
| `debugEnabled` | ❌ | Aktiviert detaillierte Debug-Ausgabe |

---

## 🧾 Changelog

## **1.1.3 (2026-05-11)**
- Code komplett aufgeräumt, sortiert und neu Verschachtelt

## **1.1.2 (2025-12-12)**
- Intelligente KI implementiert, aber noch nicht Aktiviert

## **1.0.3 (2025-11-13)**
- Intelligenter Vorfilter für Filmabende, Lesen, Fernsehen
- Verwendet den HF-Abfall (vor/nach dem Schlafen), um echten Schlaf zu erkennen
- Erfordert Herzfrequenzabfall ≥ 2,5 BPM + stabile Phase (Standard 20 Min.)
- Respektiert die IgnoreEarlyMainSleep-Grenze
- Legt die Zustände HRDropAtSleep, HRBeforeSleep und HRAfterSleep fest
- Vollständig abwärtskompatibel – keine Breaking Changes
- Schichtarbeit unterstützt
- Keine Fehlalarme durch abendliche Entspannung

## **1.0.2 (2025-11-12)**
- Nickerchen werden auf Dauer und Herzfrequenz-Aktivität geprüft, um Fehlinterpretationen (z. B. Lesen oder Ruhen) auszuschließen

## **1.0.1 (2025-11-10)**
- Optionale Korrektur für zu früh erkannte Aufwachzeiten hinzugefügt (konfigurierbarer Minutenpuffer)

## **1.0.0 (2025-11-08)**
- Code komplett aufgeräumt, sortiert und neu Verschachtelt
- Nochmaliges Feintuning der Schlaflogik.
- Fertig für Finale Version auf 1.0.0

## **0.5.7 (2025-11-05)**
- Feintuning der "Sofazeiten"

## **0.5.6 (2025-10-30)**
- Neue Einstellung **Schlaf-Stabilität (Minuten)** hinzugefügt
- Standardwert 20 Minuten
- Debug-Ausgabe nur noch einmalig beim Adapterstart
- Verbesserte Darstellung im Debug-Tab
- Optimierungen der Konfiguration und internen Logik

## **0.5.5 (2025-10-28)**
- Kombinierter **Echtzeit-Frühschlaf- & SmartSleep-Filter**
- Lange Hauptschlafphasen vor der Grenze werden akzeptiert
- Verbesserte Debug-Ausgabe und Stabilität
- Erweiterte Nap-Summen und Gesamtschlaf-Datenpunkte

## **0.5.4 (2025-10-27)**
- Neuer **Debug- & Erweiterte-Optionen-Tab**
- SmartSleep-Erkennung (Mindestdauer z. B. 3 h)
- Mehrsprachige UI-Anpassungen

---

## 👨‍💻 Autoren

- **Pocky2507** (<pocky@united-websites.org>) – neuer Adapter & Erweiterungen (SmartSleep, Frühschlaf, Nickerchen, Intraday, Realtime, Debug, Sleep Stability)
- **Chris-656** (<besterquester@live.at>) – ursprünglicher Entwickler

---

## 📜 Lizenz

MIT License
© 2026  Pocky2507 & Chris-656
Software wird „wie besehen“ bereitgestellt, ohne Garantie.  
Verwendung auf eigene Verantwortung.

---

## 🇬🇧 English Version

---

## 🧠 About this new Adapter (English)

This adapter is an **enhanced and modernized version** of the original ioBroker Fitbit adapter by *besterquester*.
The **Pocky2507** fork introduces new features, improved stability, and advanced debug options
to deliver Fitbit data more reliably, accurately, and in real-time within ioBroker.

**Key improvements in this Adapter:**
- Advanced **sleep analysis** with *SmartSleep*, *EarlySleep*, and *nap detection*
- **Intraday mode** with set refresh retrieval of heart rate values
- **Stability filters** and smarter error handling
- Reworked **Admin UI** with Debug & Developer tabs
- Improved **OAuth2 handling** with automatic refresh and introspection

> 💡 The goal of this fork is to analyze Fitbit data *intelligently and context-aware*,
> focusing on real-time sleep and heart-rate patterns.

---

## 🚀 Installation

### 1. Remove the old adapter (if installed)

If the original adapter `fitbit-fitness` is still installed, remove it first:

```bash
cd /opt/iobroker
iobroker del fitbit-fitness
```

### 2. Install the new adapter (via npm)

This adapter is officially distributed through npm:

```bash
cd /opt/iobroker
npm install iobroker.fitbit-fitness-next
```

Alternatively in ioBroker Admin: Adapters → Expert mode → Install from npm


### 3. GitHub-Installation (nur für Entwickler)

3. Install from GitHub (development version only)

If you want the latest development version directly from GitHub, use:

```bash
cd /opt/iobroker
iobroker url "https://github.com/Pocky2507/ioBroker.fitbit-fitness-next/tarball/main"
```
---

## 🩺 Fitbit Adapter for ioBroker (v1.1.3)

This adapter retrieves **Fitbit data** into ioBroker and provides structured datapoints.
Based on the original **fitbit-api** by *@GermanBluefox*,
extended and modernized by **Chris-656** and **Pocky2507**.

---

## 🧩 Requirements

To use this adapter, you need a **Fitbit Developer Account**.

1. Visit [https://dev.fitbit.com/apps/new](https://dev.fitbit.com/apps/new)
2. Log in with your **regular Fitbit account**
3. Create a **new app**:
   - Any name (e.g. *ioBroker Fitbit Adapter*)
   - **Redirect URL:** `https://pocky2507.github.io/ioBroker.fitbit-fitness-next/getCode.html`
   - Enable permissions: *activity, heartrate, nutrition, profile, settings, sleep, weight*
4. Copy the **Client ID** and **Client Secret** after saving.
5. Enter both in the adapter configuration within ioBroker.

💡 Without a valid Client ID and Secret, no Fitbit connection is possible.

---

## ✨ New in Version 1.1.3
- Cleaned up, sorted, and re-nested the entire code once again.
- Preparation for personal AI analysis via history
- Smart pre-filter for movie nights, reading, TV
- Uses HR drop (before/after sleep) to detect real sleep
- Requires HR drop ≥ 2.5 BPM + stable phase (default 20 min)
- Respects ignoreEarlyMainSleep cutoff
- Sets HRDropAtSleep, HRBeforeSleep, HRAfterSleep states
- Fully backward compatible – no breaking changes
- Shift work supported
- No false positives from evening relaxation
- Naps are checked for duration and heart-rate activity to exclude false naps (like resting or reading)
- Added configurable late wake correction (optional time buffer for too-early wake detection)
- Code completely cleaned up, sorted and re-nested
- Further fine-tuning of the sleep logic
- Ready for final version to 1.0.0
- Added **Sleep Stability (Minutes)** option for main sleep detection
- Default set to **20 minutes**
- Debug output now shown **once on startup only**
- Improved layout and structure of the **Debug tab**
- Internal optimizations for configuration and logging
- Backward compatible with v0.5.6

---

## ⚙️ Main Features

- **History** over 90 days is used for personal sleep evaluations
- Retrieves **body**, **activity**, **nutrition**, **sleep**, and **device** data
- Adjustable **refresh interval**
- **Intraday mode** with set refresh retrieval of heart rate values
- **Nap management** (first / last nap, auto-clear)
- **Combined EarlySleep & SmartSleep filter** with real-time clock check
- **Sleep Stability** for improved main-sleep accuracy
- **Debug mode** toggle in Admin UI
- Supports **compact mode** and **cloud connection**

---

## 💤 Sleep Data Processing

Fitbit finalizes sleep data a few hours after wake-up.
The most complete data is available in the **evening (8–10 PM)**.

| Mode | Description | Recommended for |
|:------|:-------------|:----------------|
| **Regular** | Fetch sleep data on every interval | Irregular sleep patterns |
| **Once daily (8–10 PM)** | Fetch only in the evening | Regular schedules & API efficiency |

💡 If you need instant morning data, disable *“Fetch sleep once per day”*.

---

## 🌙 Combined EarlySleep & SmartSleep Filter (Realtime)

Fitbit sometimes marks early evening rest as night sleep.
This logic combines **time-based filtering** and **SmartSleep duration analysis**.

| Setting | Description |
|:----------|:-------------|
| **Ignore early main sleep** | Activates time-based filter for blocks before cutoff time. |
| **Cutoff time (HH:MM)** | Default: 22:30 or 23:00 |
| **Enable SmartSleep detection** | Accepts long blocks even if before cutoff. |
| **Minimum duration (hours)** | e.g. 3 → main sleeps > 3 h accepted, shorter ignored. |

💡 **Examples:**
- Start 21:00 → 1 h → **ignored**
- Start 21:15 → 6 h → **accepted (SmartSleep)**
- Current time 20:30 < cutoff 23:00 → **analysis skipped**

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
| `intraday` | ✅ | Enables Intraday mode with Refresh Intervall heart-rate values |
| `ignoreEarlyMainSleepEnabled` | ✅ | Ignores main sleeps starting before cutoff |
| `ignoreEarlyMainSleepTime` | 23:00 | Defines night sleep window |
| `smartEarlySleepEnabled` | ✅ | Accepts long sleeps before cutoff |
| `minMainSleepHours` | 3 | Minimum main sleep duration (hours) |
| `sleepStabilityMinutes` | 20 | Minutes required for stable sleep |
| `sleepLateWakeCorrectionMinutes` | 0 | optional configurable late wake correction (Minutes) |
| `smartNapValidationEnabled` | ❌ | (Optional) Naps are checked for duration and heart-rate activity to exclude false naps |
| `showLastOrFirstNap` | ✅ | Show last (true) or first (false) nap |
| `clearNapListAtNight` | ✅ | Clears nap list after midnight |
| `enableDailyNapClear` | ❌ | Enables additional daily clearing |
| `forceClearNapListTime` | 02:45 | Fixed time for forced clearing |
| `kiEnabled` | ❌ | KI  Activation |
| `kiMode` | ❌ | KI Mode |
| `debugEnabled` | ❌ | Enables detailed debug output |

---

## 🧾 Changelog

## **1.1.3 (2026-05-11)**
- Cleaned up, sorted, and re-nested the entire code once again.

## **1.1.2 (2025-12-12)**
- Intelligent AI implemented but not activated yet

## **1.0.3 (2025-11-11)**
- Smart pre-filter for movie nights, reading, TV
- Uses HR drop (before/after sleep) to detect real sleep
- Requires HR drop ≥ 2.5 BPM + stable phase (default 20 min)
- Respects ignoreEarlyMainSleep cutoff
- Sets HRDropAtSleep, HRBeforeSleep, HRAfterSleep states
- Fully backward compatible – no breaking changes
- Shift work supported
- No false positives from evening relaxation

## **1.0.2 (2025-11-11)**
- Naps are checked for duration and heart-rate activity to exclude false naps (like resting or reading)

## **1.0.1 (2025-11-10)**
- Added optional correction for wake-up times detected too early (configurable minute buffer)

## **1.0.0 (2025-11-08)**
- Code completely cleaned up, sorted and re-nested.
- Further fine-tuning of the sleep logic.
- Ready for final version to 1.0.0

## **0.5.7 (2025-11-05)**
- Fine-tuning the "Couchtimes"

## **0.5.6 (2025-10-30)**
- Added **Sleep Stability (Minutes)** configuration
- Default value 20 minutes
- Debug output only once on startup
- Improved Admin UI for Debug tab
- Configuration and logging optimized

## **0.5.5 (2025-10-28)**
- Added **combined real-time EarlySleep & SmartSleep filter**
- Long main sleeps before cutoff are now accepted
- Improved debug output and stability
- Added total sleep and nap summaries

## **0.5.4 (2025-10-27)**
- Added **Debug & Advanced Options Tab**
- SmartSleep detection with minimum duration setting
- UI and translation improvements

---

## 👨‍💻 Authors

- **Pocky2507** (<pocky@united-websites.org>) – new Adapter extensions (SmartSleep, EarlySleep, Realtime, Debug, Naps, Intraday, Sleep Stability)
- **Chris-656** (<besterquester@live.at>) – original developer

---

## 📜 License

MIT License
© 2026  Pocky2507 & Chris-656
Software provided *as is*, without warranty.  
Use at your own risk.
