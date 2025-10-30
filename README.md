![Logo](admin/fitbit-fitness.png)

# ioBroker.fitbit-fitness

[![NPM version](https://img.shields.io/npm/v/iobroker.fitbit-fitness.svg)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
[![Installationen (latest)](https://iobroker.live/badges/fitbit-fitness-installed.svg)](https://iobroker.live/badges/fitbit-fitness-installed.svg)
[![Downloads](https://img.shields.io/npm/dm/iobroker.fitbit-fitness)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
![Installationen (stable)](https://iobroker.live/badges/fitbit-fitness.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/Pocky2507/ioBroker.fitbit-fitness/badge.svg)](https://app.snyk.io/org/Pocky2507/ioBroker.fitbit-fitness)
[![NPM](https://nodei.co/npm/iobroker.fitbit-fitness.png?downloads=true)](https://nodei.co/npm/iobroker.fitbit-fitness/)

---

> ⚠️ **Wichtiger Installationshinweis**  
> Bitte installiere diesen Adapter **direkt von GitHub**, um korrekte Updates zu erhalten:
>
> ```
> iobroker install https://github.com/Pocky2507/ioBroker.fitbit-fitness
> ```
>
> **Nicht** über npm installieren – dies ist ein geschützter *nonNpm*-Build.

---

# 🩺 ioBroker Fitbit Adapter (v0.5.6)

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

## ✨ Neue Funktionen in Version 0.5.6

- Neue Option **Schlaf-Stabilität (Minuten)** zur Definition, wie lange ein Schlaf stabil sein muss, bevor er als Hauptschlaf zählt
- Standardwert: **20 Minuten**
- **Debug-Ausgabe** wird jetzt nur noch **einmalig beim Adapterstart** angezeigt
- Verbesserte Struktur und Darstellung des **Debug-Tabs**
- Interne Optimierungen für Konfigurations- und Logverhalten
- Rückwärtskompatibel zu v0.5.5

---

## ⚙️ Hauptfunktionen

- Liest Daten aus **Körper**, **Aktivitäten**, **Ernährung**, **Schlaf** und **Geräten**
- Frei wählbares **Abrufintervall**
- **Intraday-Modus** für 1-Minuten-Herzfrequenzdaten
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
| `intraday` | ❌ | Aktiviert 1-Minuten-Herzfrequenzwerte |
| `ignoreEarlyMainSleepEnabled` | ✅ | Ignoriert Hauptschlafphasen vor der Uhrzeitgrenze |
| `ignoreEarlyMainSleepTime` | 23:00 | Beginn des Nachtschlaf-Fensters |
| `smartEarlySleepEnabled` | ✅ | Erkennt lange Schlafphasen automatisch |
| `minMainSleepHours` | 3 | Mindestdauer für SmartSleep |
| `sleepStabilityMinutes` | 20 | Dauer für stabile Schlafphase (Minuten) |
| `showLastOrFirstNap` | ✅ | Zeigt letztes (true) oder erstes (false) Nickerchen |
| `clearNapListAtNight` | ✅ | Leert Nickerchenliste nach Mitternacht |
| `enableDailyNapClear` | ❌ | Aktiviert tägliches Leeren |
| `forceClearNapListTime` | 02:45 | Uhrzeit für Zwangsleerung |
| `debugEnabled` | ❌ | Aktiviert detaillierte Debug-Ausgabe |

---

## 🧾 Changelog

### **0.5.6 (2025-10-30)**
- Neue Einstellung **Schlaf-Stabilität (Minuten)** hinzugefügt
- Standardwert 20 Minuten
- Debug-Ausgabe nur noch einmalig beim Adapterstart
- Verbesserte Darstellung im Debug-Tab
- Optimierungen der Konfiguration und internen Logik

### **0.5.5 (2025-10-28)**
- Kombinierter **Echtzeit-Frühschlaf- & SmartSleep-Filter**
- Lange Hauptschlafphasen vor der Grenze werden akzeptiert
- Verbesserte Debug-Ausgabe und Stabilität
- Erweiterte Nap-Summen und Gesamtschlaf-Datenpunkte

### **0.5.4 (2025-10-27)**
- Neuer **Debug- & Erweiterte-Optionen-Tab**
- SmartSleep-Erkennung (Mindestdauer z. B. 3 h)
- Mehrsprachige UI-Anpassungen

---

## 👨‍💻 Autoren

- **Chris** (<besterquester@live.at>) – ursprünglicher Entwickler
- **Pocky2507** – Fork & Erweiterungen (SmartSleep, Frühschlaf, Nickerchen, Intraday, Realtime, Debug, Sleep Stability)

---

## 📜 Lizenz

MIT License
© 2025 Chris & Pocky2507
Software wird „wie besehen“ bereitgestellt, ohne Garantie.
Verwendung auf eigene Verantwortung.

---

# 🇬🇧 English Version

---

## 🧾 Installation Note

> ⚠️ **Important:**  
> Install this adapter **only from GitHub** to ensure the correct version and updates.
>
> ```
> iobroker install https://github.com/Pocky2507/ioBroker.fitbit-fitness
> ```
>
> Do **not** install from npm – this is a protected nonNpm build.

---

## 🩺 Fitbit Adapter for ioBroker (v0.5.6)

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
   - **Redirect URL:** `https://pocky2507.github.io/ioBroker.fitbit-fitness/getCode.html`
   - Enable permissions: *activity, heartrate, nutrition, profile, settings, sleep, weight*
4. Copy the **Client ID** and **Client Secret** after saving.
5. Enter both in the adapter configuration within ioBroker.

💡 Without a valid Client ID and Secret, no Fitbit connection is possible.

---

## ✨ New in Version 0.5.6

- Added **Sleep Stability (Minutes)** option for main sleep detection
- Default set to **20 minutes**
- Debug output now shown **once on startup only**
- Improved layout and structure of the **Debug tab**
- Internal optimizations for configuration and logging
- Backward compatible with v0.5.5

---

## ⚙️ Main Features

- Retrieves **body**, **activity**, **nutrition**, **sleep**, and **device** data
- Adjustable **refresh interval**
- **Intraday mode** for 1-minute heart-rate data
- **Nap management** (first / last nap, auto-clear)
- **Combined EarlySleep & SmartSleep filter** with real-time clock check
- **Sleep Stability** for improved main-sleep accuracy
- **Debug mode** toggle in Admin UI
- Supports **compact mode** and **cloud connection**



## 👨‍💻 Authors

- **Chris** (<besterquester@live.at>) – original developer
- **Pocky2507** – extensions (SmartSleep, EarlySleep, Realtime, Debug, Naps, Intraday, Sleep Stability)

---

## 📜 License

MIT License
© 2025 Chris & Pocky2507
Software provided *as is*, without warranty.
Use at your own risk.

