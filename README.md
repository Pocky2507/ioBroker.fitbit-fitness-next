![Logo](admin/fitbit-fitness.png)
# ioBroker.fitbit-fitness
[![NPM version](https://img.shields.io/npm/v/iobroker.fitbit-fitness.svg)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
[![Number of Installations (latest)](https://iobroker.live/badges/fitbit-fitness-installed.svg)](https://iobroker.live/badges/fitbit-fitness-installed.svg)
[![Downloads](https://img.shields.io/npm/dm/iobroker.fitbit-fitness)](https://www.npmjs.com/package/iobroker.fitbit-fitness)
![Number of Installations (stable)](https://iobroker.live/badges/fitbit-fitness.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/Pocky2507/ioBroker.fitbit-fitness/badge.svg)](https://app.snyk.io/org/Pocky2507/ioBroker.fitbit-fitness)

[![NPM](https://nodei.co/npm/iobroker.fitbit-fitness.png?downloads=true)](https://nodei.co/npm/iobroker.fitbit-fitness/)

---

## FITBIT adapter for ioBroker

Adapter for Fitbit devices.  
This adapter retrieves Fitbit data into ioBroker.  
Originally ported by **@GermanBluefox** (fitbit-api project, thanks!)  
and extended by **Chris** and **Pocky2507** with new features and a modernized configuration.

---

## ✨ Features

- Retrieves data from **Body**, **Activities**, **Food**, **Sleep**, and **Device** categories  
- **Configurable refresh interval** (in minutes)
- Optional **once-per-day sleep retrieval** to minimize API calls  
- **Nap (Nickerchen) management**:  
  - Show last or first nap  
  - Automatically clear nap list at night or at a fixed time  
- **Intraday mode** (for detailed, high-frequency Fitbit data – optional)
- Modern **OAuth2 authorization** built into the adapter admin UI  
- **Stable and lightweight**: Designed for consistent Fitbit API use  
- Full **ioBroker compact mode** support  

---

## 💤 Sleep Data Handling (Why the daily fetch is in the evening)

Fitbit sleep data behaves differently from other metrics.  
When you wake up, your tracker may already have synchronized data,  
but the **final processed sleep log** (including phases and total sleep)  
is often not available until **later in the day**.

That’s why the adapter offers two modes for sleep data:

| Mode | Description | Recommended for |
|------|--------------|-----------------|
| **Regular refresh** | Sleep data is fetched with every update interval (e.g. every 5 minutes). You’ll see the latest data shortly after waking up. | Users with irregular or late sleep patterns |
| **Once per day (20–22 h)** | The adapter fetches sleep data only once a day, between **20:00 – 22:00**. This ensures Fitbit has finished processing the previous night’s data, giving stable and complete results. | Users with regular sleep routines or who want to reduce API calls |

🧠 **Why 20–22 h?**  
Fitbit’s servers may take several hours after waking up to finalize sleep data.  
Fetching too early (e.g. 7 a.m.) may return incomplete or split results.  
The evening fetch ensures data is accurate and finalized.

💡 **Tip:**  
If you want to see sleep data soon after waking up, disable *“Get sleep record once per day”*.  
The adapter will then include sleep data during regular updates.

---

## 💤 Schlafdaten-Verarbeitung (Warum der Abruf abends erfolgt)

Fitbit verarbeitet Schlafdaten erst **mehrere Stunden nach dem Aufstehen** vollständig.  
Während Schritte oder Puls sofort verfügbar sind, werden Schlafblöcke  
erst im Laufe des Tages vollständig von den Fitbit-Servern berechnet.

Der Adapter bietet daher zwei Betriebsarten:

| Modus | Beschreibung | Empfohlen für |
|--------|---------------|----------------|
| **Regelmäßiger Abruf** | Schlafdaten werden mit jedem normalen Aktualisierungsintervall abgerufen (z. B. alle 5 Minuten). | Nutzer mit unregelmäßigem oder spätem Schlaf |
| **Einmal täglich (20–22 Uhr)** | Abruf nur einmal am Tag zwischen **20:00 – 22:00 Uhr**. Zu diesem Zeitpunkt liegen die finalen Daten sicher vor. | Nutzer mit regelmäßigem Schlaf oder geringem API-Verbrauch |

🧠 **Warum 20–22 Uhr?**  
Fitbit stellt finale Schlafdaten erst am Nachmittag oder Abend bereit.  
Ein Abruf am Morgen kann unvollständige oder doppelte Werte liefern.  
Mit dem Abendzeitfenster sind die Daten immer vollständig.

💡 **Tipp:**  
Wenn du nach dem Aufstehen aktuelle Schlafdaten möchtest,  
deaktiviere *„Schlafaufzeichnung nur einmal am Tag“*.  
Dann ruft der Adapter die Werte regelmäßig im normalen Intervall ab.

---

## 🧩 Configuration Overview

| Setting | Description |
|----------|-------------|
| `refresh` | Refresh interval in minutes |
| `sleeprecordsschedule` | Enable once-per-day sleep retrieval (20–22 h) |
| `showLastOrFirstNap` | Show the last or first nap (true = last nap, false = first nap) |
| `clearNapListAtNight` | Automatically clear nap list at night |
| `enableDailyNapClear` | Enable daily nap list clearing |
| `forceClearNapListTime` | Specific time for nap list reset (e.g. 02:45) |
| `intraday` | Enable intraday (minute-level) data retrieval |

---

## 🪲 Known Issues
- No known issues at the moment.  
  *(Older issues and history can be found in the original repository.)*  
  <br>[Original GitHub Repository – Chris-656/ioBroker.fitbit-fitness](https://github.com/Chris-656/ioBroker.fitbit-fitness)

---

## 🧾 Changelog

### **0.5.2 (2025-10-26)**
- Added configurable nap (Nickerchen) options  
- Added intraday mode  
- Improved sleep data handling and documentation  

### 0.5.1
- Maintenance updates

### 0.5.0
- General fixes and API stability improvements

*(Older changes can be found in the [original repository](https://github.com/Chris-656/ioBroker.fitbit-fitness))*  

---

## 🧑‍💻 Authors

- **Chris** (<besterquester@live.at>) – original developer  
- **Pocky2507** – fork and extensions (nap options, intraday, improved logic)

---

## 📜 License

MIT License  
Copyright (c) 2025 Chris & Pocky2507  

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
