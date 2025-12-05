// eslint-disable-next-line no-unused-vars
/*global systemDictionary:true */
"use strict";

systemDictionary = {
  /* ===== Adapter Info ===== */
  "fitbit-fitness-next adapter settings": {
    "en": "Adapter settings for Fitbit",
    "de": "Adaptereinstellungen für Fitbit"
  },

  /* ===== Tabs ===== */
  "Main settings": {
    "en": "Main settings",
    "de": "Haupteinstellungen"
  },
  "Services": {
    "en": "Services",
    "de": "Dienste"
  },
  "Hauptschlaf": {
    "en": "Main sleep",
    "de": "Hauptschlaf"
  },
  "Nickerchen": {
    "en": "Naps",
    "de": "Nickerchen"
  },
  "Debug": {
    "en": "Debug",
    "de": "Debug"
  },

  /* ===== NEW TAB TITLE (Debug & KI) ===== */
  "Debug & KI": {
    "en": "Debug & AI",
    "de": "Debug & KI"
  },

  /* ===== Buttons ===== */
  "Authorize": {
    "en": "Authorize",
    "de": "Autorisieren"
  },
  "Update token": {
    "en": "Update token",
    "de": "Token aktualisieren"
  },

  /* ===== Token/Timing Labels ===== */
  "accessToken": {
    "en": "Access token",
    "de": "Zugangs-Token"
  },
  "Refresh token": {
    "en": "Refresh token",
    "de": "Aktualisierungs-Token"
  },
  "Expires on": {
    "en": "Expires on",
    "de": "Läuft ab am"
  },

  /* ===== Allgemeine Adapteroptionen ===== */
  "refresh": {
    "en": "Refresh rate (minutes)",
    "de": "Abfrageintervall (Minuten)"
  },
  "bodyrecords": {
    "en": "Body data (weight, fat, BMI)",
    "de": "Körperdaten: Gewicht, Fett, BMI"
  },
  "activityrecords": {
    "en": "Activities",
    "de": "Aktivitäten"
  },
  "foodrecords": {
    "en": "Food",
    "de": "Lebensmittel"
  },
  "devicerecords": {
    "en": "Devices",
    "de": "Geräte"
  },

  /* ===== Intraday ===== */
  "intraday": {
    "en": "Retrieve intraday data according to set interval",
    "de": "Intraday-Daten abrufen (mit dem eingestellten Intervall)"
  },

  /* ===== Sleep (Main Sleep) ===== */
  "sleeprecords": {
    "en": "Retrieve sleep data regularly by interval",
    "de": "Schlafdaten regelmäßig per Intervall abrufen"
  },
  "sleeprecordsschedule": {
    "en": "Perform single sleep data request only once",
    "de": "Nur einmaligen Schlafabruf durchführen"
  },
  "ignoreEarlyMainSleepEnabled": {
    "en": "Ignore early main sleep phases (before defined time)",
    "de": "Frühe Hauptschlafphasen ignorieren (vor definierter Uhrzeit)"
  },
  "ignoreEarlyMainSleepTime": {
    "en": "Ignore main sleep before (HH:MM)",
    "de": "Hauptschlaf ignorieren vor (HH:MM)"
  },
  "smartEarlySleepEnabled": {
    "en": "Enable smart early sleep detection",
    "de": "Intelligente Frühschlaf-Erkennung aktivieren"
  },
  "minMainSleepHours": {
    "en": "Minimum main sleep duration (hours)",
    "de": "Minimale Hauptschlafdauer (Stunden)"
  },
  "sleepStabilityMinutes": {
    "en": "Sleep stability (minutes)",
    "de": "Schlaf-Stabilität (Minuten)"
  },
  "sleepLateWakeCorrectionMinutes": {
    "en": "Late wake correction (minutes)",
    "de": "Korrektur verspäteter Aufwachzeit (Minuten)"
  },
  "Optional: Fitbit erkennt manchmal das Aufwachen zu früh. Hier kannst du einstellen, um wie viele Minuten das korrigiert werden darf (0 = aus).": {
    "en": "Optional: Fitbit sometimes detects wake-up too early. Adjust how many minutes it can be corrected (0 = off).",
    "de": "Optional: Fitbit erkennt manchmal das Aufwachen zu früh. Hier kannst du einstellen, um wie viele Minuten das korrigiert werden darf (0 = aus)."
  },

  /* ===== Nap Options ===== */
  "showLastOrFirstNap": {
    "en": "Show last or first nap (true = last nap, false = first nap)",
    "de": "Letztes oder erstes Nickerchen anzeigen (true = letztes, false = erstes)"
  },
  "clearNapListAtNight": {
    "en": "Automatically clear nap list at night",
    "de": "Nickerchenliste nachts automatisch leeren"
  },
  "enableDailyNapClear": {
    "en": "Enable daily nap list clearing",
    "de": "Tägliches Leeren der Nickerchenliste aktivieren"
  },
  "forceClearNapListTime": {
    "en": "Time to clear nap list (HH:MM)",
    "de": "Zeitpunkt zum Löschen der Nap-Liste (HH:MM)"
  },
  "smartNapValidationEnabled": {
    "en": "Enable smart nap validation",
    "de": "Intelligente Nickerchen-Erkennung aktivieren"
  },
  "Optional: Naps are checked for duration and heart-rate activity to exclude false naps (like resting or reading).": {
    "en": "Optional: Naps are checked for duration and heart-rate activity to exclude false naps (like resting or reading).",
    "de": "Optional: Nickerchen werden auf Dauer und Herzfrequenz-Aktivität geprüft, um Fehlinterpretationen (z. B. Lesen oder Ruhen) auszuschließen."
  },

  /* ===== Debug ===== */
  "debugEnabled": {
    "en": "Enable debug output",
    "de": "Debug-Ausgabe aktivieren"
  },

  "Intelligente Frühschlaf-Erkennung": {
    "en": "Smart early sleep detection",
    "de": "Intelligente Frühschlaf-Erkennung"
  },
  "Schwellwert für kurzen Schlaf (Stunden)": {
    "en": "Threshold for short main sleep (hours)",
    "de": "Schwellwert für kurzen Schlaf (Stunden)"
  },
  "Schlaf-Stabilität (Minuten)": {
    "en": "Sleep stability (minutes)",
    "de": "Schlaf-Stabilität (Minuten)"
  },
  "Schlaf-Stabilität (Minuten) Tooltip": {
    "en": "Minimum duration (in minutes) a sleep phase must last to be considered stable.",
    "de": "Minimale Dauer (in Minuten), die eine Schlafphase andauern muss, um als stabil zu gelten."
  },

  /* ===== KI (AI) — New Section ===== */

  "🐞 Debug & 🧠 KI-Analyse": {
    "en": "🐞 Debug & 🧠 AI Analysis",
    "de": "🐞 Debug & 🧠 KI-Analyse"
  },

  "KI-Analyse aktivieren": {
    "en": "Enable AI analysis",
    "de": "KI-Analyse aktivieren"
  },

  "KI-Betriebsmodus": {
    "en": "AI mode",
    "de": "KI-Betriebsmodus"
  },

  "Aus (Standard)": {
    "en": "Off (default)",
    "de": "Aus (Standard)"
  },

  "Soft – nur Hinweise": {
    "en": "Soft – suggestions only",
    "de": "Soft – nur Hinweise"
  },

  "Adaptiv – Korrekturen mit History": {
    "en": "Adaptive – corrections using history",
    "de": "Adaptiv – Korrekturen mit History"
  },

  "Strict – KI hat Vorrang": {
    "en": "Strict – AI has priority",
    "de": "Strict – KI hat Vorrang"
  },

  "Die KI-Analyse ist eine fortgeschrittene Funktion, die persönliche Schlafmuster automatisch aus der History erkennt. Standardmäßig deaktiviert.": {
    "en": "AI analysis is an advanced feature that automatically learns sleep patterns from your history. Disabled by default.",
    "de": "Die KI-Analyse ist eine fortgeschrittene Funktion, die persönliche Schlafmuster automatisch aus der History erkennt. Standardmäßig deaktiviert."
  }
};
