/**
 * main-ki.js
 * ---------------------------------------
 * KI-Logik für den Fitbit-Fitness-Next-Adapter
 * (Vorbereitungsstruktur – noch keine KI-Regeln!)
 *
 * ACHTUNG: Diese Datei beeinflusst die main.js NICHT,
 * solange kiEnabled = false ist.
 *
 * Die KI arbeitet NACH der normalen Logik der main.js
 * und kann das Ergebnis optional anpassen.
 */

"use strict";

module.exports = {
  /**
   * reviewSleep()
   * -------------------------
   * KI-Analyse des fertigen Adapter-Ergebnisses.
   *
   * @param {Object} result            -> Ergebnis aus main.js
   * @param {Array}  history           -> komplette History (objekte)
   * @param {Array}  hrTs              -> Herzfrequenz-Zeitreihen (Minutenwerte)
   * @param {Object} config            -> Adapter-Konfiguration (inkl. KI)
   * @param {Object} log               -> ioBroker-Logger
   *
   * @returns Entweder modifiziertes Ergebnis oder null (keine Änderung)
   */
  reviewSleep(result, history, hrTs, config, log) {

    log.info("[KI] --- KI-Modul wurde aufgerufen (Vorbereitungsmodus) ---");
    log.debug("[KI] Eingehender Schlafblock: " + JSON.stringify(result));

    // -------------------------------------------
    // Hier kommen später:
    //  - History-Brain
    //  - HR-Musteranalyse
    //  - Stabilitätslogik
    //  - persönliche Lernfunktionen
    // -------------------------------------------

    // KI ist derzeit im "Dummy"-Modus = keine Änderungen vornehmen
    if (!config.kiMode || config.kiMode === "disabled") {
      log.info("[KI] KI ist deaktiviert oder im Dummy-Modus.");
      return null;
    }

    log.info("[KI] KI-Analyse aktuell noch deaktiviert (Struktur vorhanden).");
    return null;
  }
};
