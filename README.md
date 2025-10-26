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

## ✨ Funktionen

- Liest Daten aus den Bereichen **Körper**, **Aktivitäten**, **Lebensmittel**, **Schlaf** und **Geräte**
- Frei wählbares **Abrufintervall** (in Minuten)
- Option, **Schlafdaten nur einmal täglich** zu laden (zur Reduzierung der API-Aufrufe)
- **Nickerchen-Verwaltung (Nap Management)**  
  - Letztes oder erstes Nickerchen anzeigen  
  - Nickerchen-Liste nachts oder zu einer festen Uhrzeit automatisch löschen  
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
| **Nickerchen-Liste nachts automatisch löschen** | Löscht die Liste nach Mitternacht automatisch, um alte Einträge zu vermeiden. |
| **Tägliches Löschen aktivieren** | Löscht die Nickerchen-Liste einmal täglich zu einer definierten Zeit. |
| **Löschzeit (HH:MM)** | Uhrzeit, zu der die Nickerchen-Liste erzwungenermaßen gelöscht wird (z. B. 02:45). |

---

## ⚙️ Übersicht der Adapter-Einstellungen

| Einstellung | Beschreibung |
|--------------|---------------|
| `refresh` | Aktualisierungsintervall in Minuten |
| `sleeprecordsschedule` | Schlafdaten nur einmal täglich abrufen (20–22 Uhr) |
| `showLastOrFirstNap` | Letztes oder erstes Nickerchen anzeigen |
| `clearNapListAtNight` | Nickerchen-Liste nachts automatisch löschen |
| `enableDailyNapClear` | Tägliches Löschen der Nickerchen-Liste aktivieren |
| `forceClearNapListTime` | Feste Löschzeit der Liste (HH:MM) |
| `intraday` | Aktiviert den Abruf von Intraday-Daten (Minutenauflösung) |

---

## 🪲 Bekannte Probleme

Zurzeit sind keine Probleme bekannt.  
*(Ältere Änderungen siehe im Original-Repository)*  
<br>[Original GitHub-Repository – Chris-656/ioBroker.fitbit-fitness](https://github.com/Chris-656/ioBroker.fitbit-fitness)

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

Adapter for Fitbit devices.  
This adapter retrieves Fitbit data into ioBroker.  
Originally created by **@GermanBluefox**,  
extended and maintained by **Chris** and **Pocky2507** with modern configuration and new features.

---

## ✨ Features

- Retrieves **Body**, **Activity**, **Food**, **Sleep**, and **Device** data  
- Customizable **refresh interval**  
- Optional **once-per-day sleep record retrieval** (20–22 h)  
- **Nap management** – show last or first nap, auto-clear at night or fixed time  
- **Intraday mode** for detailed minute-level data  
- Built-in **OAuth2 authorization** via adapter admin UI  
- Supports **compact mode** and **cloud connection**

---

## 💤 Sleep Data Handling (Why 20–22 h)

Fitbit finalizes sleep data several hours after you wake up.  
Fetching too early (e.g., 7 a.m.) may return incomplete logs.  
Therefore, the adapter provides two options:

| Mode | Description | Recommended for |
|------|--------------|-----------------|
| **Regular refresh** | Retrieves sleep data with every update interval. | Users with irregular sleep patterns |
| **Once per day (20–22 h)** | Retrieves once daily between 20:00–22:00 for stable and complete results. | Users with regular sleep or low API usage |

💡 **Tip:** Disable *“Get sleep record once per day”*  
to include sleep data in every normal update cycle.

---

## 🪲 Known Issues
No known issues.  
*(Older changes can be found in the original repository)*  
<br>[Original Repository – Chris-656/ioBroker.fitbit-fitness](https://github.com/Chris-656/ioBroker.fitbit-fitness)

---

## 🧾 Changelog

### **0.5.2 (2025-10-26)**
- Added configurable nap options  
- Added intraday mode  
- Improved sleep data handling and documentation  

### 0.5.1
- Maintenance update  

---

## 👩‍💻 Authors

- **Chris** (<besterquester@live.at>) – original developer  
- **Pocky2507** – fork & extensions (nap options, intraday, new logic)

---

## 📜 License

MIT License  
Copyright (c) 2025 Chris & Pocky2507  
Software provided "as is", without warranty of any kind.
