/**
 * main-ki.js
 * ---------------------------------------
 * Observe-KI für Fitbit-Fitness-Next
 *
 * Phase 1:
 * - analysiert History
 * - berechnet Scores
 * - erkennt Muster
 * - schreibt KI-States
 *
 * Die KI verändert KEINE produktiven Sleepdaten.
 */

"use strict";

module.exports = {

  async reviewSleep(result, history, hrTs, config, log) {

    try {

      if (!result) {
        return null;
      }

      if (!Array.isArray(history)) {
        return null;
      }

      const recent = history
      .filter((d) => d && typeof d === "object")
      .slice(-14);

      if (!recent.length) {
        return null;
      }

      // ============================================================
      // Durchschnittswerte
      // ============================================================

      const avgHrDrop = average(
        recent.map((d) => Number(d.hrDrop || 0))
      );

      const avgWake = average(
        recent.map((d) => Number(d.wake || 0))
      );

      const avgDeep = average(
        recent.map((d) => Number(d.deep || 0))
      );

      // ============================================================
      // Aktuelle Nacht
      // ============================================================

      const currentHrDrop = Number(result.hrDrop || 0);
      const currentWake = Number(result.wake || 0);
      const currentDeep = Number(result.deep || 0);

      // ============================================================
      // Scores
      // ============================================================

      const recoveryScore = normalize(
        currentHrDrop,
        avgHrDrop * 0.5,
        avgHrDrop * 1.8
      );

      const fragmentationScore = normalizeInverse(
        currentWake,
        avgWake,
        avgWake * 2
      );

      const sleepQualityScore = normalize(
        currentDeep,
        avgDeep * 0.7,
        avgDeep * 1.8
      );

      const restfulnessScore = Math.round(
        (sleepQualityScore + fragmentationScore) / 2
      );

      // ============================================================
      // Flags
      // ============================================================

      const fragmentedSleep =
      currentWake > avgWake * 1.7;

      const lowRecovery =
      currentHrDrop < avgHrDrop * 0.55;

      // ============================================================
      // Empfehlungen
      // ============================================================

      let primaryRecommendation = "";
      let secondaryRecommendation = "";

      if (lowRecovery) {
        primaryRecommendation =
        "Niedrige nächtliche Erholung erkannt";
      }

      if (fragmentedSleep) {
        secondaryRecommendation =
        "Fragmentierter Schlaf erkannt";
      }

      // ============================================================
      // Logging
      // ============================================================

      log.info(
        `[KI] Recovery=${Math.round(recoveryScore)} ` +
        `Fragmentation=${Math.round(fragmentationScore)} ` +
        `SleepQuality=${Math.round(sleepQualityScore)}`
      );

      // ============================================================
      // Observe-only Rückgabe
      // ============================================================

      return {

        score: {
          recovery: Math.round(recoveryScore),
          fragmentation: Math.round(fragmentationScore),
          restfulness: Math.round(restfulnessScore),
          stability: 100,
          sleepQuality: Math.round(sleepQualityScore),
          sleepEfficiency: 0,
          stressRecovery: 0,
          regularity: 0,
        },

        flags: {
          unusualNight: false,
          fragmentedSleep,
          lowRecovery,
          highStress: false,
          lateSleep: false,
          possibleIllness: false,
          possibleOvertraining: false,
          irregularPattern: false,
        },

        recommendation: {
          primary: primaryRecommendation,
          secondary: secondaryRecommendation,
          confidence: 75,
        },

        pattern: {
          sleepDebt: 0,
          sleepTrend: 0,
          recoveryTrend: 0,
          stressTrend: 0,
          napTrend: 0,
        },
      };

    } catch (err) {

      log.warn("[KI] reviewSleep failed: " + err);

      return null;
    }
  },
};

// ======================================================================
// Utils
// ======================================================================

function average(arr) {

  const values = arr.filter((v) => Number.isFinite(v));

  if (!values.length) {
    return 0;
  }

  return values.reduce((a, b) => a + b, 0) / values.length;
}

function normalize(value, min, max) {

  if (max <= min) {
    return 50;
  }

  const n = ((value - min) / (max - min)) * 100;

  return Math.max(0, Math.min(100, n));
}

function normalizeInverse(value, min, max) {

  if (max <= min) {
    return 50;
  }

  const n = 100 - (((value - min) / (max - min)) * 100);

  return Math.max(0, Math.min(100, n));
}
