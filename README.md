![Logo](admin/fitbit-fitness.png)

# ioBroker.fitbit-fitness

[![NPM version](https://img.shields.io/npm/v/iobroker.fitbit-fitness.svg)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
[![Number of Installations (latest)](https://iobroker.live/badges/fitbit-fitness-installed.svg)](https://iobroker.live/badges/fitbit-fitness-installed.svg)
[![Downloads](https://img.shields.io/npm/dm/iobroker.fitbit-fitness)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
![Number of Installations (stable)](https://iobroker.live/badges/fitbit-fitness.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/Pocky2507/ioBroker.fitbit-fitness/badge.svg)](https://app.snyk.io/org/Pocky2507/ioBroker.fitbit-fitness)

[![NPM](https://nodei.co/npm/iobroker.fitbit-fitness.png?downloads=true)](https://nodei.co/npm/iobroker.fitbit-fitness/)

---

## Fitbit Adapter for ioBroker

Dieser Adapter ruft Daten von **Fitbit-Geräten** ab und stellt sie im ioBroker zur Verfügung.  
Er basiert ursprünglich auf dem Projekt von [@GermanBluefox](https://github.com/GermanBluefox)  
und wurde von [Chris-656](https://github.com/Chris-656) entwickelt.  
Dieser Fork erweitert den Adapter um zusätzliche Funktionen und Verbesserungen.

---

## ✨ Features

- Abruf von **Körper-, Aktivitäts-, Essens-, Schlaf- und Gerätedaten**
- **Individuelle Aktivierung/Deaktivierung** einzelner Datenquellen über die Admin-Konfiguration
- **Konfigurierbarer Abrufintervall** (in Minuten)
- **Intraday-Herzfrequenz** (optional, erfordert Fitbit Premium)
- **Erweiterte Schlaf- und Nickerchen-Auswertung**
  - Auswahl: *erstes* oder *letztes* Nickerchen anzeigen
  - Automatisches **Leeren der Nap-Liste in der Nacht (00–04 Uhr)**
  - Optionaler **täglicher Reset der Nap-Daten** zu einer festen Uhrzeit
- **Zuverlässige Token-Erneuerung** über ClientID und Secret
- **Täglicher Sleep-Plan** mit zufälliger Startzeit (20–22 Uhr)
- **Geräteüberwachung** (Batteriestatus, Akkustand, Typ)

---

## 🧰 Konfiguration (Admin)

Im ioBroker-Admin unter „Adapterkonfiguration“ können folgende Optionen eingestellt werden:

| Option | Beschreibung |
|:--|:--|
| **Refresh Intervall** | Aktualisierungsintervall in Minuten |
| **Body Records aktivieren** | Körperdaten (Gewicht, BMI, Fett) abrufen |
| **Activity Records aktivieren** | Schritt-, Herzfrequenz- und Aktivitätsdaten abrufen |
| **Food Records aktivieren** | Ernährungsdaten abrufen |
| **Sleep Records aktivieren** | Schlafdaten abrufen |
| **Geräte aktivieren** | Fitbit-Geräte abrufen |
| **Intraday aktivieren** | Detaillierte 1-Minuten-Herzfrequenzdaten (Premium erforderlich) |
| **Letztes oder erstes Nickerchen anzeigen** | Auswahl, ob das erste oder letzte Nap des Tages angezeigt wird |
| **Nap-Liste nachts leeren** | Löscht Nickerchenliste automatisch zwischen 00–04 Uhr |
| **Täglichen Nap-Reset aktivieren** | Löscht Nap-Daten täglich zu einer festen Uhrzeit |
| **Uhrzeit für täglichen Reset** | Format HH:MM (Standard: 02:45) |

---

## 🧩 Bekannte Probleme

- Der Intraday-Abruf erfordert ein Fitbit-Premium-Konto.
- Fitbit kann API-Aufrufe zeitweise drosseln (Limitierungen durch Hersteller).

---

## 🧾 Changelog

<!--
### **WORK IN PROGRESS**
-->

### 0.5.2 (2025-10-26)
- Hinzugefügt: **konfigurierbare Nap-Optionen**
- Hinzugefügt: **täglicher Nap-Reset** mit Uhrzeit
- Hinzugefügt: **Intraday-Herzfrequenz-Abruf**
- Verbessertes Logging & Zeitberechnung
- Admin-Konfiguration erweitert (deutsche Beschreibungen)
- Code restrukturiert für bessere Stabilität

### 0.5.1 (2025-09-26)
- Maintenance fixes

*(Ältere Änderungen siehe im original GitHub-Repo)*  
https://github.com/Chris-656/ioBroker.fitbit-fitness

---

## 📜 Lizenz

Copyright (c) 2025  
**Chris** <besterquester@live.at> & **Pocky2507**

MIT License – siehe [LICENSE](./LICENSE)
