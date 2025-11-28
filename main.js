"use strict";

/*
 * ioBroker Adapter: fitbit-fitness
 * Vollständige Version, rückwärtskompatibel und über Admin-Config steuerbar
 */

const utils = require("@iobroker/adapter-core");
const axios = require("axios").default;
const mSchedule = require("node-schedule");

// ----------------------------------------------------------------------------
// Debug-Optionen (werden NACH dem Laden der Config gesetzt)
// ----------------------------------------------------------------------------
let DEBUG_SLEEP_LOG = false; // Wird in onReady() aus this.effectiveConfig.debugEnabled gesetzt

// Zusätzlicher kompakter Test-Debug-Modus (manuell aktivierbar)
// Nur für Entwickler-Testzwecke – kein Admin-Setting!
// Wenn true, werden pro Schlafdurchlauf kompakte Zusammenfassungen geloggt.
const DEBUG_TEST_MODE = false; // <— bei Bedarf auf false setzen

// -----------------------------------------------------------------------------
// Timeouts und API-Basen
// -----------------------------------------------------------------------------
const axiosTimeout = 15000;
const BASE_URL = "https://api.fitbit.com/1/user/";
const BASE2_URL = "https://api.fitbit.com/1.2/user/";
const HEART_RATE_ZONE_RANGES = ["customHeartRateZones", "heartRateZones"];

// Wie weit darf der berechnete Einschlafzeitpunkt maximal NACH dem Fitbit-Start liegen?
// Schutz gegen Fälle wie: Fitbit 23:20 → Adapter rutscht auf 00:55
const MAX_SLEEP_START_DELAY_MINUTES = 180; // Anpassen möglich (z. B. 60)

// Wie lange darf ein pendingMainSleep maximal "warten", bevor er ohne HR-Analyse verarbeitet wird?
const PENDING_MAIN_SLEEP_MAX_AGE_HOURS = 24; // z. B. 24h

// -----------------------------------------------------------------------------
// Backward-compat Defaults (werden über Admin-Config übersteuert)
// -----------------------------------------------------------------------------
const DEFAULTS = {
  intraday: false,
  showLastOrFirstNap: true,
  clearNapListAtNight: true,
  enableDailyNapClear: false,
  dailyNapClearTime: "02:45",
  ignoreEarlyMainSleepEnabled: true,
  ignoreEarlyMainSleepTime: "23:00",
  smartEarlySleepEnabled: true,
  minMainSleepHours: 3,
  debugEnabled: false,
  sleepStabilityMinutes: 20,
};

class FitBit extends utils.Adapter {
  constructor(options) {
    super({ ...options, name: "fitbit-fitness" });

    // --- Neuer Speicher für wartenden Hauptschlaf ---
    this.pendingMainSleep = null;
    // Serialisierte Schreibzugriffe auf activity.HeartRate-ts
    this._hrTsLock = Promise.resolve();

    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));

    this.updateInterval = null;
    this.sleepSchedule = null;

    this.fitbit = {
      tokens: null,
      status: null,
      user: null,
      sleepRecordsStoredate: null,
    };

    this._recalcInProgress = false;
    this._renewInProgress = false;
    this.FORBIDDEN_CHARS = /[.\[\],]/g;

    // 🧠 Einfaches Debug – wieder wie vorher
    this.dlog = (lvl, msg) => {
      if (DEBUG_SLEEP_LOG && this.log && typeof this.log[lvl] === "function") {
        this.log[lvl](msg);
      }
    };
  }

  // =========================================================================
  // Adapter Start
  // =========================================================================
  async onReady() {
    try {
      await this.setStateAsync("info.connection", { val: false, ack: true });
      // === API Call Counter: Initialisierung ===
      await this.setObjectNotExistsAsync("info.apiCalls.limit", {
        type: "state",
        common: {
          name: "API limit (per hour)",
          type: "number",
          role: "value",
          read: true,
          write: false,
        },
        native: {},
      });
      await this.setObjectNotExistsAsync("info.apiCalls.remaining", {
        type: "state",
        common: {
          name: "API remaining (this hour)",
          type: "number",
          role: "value",
          read: true,
          write: false,
        },
        native: {},
      });
      await this.setObjectNotExistsAsync("info.apiCalls.resetAt", {
        type: "state",
        common: {
          name: "API reset timestamp",
          type: "string",
          role: "date",
          read: true,
          write: false,
        },
        native: {},
      });
      await this.setObjectNotExistsAsync("info.apiCalls.todayTotal", {
        type: "state",
        common: {
          name: "API calls today (sum)",
          type: "number",
          role: "value",
          read: true,
          write: false,
        },
        native: {},
      });
      await this.setObjectNotExistsAsync("info.apiCalls.todayDate", {
        type: "state",
        common: {
          name: "Date of daily counter",
          type: "string",
          role: "text",
          read: true,
          write: false,
        },
        native: {},
      });
      await this.setObjectNotExistsAsync("info.apiCalls.used", {
        type: "state",
        common: {
          name: "API calls used (this hour)",
          type: "number",
          role: "value",
          read: true,
          write: false,
        },
        native: {},
      });
      await this.setObjectNotExistsAsync("info.apiCalls.percentFree", {
        type: "state",
        common: {
          name: "API free in percent",
          type: "number",
          role: "value",
          unit: "%",
          read: true,
          write: false,
        },
        native: {},
      });
      await this.setObjectNotExistsAsync("info.apiCalls.minutesToReset", {
        type: "state",
        common: {
          name: "Minutes until API reset",
          type: "number",
          role: "value",
          unit: "min",
          read: true,
          write: false,
        },
        native: {},
      });

      // API Call Counter: Bestehende Werte übernehmen, falls vorhanden
      const sToday = await this.getStateAsync("info.apiCalls.todayTotal");
      const sDate = await this.getStateAsync("info.apiCalls.todayDate");
      const today = this._todayString();

      if (
        sDate &&
        sDate.val === today &&
        sToday &&
        typeof sToday.val === "number"
      ) {
        this.apiCallsToday = sToday.val;
        this.apiCallsDate = sDate.val;
        this.log.info(
          `API counter restored → ${this.apiCallsToday} calls so far for ${this.apiCallsDate}`,
        );
      } else {
        this.apiCallsToday = 0;
        this.apiCallsDate = today;
        await this.setStateAsync("info.apiCalls.todayTotal", {
          val: 0,
          ack: true,
        });
        await this.setStateAsync("info.apiCalls.todayDate", {
          val: today,
          ack: true,
        });
        this.log.info(`API counter initialized for ${today}`);
      }

      // Heartbeat-Puffer zurücksetzen
      this.recentHeartData = [];

      // ⭐ Restore 48h-Puffer aus TS (MUSS VOR login passieren!)
      await this.restoreRecentHeartDataFromTs();

      this.effectiveConfig = {
        intraday: this._coalesceBool(this.config.intraday, DEFAULTS.intraday),
        showLastOrFirstNap: this._coalesceBool(
          this.config.showLastOrFirstNap,
          DEFAULTS.showLastOrFirstNap,
        ),
        clearNapListAtNight: this._coalesceBool(
          this.config.clearNapListAtNight,
          DEFAULTS.clearNapListAtNight,
        ),
        enableDailyNapClear: this._coalesceBool(
          this.config.enableDailyNapClear,
          DEFAULTS.enableDailyNapClear,
        ),
        dailyNapClearTime: this._validTime(
          this.config.forceClearNapListTime || this.config.dailyNapClearTime,
        )
          ? this.config.forceClearNapListTime || this.config.dailyNapClearTime
          : DEFAULTS.dailyNapClearTime,
        ignoreEarlyMainSleepEnabled: this._coalesceBool(
          this.config.ignoreEarlyMainSleepEnabled,
          DEFAULTS.ignoreEarlyMainSleepEnabled,
        ),
        ignoreEarlyMainSleepTime: this._validTime(
          this.config.ignoreEarlyMainSleepTime,
        )
          ? this.config.ignoreEarlyMainSleepTime
          : DEFAULTS.ignoreEarlyMainSleepTime,
        smartEarlySleepEnabled: this._coalesceBool(
          this.config.smartEarlySleepEnabled,
          DEFAULTS.smartEarlySleepEnabled,
        ),
        minMainSleepHours: Number.isFinite(this.config.minMainSleepHours)
          ? Number(this.config.minMainSleepHours)
          : DEFAULTS.minMainSleepHours,
        debugEnabled: this._coalesceBool(
          this.config.debugEnabled,
          DEFAULTS.debugEnabled,
        ),
        // 🧠 Smart Nap Validation (optional)
        smartNapValidationEnabled: this._coalesceBool(
          this.config.smartNapValidationEnabled,
          false,
        ),
        refresh: Number.isFinite(this.config.refresh)
          ? Number(this.config.refresh)
          : 5,
        sleepStabilityMinutes: Number.isFinite(
          this.config.sleepStabilityMinutes,
        )
          ? Number(this.config.sleepStabilityMinutes)
          : DEFAULTS.sleepStabilityMinutes,
        bodyrecords: !!this.config.bodyrecords,
        activityrecords: !!this.config.activityrecords,
        sleeprecords: !!this.config.sleeprecords,
        sleeprecordsschedule: !!this.config.sleeprecordsschedule,
        foodrecords: !!this.config.foodrecords,
        devicerecords: this._coalesceBool(this.config.devicerecords, true),
        clientId: this.config.clientId || "",
        clientSecret: this.config.clientSecret || "",
        redirectUri: this.config.redirectUri || "",
      };

      DEBUG_SLEEP_LOG = !!this.effectiveConfig.debugEnabled;
      if (DEBUG_SLEEP_LOG) {
        this.log.info(
          "[DEBUG] Erweiterter Debugmodus aktiv – detaillierte Logausgaben eingeschaltet.",
        );
        this.dlog(
          "debug",
          "[DEBUGTEST] dlog() funktioniert – Debug-Ausgaben aktiv",
        );
      }

      // --- Nur Konfiguration immer loggen (einmalig beim Start) ---
      this.log.info(
        "Config → " +
          `intraday=${this.effectiveConfig.intraday ? "on" : "off"}, ` +
          `showLastOrFirstNap=${this.effectiveConfig.showLastOrFirstNap ? "last" : "first"}, ` +
          `clearNapListAtNight=${this.effectiveConfig.clearNapListAtNight ? "on" : "off"}, ` +
          `enableDailyNapClear=${this.effectiveConfig.enableDailyNapClear ? "on @ " + this.effectiveConfig.dailyNapClearTime : "off"}, ` +
          `ignoreEarlyMainSleep=${this.effectiveConfig.ignoreEarlyMainSleepEnabled ? "on < " + this.effectiveConfig.ignoreEarlyMainSleepTime : "off"}, ` +
          `smartEarlySleep=${this.effectiveConfig.smartEarlySleepEnabled ? "on < " + this.effectiveConfig.minMainSleepHours + "h" : "off"}, ` +
          `sleepStability=${this.effectiveConfig.sleepStabilityMinutes}min, ` +
          `debug=${DEBUG_SLEEP_LOG ? "on" : "off"}`,
      );

      this.dlog(
        "info",
        `Intervals → refresh every ${this.effectiveConfig.refresh} min; scheduled sleep fetch=${this.effectiveConfig.sleeprecordsschedule ? "on" : "off"}`,
      );
      this.log.info("[INIT] Sleep processor (Debug-Extended) active");

      await this.login();

      if (this.fitbit.status === 200) {
        await this.setStateAsync("info.connection", { val: true, ack: true });
        await this.initCustomSleepStates();

        // Devices Channel
        await this.setObjectNotExistsAsync("devices", {
          type: "channel",
          common: { name: "FITBIT Devices" },
          native: {},
        });

        this.initSleepSchedule();
        await this.getFitbitRecords();

        // ========================================================================
        // ⭐ Intraday HR – Eigener Scheduler
        // ========================================================================
        if (this.effectiveConfig.intraday) {
          const hrRefreshMs =
            Math.max(1, this.effectiveConfig.refresh) * 60 * 1000;
          this.log.info(
            `Intraday HR → fetch every ${this.effectiveConfig.refresh} min`,
          );

          // Intervall starten
          this.intradayInterval = setInterval(async () => {
            try {
              const refresh = Math.max(
                1,
                Math.round(this.effectiveConfig.refresh),
              );
              const resolution =
                refresh <= 1 ? "1min" : refresh <= 5 ? "5min" : "15min";

              await this.getIntradayHeartRate(resolution);
            } catch (err) {
              this.log.warn(`Intraday fetch failed: ${err}`);
            }
          }, hrRefreshMs);

          // Sofort beim Start einmal ausführen
          const resolution =
            this.effectiveConfig.refresh <= 1
              ? "1min"
              : this.effectiveConfig.refresh <= 5
                ? "5min"
                : "15min";

          await this.getIntradayHeartRate(resolution);
        }

        // ========================================================================
        // ⭐ ZoneMetrics HR – Fast-Live fallback (gleiche Rate, gleiche Bedingung)
        // ========================================================================
        if (this.effectiveConfig.intraday) {
          const zmRefreshMs =
            Math.max(1, this.effectiveConfig.refresh) * 60 * 1000;
          this.log.info(
            `ZoneMetrics → fetch every ${this.effectiveConfig.refresh} min`,
          );

          this.zoneMetricsInterval = setInterval(async () => {
            try {
              await this.getZoneMetrics();
            } catch (err) {
              this.log.warn(`ZoneMetrics fetch failed: ${err}`);
            }
          }, zmRefreshMs);

          // Sofort beim Start einmal ausführen
          await this.getZoneMetrics();
        }

        // ========================================================================
        // Normaler Tages-Update-Scheduler (Sleep, Steps, Weight, etc.)
        // ========================================================================
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
        }

        const refreshMs = Math.max(1, this.effectiveConfig.refresh) * 60 * 1000;
        this.updateInterval = setInterval(async () => {
          try {
            await this.getFitbitRecords();
          } catch (err) {
            this.log.error(`Periodic fetch failed: ${err}`);
          }
        }, refreshMs);
      } else {
        await this.setStateAsync("info.connection", { val: false, ack: true });
        this.log.warn(`FITBIT login failed with status ${this.fitbit.status}`);
      }
    } catch (error) {
      this.log.error(`Adapter start failed: ${error}`);
    }

    this.subscribeStates("body.weight");
    this.subscribeStates("sleep.Recalculate");
  }

  // =========================================================================
  // Sleep States anlegen (inkl. HR-Analyse + History)
  // =========================================================================
  async initCustomSleepStates() {
    // ---------------------------------------------------------------------------
    // Minuten-States
    // ---------------------------------------------------------------------------
    const minuteStates = [
      {
        id: "sleep.AsleepTotal",
        name: "Total minutes asleep (incl. naps)",
        unit: "min",
      },
      {
        id: "sleep.InBedTotal",
        name: "Total minutes in bed (incl. naps)",
        unit: "min",
      },
      { id: "sleep.Naps.Asleep", name: "Minutes asleep in naps", unit: "min" },
      {
        id: "sleep.Naps.InBed",
        name: "Minutes in bed during naps",
        unit: "min",
      },
      { id: "sleep.Naps.Count", name: "Number of naps", unit: "" },
      {
        id: "sleep.Naps.ValidCount",
        name: "Number of validated naps",
        unit: "",
      },
    ];

    for (const s of minuteStates) {
      await this.setObjectNotExistsAsync(s.id, {
        type: "state",
        common: {
          name: s.name,
          type: "number",
          role: "value",
          unit: s.unit,
          read: true,
          write: true,
        },
        native: {},
      });
    }

    // ---------------------------------------------------------------------------
    // Zeit-States
    // ---------------------------------------------------------------------------
    const timeStates = [
      {
        id: "sleep.Main.FellAsleepAt",
        name: "Main sleep - fell asleep at (ISO)",
      },
      {
        id: "sleep.Main.FellAsleepAtLocal",
        name: "Main sleep - fell asleep at (local de-DE)",
      },
      { id: "sleep.Main.WokeUpAt", name: "Main sleep - woke up at (ISO)" },
      {
        id: "sleep.Main.WokeUpAtLocal",
        name: "Main sleep - woke up at (local de-DE)",
      },
      { id: "sleep.Naps.FellAsleepAt", name: "Nap - fell asleep at (ISO)" },
      {
        id: "sleep.Naps.FellAsleepAtLocal",
        name: "Nap - fell asleep at (local de-DE)",
      },
      { id: "sleep.Naps.WokeUpAt", name: "Nap - woke up at (ISO)" },
      {
        id: "sleep.Naps.WokeUpAtLocal",
        name: "Nap - woke up at (local de-DE)",
      },
      { id: "sleep.Naps.List", name: "List of today naps as JSON" },
      { id: "sleep.Naps.ValidList", name: "List of validated naps as JSON" },
    ];

    for (const s of timeStates) {
      await this.setObjectNotExistsAsync(s.id, {
        type: "state",
        common: {
          name: s.name,
          type: "string",
          role: "text",
          read: true,
          write: true,
        },
        native: {},
      });
    }

    // ---------------------------------------------------------------------------
    // Recalculate Button + Raw Sleep Data Storage
    // ---------------------------------------------------------------------------
    await this.setObjectNotExistsAsync("sleep.Recalculate", {
      type: "state",
      common: {
        name: "Recalculate sleep data from last RawData",
        type: "boolean",
        role: "button",
        read: true,
        write: true,
      },
      native: {},
    });

    await this.setObjectNotExistsAsync("sleep.RawData", {
      type: "state",
      common: {
        name: "Last raw sleep JSON from Fitbit",
        type: "string",
        role: "json",
        read: true,
        write: false,
      },
      native: {},
    });

    await this.setObjectNotExistsAsync("sleep.LastRecalculated", {
      type: "state",
      common: {
        name: "Timestamp of last recalculation",
        type: "string",
        role: "date",
        read: true,
        write: false,
      },
      native: {},
    });

    // ---------------------------------------------------------------------------
    // HR-Analyse States
    // ---------------------------------------------------------------------------
    const hrStates = [
      {
        id: "sleep.HRDropAtSleep",
        name: "Herzfrequenzabfall beim Einschlafen",
        unit: "BPM",
      },
      {
        id: "sleep.HRBeforeSleep",
        name: "Durchschnitt HR vor Einschlafen",
        unit: "BPM",
      },
      {
        id: "sleep.HRAfterSleep",
        name: "Durchschnitt HR nach Einschlafen",
        unit: "BPM",
      },
    ];

    for (const s of hrStates) {
      await this.setObjectNotExistsAsync(s.id, {
        type: "state",
        common: {
          name: s.name,
          type: "number",
          role: "value",
          unit: s.unit,
          read: true,
          write: false,
        },
        native: {},
      });
    }

    // ---------------------------------------------------------------------------
    // Sleep History States
    // ---------------------------------------------------------------------------
    await this.setObjectNotExistsAsync("sleep.History", {
      type: "channel",
      common: { name: "Sleep History" },
      native: {},
    });

    await this.setObjectNotExistsAsync("sleep.History.JSON", {
      type: "state",
      common: {
        name: "History of sleep data (JSON)",
        type: "string",
        role: "json",
        read: true,
        write: false,
      },
      native: {},
    });

    await this.setObjectNotExistsAsync("sleep.History.LastEntry", {
      type: "state",
      common: {
        name: "Last history entry",
        type: "string",
        role: "json",
        read: true,
        write: false,
      },
      native: {},
    });
  } // <<< END of initCustomSleepStates()

  // =========================================================================
  // Login + Tokenprüfung
  // =========================================================================
  async login() {
    try {
      const accessToken = await this.getStateAsync("tokens.access");
      const refreshToken = await this.getStateAsync("tokens.refresh");
      if (accessToken && refreshToken && accessToken.val && refreshToken.val) {
        this.fitbit.tokens = {
          access_token: String(accessToken.val),
          refresh_token: String(refreshToken.val),
        };
      } else throw new Error("no tokens available. Recreate token in config");

      const url = "https://api.fitbit.com/1/user/-/profile.json";
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${this.fitbit.tokens.access_token}` },
        timeout: axiosTimeout,
      });

      this.fitbit.status = response.status;
      if (response.status === 200) {
        await this.setStateAsync("info.connection", { val: true, ack: true });
        this.setUserStates(response.data);
        this.log.info(`Login OK for user ${this.fitbit.user?.fullName || "?"}`);
      } else throw new Error(`Login failed with status ${response.status}`);
    } catch (err) {
      throw new Error(err);
    }
  }

  setUserStates(data) {
    this.fitbit.user = data.user || {};
    this.log.info(
      `User logged in ${this.fitbit.user.fullName} id:${this.fitbit.user.encodedId}`,
    );
    this.setState("user.fullName", this.fitbit.user.fullName || "", true);
    this.setState("user.userid", this.fitbit.user.encodedId || "", true);
  }

  // =========================================================================
  // Sleep-Schedule
  // =========================================================================
  initSleepSchedule() {
    if (
      this.effectiveConfig.sleeprecords &&
      this.effectiveConfig.sleeprecordsschedule
    ) {
      const rndMinutes = Math.floor(Math.random() * 59);
      const rndHours = 20 + Math.floor(Math.random() * 3);
      this.log.info(
        `Sleep schedule: daily ${rndHours}:${rndMinutes.toString().padStart(2, "0")} (randomized)`,
      );
      this.sleepSchedule = mSchedule.scheduleJob(
        `${rndMinutes} ${rndHours} * * *`,
        () => {
          if (this.effectiveConfig.sleeprecords) this.getSleepRecords();
        },
      );
    }

    if (this.effectiveConfig.enableDailyNapClear) {
      const t =
        this.effectiveConfig.dailyNapClearTime || DEFAULTS.dailyNapClearTime;
      const [h, m] = String(t).split(":");
      const hour = parseInt(h, 10);
      const min = parseInt(m, 10);
      if (!isNaN(hour) && !isNaN(min)) {
        this.log.info(`Daily nap reset scheduled at ${t}`);
        mSchedule.scheduleJob(`${min} ${hour} * * *`, async () => {
          this.log.info("Nap reset schedule triggered");
          try {
            await this._clearNapStates();
            this.log.info("Nap states cleared (scheduled reset)");
          } catch (e) {
            this.log.error(`Error clearing naps: ${e}`);
          }
        });
      } else {
        this.log.warn(`dailyNapClearTime "${t}" is invalid (expected HH:MM)`);
      }
    }
  }

  // =========================================================================
  // Hauptabruf
  // =========================================================================
  async getFitbitRecords(retry = false) {
    try {
      // Token ggf. erneuern
      await this.checkToken();

      // Aktivitäten & Herz
      if (this.effectiveConfig.activityrecords) {
        await this.getActivityRecords();
        await this.getHeartRateTimeSeries();
      }

      // Körper
      if (this.effectiveConfig.bodyrecords) {
        await this.getBodyRecords();
      }

      // Food
      if (this.effectiveConfig.foodrecords) {
        await this.getFoodRecords();
      }

      // Schlaf
      if (this.effectiveConfig.sleeprecords) {
        if (this.effectiveConfig.sleeprecordsschedule) {
          this.dlog(
            "debug",
            `Sleep via daily schedule active → skip in interval fetch`,
          );
        } else {
          await this.getSleepRecords();
        }
      }

      // ------------------------------------------------------------
      // Falls ein Hauptschlaf auf HR-Daten wartet → prüfen
      // ------------------------------------------------------------
      if (this.pendingMainSleep) {
        await this.checkNightHRAndProcess();
      }

      //
      // Geräte
      //
      if (this.effectiveConfig.devicerecords) {
        try {
          const deviceResponse = await this.getDeviceRecords();

          if (
            deviceResponse &&
            deviceResponse.status === 200 &&
            Array.isArray(deviceResponse.data?.devices)
          ) {
            this.fitbit.devices = deviceResponse.data.devices;
            this.dlog(
              "debug",
              `Device info cached (${deviceResponse.data.devices.length} Geräte)`,
            );
          } else if (Array.isArray(deviceResponse?.data)) {
            this.fitbit.devices = deviceResponse.data;
            this.dlog(
              "debug",
              `Device info cached (${deviceResponse.data.length} Geräte, direct array)`,
            );
          } else {
            this.dlog(
              "debug",
              "Device info not cached (unexpected response format)",
            );
          }
        } catch (err) {
          this.log.warn(`Device info fetch failed: ${err.message}`);
        }
      }
    } catch (err) {
      // 401 → einmalig Token erneuern und retry
      if (err && err.response && err.response.status === 401) {
        if (!retry) {
          this.log.warn("401 Unauthorized → try token renew and retry once...");
          const renewed = await this.renewToken();
          if (renewed) return this.getFitbitRecords(true);
        }
        this.log.error(
          "Still 401 after renew attempt. Manual re-auth may be required.",
        );
      }

      // 429 → Too Many Requests (Rate Limit)
      else if (err && err.response && err.response.status === 429) {
        const retryAfter = Number(err.response.headers?.["retry-after"] || 120); // meist Sekunden
        const waitMs = Math.min(retryAfter * 1000, 5 * 60 * 1000); // max. 5 Min pausieren
        this.log.warn(
          `⚠️ Fitbit API rate limit hit (429). Pausing requests for ${Math.round(waitMs / 1000)} seconds.`,
        );
        await this.setStateAsync("info.connection", { val: false, ack: true });

        // Pause, damit Fitbit sich wieder fängt
        await new Promise((res) => setTimeout(res, waitMs));

        await this.setStateAsync("info.connection", { val: true, ack: true });
        this.log.info("Resuming Fitbit requests after rate-limit pause.");
      }

      // Sonstige Fehler
      else {
        const msg = err?.message || JSON.stringify(err);
        this.log.error(`Data retrieval error: ${msg}`);
      }
    }
  }

  // =========================================================================
  // Aktivitäten
  // =========================================================================
  async getActivityRecords() {
    const url = `${BASE_URL}-/activities/date/${this.getDateTime().dateString}.json`;
    const token = this.fitbit.tokens.access_token;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: axiosTimeout,
      });

      if (response.status === 200) {
        if (!this.setActivityStates(response.data)) {
          this.dlog(`debug`, `No activity records available`);
        } else {
          this.dlog(`debug`, `Activity records updated`);
        }
      }
    } catch (err) {
      this.log.warn(`getActivityRecords: ${err}`);
    }
  }

  setActivityStates(data) {
    if (!data || !data.summary) return false;

    this.fitbit.activities = data;

    this.setState("activity.Steps", data.summary.steps || 0, true);
    this.setState("activity.Floors", data.summary.floors || 0, true);
    this.setState(
      "activity.ActiveMinutes",
      data.summary.veryActiveMinutes || 0,
      true,
    );
    this.setState(
      "activity.RestingHeartRate",
      data.summary.restingHeartRate || 0,
      true,
    );
    this.setState("activity.Calories", data.summary.caloriesOut || 0, true);
    this.setState(
      "activity.ActivitiesCount",
      (data.activities && data.activities.length) || 0,
      true,
    );

    return true;
  }

  // =========================================================================
  // Herzfrequenz Tagesübersicht + Zonen
  // =========================================================================
  async getHeartRateTimeSeries() {
    const url = `${BASE_URL}-/activities/heart/date/today/1d.json`;
    const token = this.fitbit.tokens.access_token;

    try {
      const response = await axios({
        url,
        method: "get",
        headers: { Authorization: `Bearer ${token}` },
        timeout: axiosTimeout,
      });
      if (response.status === 200) {
        if (!this.setHeartRateTimeSeries(response.data)) {
          this.dlog(`debug`, `No heart rate time series available`);
        } else {
          this.dlog(`debug`, `Heart rate time series updated`);
        }
      }
      // === Fitbit Rate-Limit Header-Auswertung + Tageszähler ===
      if (response && response.headers) {
        const lim = Number(response.headers["fitbit-rate-limit-limit"] || 0);
        const rem = Number(
          response.headers["fitbit-rate-limit-remaining"] || 0,
        );
        const reset = response.headers["fitbit-rate-limit-reset"];

        if (lim > 0)
          await this.setStateAsync("info.apiCalls.limit", {
            val: lim,
            ack: true,
          });
        if (rem >= 0)
          await this.setStateAsync("info.apiCalls.remaining", {
            val: rem,
            ack: true,
          });

        if (reset && Number(reset) > 1000000000) {
          const ts = new Date(Number(reset) * 1000);
          await this.setStateAsync("info.apiCalls.resetAt", {
            val: ts.toISOString(),
            ack: true,
          });
        } else {
          await this.setStateAsync("info.apiCalls.resetAt", {
            val: "rolling window",
            ack: true,
          });
        }

        const today = this._todayString();
        if (today !== this.apiCallsDate) {
          this.apiCallsDate = today;
          this.apiCallsToday = 0;
          await this.setStateAsync("info.apiCalls.todayTotal", {
            val: 0,
            ack: true,
          });
          await this.setStateAsync("info.apiCalls.todayDate", {
            val: today,
            ack: true,
          });
        }
        // Puffer nur leeren, wenn intraday aktiv und wirklich neuer Tag
        if (
          this.effectiveConfig.intraday &&
          this.recentHeartData.length > 0 &&
          this.recentHeartData[0].ts.toISOString().slice(0, 10) !== today
        ) {
          this.recentHeartData = [];
          this.dlog("debug", "HR buffer cleared for new day (intraday active)");
        }

        this.apiCallsToday++;
        await this.setStateAsync("info.apiCalls.todayTotal", {
          val: this.apiCallsToday,
          ack: true,
        });
        // === Erweiterte API-Infos berechnen ===
        const used = lim > 0 ? lim - rem : 0;
        const percentFree = lim > 0 ? Math.round((rem / lim) * 100) : 0;
        let minutesToReset = 0;
        if (reset && Number(reset) > 1000000000) {
          const resetTime = new Date(Number(reset) * 1000);
          const diffMin = Math.round((resetTime - new Date()) / 60000);
          minutesToReset = diffMin > 0 ? diffMin : 0;
        }

        await this.setStateAsync("info.apiCalls.used", {
          val: used,
          ack: true,
        });
        await this.setStateAsync("info.apiCalls.percentFree", {
          val: percentFree,
          ack: true,
        });
        await this.setStateAsync("info.apiCalls.minutesToReset", {
          val: minutesToReset,
          ack: true,
        });

        this.dlog(
          "debug",
          `API usage: limit=${lim}, used=${used}, remaining=${rem}, free=${percentFree}%, reset in ${minutesToReset}min`,
        );
      }
    } catch (err) {
      this.log.error(`Error in getHeartRateTimeSeries: ${err}`);
    }
  }

  async setHeartRateTimeSeries(data) {
    if (!data || !data["activities-heart"]) return false;

    const zoneMinutes = {
      "Out of Range": 0,
      "Fat Burn": 0,
      Cardio: 0,
      Peak: 0,
    };

    for (const entry of data["activities-heart"]) {
      const val = entry.value || {};

      for (const zonesKey of Object.keys(val).filter((k) =>
        HEART_RATE_ZONE_RANGES.includes(k),
      )) {
        const zonesArr = Array.isArray(val[zonesKey]) ? val[zonesKey] : [];
        for (const zone of zonesArr) {
          const zoneName = String(zone.name || "Zone").replace(
            this.FORBIDDEN_CHARS,
            "_",
          );

          if (zone.name && typeof zone.minutes === "number") {
            zoneMinutes[zone.name] = zone.minutes;
          }

          for (const k of Object.keys(zone).filter((k) => k !== "name")) {
            const entryValueName = k.replace(this.FORBIDDEN_CHARS, "_");
            const id = `activity.heartratezones.${zoneName}.${entryValueName}`;

            await this.setObjectNotExistsAsync(id, {
              type: "state",
              common: {
                name: `${k} - ${zoneName}`,
                type: "number",
                read: true,
                write: true,
              },
              native: {},
            });
            await this.setStateAsync(id, { val: zone[k] ?? 0, ack: true });
          }

          const idCustom = `activity.heartratezones.${zoneName}.isCustom`;
          await this.setObjectNotExistsAsync(idCustom, {
            type: "state",
            common: {
              name: "custom heart rate zone",
              type: "boolean",
              read: true,
              write: true,
            },
            native: {},
          });
          await this.setStateAsync(idCustom, {
            val: zonesKey.includes("custom"),
            ack: true,
          });
        }
      }

      if (entry.value && typeof entry.value.restingHeartRate === "number") {
        await this.setStateAsync("activity.RestingHeartRate", {
          val: entry.value.restingHeartRate,
          ack: true,
        });
      }
    }

    await this.setStateAsync(
      "activity.heartratezones.OutOfRange.minutes",
      zoneMinutes["Out of Range"] || 0,
      true,
    );
    await this.setStateAsync(
      "activity.heartratezones.FatBurn.minutes",
      zoneMinutes["Fat Burn"] || 0,
      true,
    );
    await this.setStateAsync(
      "activity.heartratezones.Cardio.minutes",
      zoneMinutes["Cardio"] || 0,
      true,
    );
    await this.setStateAsync(
      "activity.heartratezones.Peak.minutes",
      zoneMinutes["Peak"] || 0,
      true,
    );

    return true;
  }

  /**
   * Serialisiert alle Lese/Schreibzugriffe auf activity.HeartRate-ts.
   * Alle Aufrufer von HeartRate-ts müssen durch diesen Wrapper laufen.
   */
  async _withHrTsLock(label, fn) {
    this._hrTsLock = this._hrTsLock
      .then(() => fn())
      .catch((err) => {
        const msg = err?.message || err;
        this.log.error(`[HR-TS-LOCK] ${label} failed: ${msg}`);
      });

    return this._hrTsLock;
  }

  // ============================================================================
  // Intraday Herzfrequenz – 72h TS + 48h interner Puffer (mit Mutex)
  // ============================================================================
  async getIntradayHeartRate(resolution = "1min") {
    if (!this.fitbit.tokens || !this.effectiveConfig.intraday) return;

    const token = this.fitbit.tokens.access_token;
    const userId = "-";
    const url = `https://api.fitbit.com/1/user/${userId}/activities/heart/date/today/1d/${resolution}.json`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: axiosTimeout,
      });

      const dataset =
        response?.data?.["activities-heart-intraday"]?.dataset || [];
      if (!dataset.length) {
        this.log.warn("Intraday → Kein Dataset erhalten");
        return;
      }

      const now = new Date();
      const todayDateString = now.toISOString().split("T")[0];

      // Alles, was HeartRate-ts liest/schreibt, läuft durch den Mutex
      await this._withHrTsLock("getIntradayHeartRate", async () => {
        // ---------------------------------------------------------------------
        // (1) Bestehende TS laden
        // ---------------------------------------------------------------------
        const tsId = "activity.HeartRate-ts";
        await this.setObjectNotExistsAsync(tsId, {
          type: "state",
          common: {
            name: "Intraday HR (72h)",
            type: "string",
            role: "json",
            read: true,
            write: false,
          },
          native: {},
        });

        const existing = await this.getStateAsync(tsId);
        let oldArr = [];

        if (existing?.val) {
          try {
            oldArr = JSON.parse(existing.val);
          } catch {
            oldArr = [];
          }
        }

        // ---------------------------------------------------------------------
        // (2) Merge ohne Duplikate
        // ---------------------------------------------------------------------
        const map = new Map();

        // alte Daten übernehmen
        for (const o of oldArr) {
          map.set(o.ts, o.value);
        }

        // neue Daten einfügen (überschreiben gleiche ts)
        for (const entry of dataset) {
          const fullTs = new Date(
            `${todayDateString}T${entry.time}`,
          ).toISOString();
          map.set(fullTs, entry.value);
        }

        // map zurück in Array (sortiert)
        let merged = Array.from(map, ([ts, value]) => ({ ts, value })).sort(
          (a, b) => new Date(a.ts) - new Date(b.ts),
        );

        // ---------------------------------------------------------------------
        // (3) Auf 72 Stunden beschränken
        // ---------------------------------------------------------------------
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - 72);

        let pruned = merged.filter((p) => new Date(p.ts) >= cutoff);

        // ---------------------------------------------------------------------
        // (4) internen Puffer aktualisieren (48h)
        // ---------------------------------------------------------------------
        if (!this.recentHeartData) this.recentHeartData = [];

        const cutoff48 = new Date();
        cutoff48.setHours(cutoff48.getHours() - 48);

        for (const entry of dataset) {
          const ts = new Date(`${todayDateString}T${entry.time}`);
          if (ts >= cutoff48) {
            this.recentHeartData.push({ ts, value: entry.value });
          }
        }

        this.recentHeartData = this.recentHeartData
          .filter((p) => p.ts >= cutoff48)
          .slice(-5000); // Falls 1-min-Betrieb, zur Sicherheit

        /***********************************************************************
         * ⭐ HEART RATE FALLBACK (zoneMetrics → HeartRate-ts + recentHeartData)
         ***********************************************************************/
        try {
          const refreshMin = Math.max(1, this.effectiveConfig.refresh);
          const nowMinute = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours(),
            now.getMinutes(),
            0,
            0,
          );

          // Letzten realen HR-Wert im 48h-Puffer suchen
          let lastReal = null;
          if (this.recentHeartData.length > 0) {
            lastReal = this.recentHeartData[this.recentHeartData.length - 1].ts;
          }

          if (lastReal) {
            const diffMin = Math.round((nowMinute - lastReal) / 60000);

            // Fallback nach 2× Refresh
            if (diffMin > refreshMin * 2) {
              const zone = await this.getStateAsync("activity.zoneMetrics");

              if (zone?.val) {
                const z = JSON.parse(zone.val);
                if (z?.bpm && Number.isFinite(z.bpm)) {
                  const tsIso = nowMinute.toISOString();

                  // Prüfen, ob in recentHeartData bereits ein Wert existiert
                  const hasTS =
                    this.recentHeartData.some(
                      (p) => p.ts.toISOString() === tsIso,
                    ) || pruned.some((p) => p.ts === tsIso);

                  if (!hasTS) {
                    this.log.info(
                      `[HR-Fallback] Insert fallback HR ${z.bpm} at ${tsIso}`,
                    );

                    // In BOTH schreiben:
                    this.recentHeartData.push({
                      ts: nowMinute,
                      value: z.bpm,
                      source: "fallback",
                    });

                    // HeartRate-ts (pruned) erweitern:
                    pruned.push({
                      ts: tsIso,
                      value: z.bpm,
                      source: "fallback",
                    });
                  }
                }
              }
            }
          }

          // Neu sortieren nach möglichem Fallback-Insert
          this.recentHeartData.sort((a, b) => a.ts - b.ts);
          pruned.sort((a, b) => new Date(a.ts) - new Date(b.ts));
        } catch (e) {
          this.log.error("HR-Fallback error: " + e.message);
        }

        // ---------------------------------------------------------------------
        // (5) TS speichern (immer innerhalb des Mutex!)
        // ---------------------------------------------------------------------
        await this.setStateAsync(tsId, {
          val: JSON.stringify(pruned),
          ack: true,
        });
      }); // Ende _withHrTsLock

      // ---------------------------------------------------------------------
      // (6) CurrentHeartRate aktualisieren (kein TS-Write, daher ohne Lock)
      // ---------------------------------------------------------------------
      const last = dataset[dataset.length - 1];
      await this.setObjectNotExistsAsync("activity.CurrentHeartRate", {
        type: "state",
        common: {
          name: "Current Heart Rate",
          type: "number",
          role: "value.bpm",
          read: true,
          write: false,
        },
        native: {},
      });

      await this.setStateAsync("activity.CurrentHeartRate", {
        val: last.value,
        ack: true,
      });
    } catch (err) {
      this.log.error(`getIntradayHeartRate ERROR → ${err.message}`);
    }
  }

  // ============================================================================
  // Add/merge single HR point (used by zoneMetrics + fallback) – mit Mutex
  // ============================================================================
  async addHeartRatePoint(point) {
    await this._withHrTsLock("addHeartRatePoint", async () => {
      const tsId = "activity.HeartRate-ts";

      // TS laden oder anlegen
      await this.setObjectNotExistsAsync(tsId, {
        type: "state",
        common: {
          name: "Intraday HR (72h)",
          type: "string",
          role: "json",
          read: true,
          write: false,
        },
        native: {},
      });

      let pruned = [];
      const existing = await this.getStateAsync(tsId);
      if (existing?.val) {
        try {
          pruned = JSON.parse(existing.val);
        } catch {
          pruned = [];
        }
      }

      // Map für effizienten Merge
      const map = new Map(pruned.map((p) => [p.ts, p.value]));

      // Einfügen/Ersetzen
      map.set(point.ts.toISOString(), point.value);

      // Neu sortieren
      pruned = Array.from(map, ([ts, value]) => ({ ts, value })).sort(
        (a, b) => new Date(a.ts) - new Date(b.ts),
      );

      // Auf 72h begrenzen
      const cutoff72 = new Date();
      cutoff72.setHours(cutoff72.getHours() - 72);
      pruned = pruned.filter((p) => new Date(p.ts) >= cutoff72);

      // TS speichern
      await this.setStateAsync(tsId, {
        val: JSON.stringify(pruned),
        ack: true,
      });

      // Interner 48h-Puffer aktualisieren
      const cutoff48 = new Date();
      cutoff48.setHours(cutoff48.getHours() - 48);
      this.recentHeartData.push(point);
      this.recentHeartData = this.recentHeartData
        .filter((p) => p.ts >= cutoff48)
        .slice(-5000);
    });
  }

  // ============================================================================
  // zoneMetrics → Fast-Live Puls, alle 5 Min
  // ============================================================================
  async getZoneMetrics() {
    try {
      const apiUrl =
        "https://api.fitbit.com/1/user/-/activities/heart/date/today/1d/1min.json";
      const token = this.fitbit.tokens?.access_token;
      if (!token) return;

      const response = await axios.get(apiUrl, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });

      // Fitbit liefert heute letzten HR-Wert immer im dataset letzte Position
      const ds = response?.data?.["activities-heart-intraday"]?.dataset;
      if (!Array.isArray(ds) || ds.length === 0) return;

      const last = ds[ds.length - 1];
      if (!last || !last.time || !last.value) return;

      const today = new Date().toISOString().slice(0, 10);
      const ts = new Date(`${today}T${last.time}`);

      await this.addHeartRatePoint({
        ts,
        value: last.value,
        source: "zonemetrics",
      });

      // sichtbarer State
      await this.setObjectNotExistsAsync("activity.zoneMetrics", {
        type: "state",
        common: {
          name: "ZoneMetrics HR",
          type: "string",
          role: "json",
          read: true,
          write: false,
        },
        native: {},
      });

      await this.setStateAsync("activity.zoneMetrics", {
        val: JSON.stringify({ bpm: last.value, ts: ts.toISOString() }),
        ack: true,
      });
    } catch (err) {
      this.log.warn("ZoneMetrics error: " + err.message);
    }
  }

  // =========================================================================
  // Geräte
  // =========================================================================
  async getDeviceRecords() {
    const url = `${BASE_URL}-/devices.json`;
    const token = this.fitbit.tokens.access_token;
    let response = null; // <— Variable vorab definieren

    try {
      response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: axiosTimeout,
      });

      if (response.status === 200) {
        await this.setDeviceStates(response.data);
      }
    } catch (err) {
      this.log.warn(`getDeviceRecords: ${err}`);
    }

    return response;
  }

  async setDeviceStates(data) {
    if (!Array.isArray(data)) return false;

    for (const device of data) {
      const channelId = `devices.${device.id}`;
      const channelName = device.deviceVersion || `Device ${device.id}`;

      await this.setObjectNotExistsAsync(channelId, {
        type: "channel",
        common: { name: channelName },
        native: {},
      });

      const states = [
        { id: "battery", val: device.battery || "unknown", type: "string" },
        {
          id: "batteryLevel",
          val: Number(device.batteryLevel) || 0,
          type: "number",
        },
        { id: "type", val: device.type || "unknown", type: "string" },
        {
          id: "batteryAlarm",
          val: String(device.battery || "").toLowerCase() === "empty",
          type: "boolean",
        },
      ];

      for (const s of states) {
        const sid = `${channelId}.${s.id}`;
        await this.setObjectNotExistsAsync(sid, {
          type: "state",
          common: { name: s.id, type: s.type, read: true, write: true },
          native: {},
        });
        await this.setStateAsync(sid, { val: s.val, ack: true });
      }
    }

    // === Letzte Synchronisation (alle Geräte) ===
    const lastSyncDevice = data
      .filter((d) => d.lastSyncTime)
      .sort((a, b) => new Date(b.lastSyncTime) - new Date(a.lastSyncTime))[0];

    if (lastSyncDevice) {
      const syncTime = new Date(lastSyncDevice.lastSyncTime);
      const now = new Date();
      const hoursDiff = (now - syncTime) / (1000 * 60 * 60);

      // info.lastSyncHours
      await this.setObjectNotExistsAsync("info.lastSyncHours", {
        type: "state",
        common: {
          name: "Stunden seit letzter Synchronisation",
          type: "number",
          role: "value",
          unit: "h",
          read: true,
          write: false,
        },
        native: {},
      });
      await this.setStateAsync("info.lastSyncHours", {
        val: Number(hoursDiff.toFixed(2)),
        ack: true,
      });

      // Gerät-spezifisch
      const devId = `devices.${lastSyncDevice.id}`;
      await this.setObjectNotExistsAsync(`${devId}.lastSyncTime`, {
        type: "state",
        common: {
          name: "Letzte Synchronisation (UTC)",
          type: "string",
          role: "date",
          read: true,
          write: false,
        },
        native: {},
      });
      await this.setStateAsync(`${devId}.lastSyncTime`, {
        val: lastSyncDevice.lastSyncTime,
        ack: true,
      });

      await this.setObjectNotExistsAsync(`${devId}.lastSyncLocal`, {
        type: "state",
        common: {
          name: "Letzte Synchronisation (lokal)",
          type: "string",
          role: "text",
          read: true,
          write: false,
        },
        native: {},
      });
      await this.setStateAsync(`${devId}.lastSyncLocal`, {
        val: this.formatDE_Short(syncTime),
        ack: true,
      });

      this.dlog(
        "info",
        `${lastSyncDevice.deviceVersion || "Gerät"} zuletzt synchronisiert: ${this.formatDE_Short(syncTime)} (vor ${hoursDiff.toFixed(2)}h)`,
      );
      this.dlog(
        "info",
        `Aktuellster Sync stammt von: ${lastSyncDevice.deviceVersion || "unknown"} (${this.formatDE_Short(syncTime)})`,
      );
    }
  }

  // =========================================================================
  // Körper
  // =========================================================================
  async getBodyRecords() {
    const url = `${BASE_URL}-/body/log/weight/date/${this.getDateTime().dateString}.json`;
    const token = this.fitbit.tokens.access_token;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: axiosTimeout,
      });

      if (response.status === 200) {
        if (!this.setBodyStates(response.data)) {
          this.dlog(`debug`, `No body records available`);
        }
      }
    } catch (err) {
      this.log.warn(`getBodyRecords: ${err}`);
    }
  }

  setBodyStates(data) {
    if (!data || !Array.isArray(data.weight) || data.weight.length === 0)
      return false;

    this.fitbit.body = data.weight.slice(-1)[0];
    if (this.fitbit.body.weight != null)
      this.setState("body.weight", this.fitbit.body.weight, true);
    if (this.fitbit.body.fat != null)
      this.setState("body.fat", this.fitbit.body.fat, true);
    if (this.fitbit.body.bmi != null)
      this.setState("body.bmi", this.fitbit.body.bmi, true);

    return true;
  }

  // =========================================================================
  // Food
  // =========================================================================
  async getFoodRecords() {
    const url = `${BASE_URL}-/foods/log/date/${this.getDateTime().dateString}.json`;
    const token = this.fitbit.tokens.access_token;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: axiosTimeout,
      });

      if (response.status === 200) {
        if (!this.setFoodStates(response.data)) {
          this.dlog(`debug`, `No food records available`);
        }
      }
    } catch (err) {
      this.log.warn(`getFoodRecords: ${err}`);
    }
  }

  setFoodStates(data) {
    if (!data || !data.summary) return false;

    const f = data.summary;
    const foodStates = [
      { id: "food.Water", val: f.water },
      { id: "food.Calories", val: f.calories },
      { id: "food.Carbs", val: f.carbs },
      { id: "food.Sodium", val: f.sodium },
      { id: "food.Fiber", val: f.fiber },
      { id: "food.Fat", val: f.fat },
      { id: "food.Protein", val: f.protein },
    ];

    for (const s of foodStates) {
      this.setState(s.id, s.val != null ? s.val : 0, true);
    }
    return true;
  }

  // =========================================================================
  // Sleep – Abruf
  // =========================================================================
  async getSleepRecords() {
    const url = `${BASE2_URL}-/sleep/date/${this.getDateTime().dateString}.json`;
    const token = this.fitbit.tokens.access_token;

    try {
      if (this.effectiveConfig.clearNapListAtNight) {
        const hour = new Date().getHours();
        if (hour >= 0 && hour < 4) {
          this.log.info(
            "clearNapListAtNight → Liste wird geleert (nach Mitternacht).",
          );
          await this._clearNapStates({ onlyList: true });
        }
      }

      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: axiosTimeout,
      });

      if (response.status === 200) {
        await this.setStateAsync("sleep.RawData", {
          val: JSON.stringify(response.data),
          ack: true,
        });

        // 🔥 WICHTIG: setSleepStates ist async → wir müssen warten!
        const ok = await this.setSleepStates(response.data);

        if (!ok) {
          await this._clearNapStates({ onlyList: true });
          this.dlog(`debug`, `No sleep data available`);
        }
      } else {
        this.log.warn(`getSleepRecords unexpected status: ${response.status}`);
      }
    } catch (err) {
      this.log.error(`getSleepRecords failed: ${err}`);
    }
  }

  // ===========================================================================
  //  FITBIT SLEEP PROCESSING — Modular + Debug-Extended
  // ===========================================================================

  // ---- 1. zentrale Filterkette ----------------------------------------------
  filterSleepBlocks(blocks, cfg, options = {}) {
    if (!Array.isArray(blocks) || blocks.length === 0) return [];

    let arr = blocks.slice();
    const dbg = (msg) => this.dlog("debug", msg);

    // === Early Sleep Filter ===
    if (cfg.ignoreEarlyMainSleepEnabled && cfg.ignoreEarlyMainSleepTime) {
      const [h, m] = String(cfg.ignoreEarlyMainSleepTime)
      .split(":")
      .map(Number);
      const cutoff = h * 60 + m;
      dbg(`[FILTER] Early sleep cutoff ${cfg.ignoreEarlyMainSleepTime}`);

      arr = arr.filter((b) => {
        if (!b?.isMainSleep || !b.startTime) return true;
        const st = new Date(b.startTime);
        const mins = st.getHours() * 60 + st.getMinutes();
        if (mins >= cutoff) return true;

        // SmartSleep ergänzt EarlySleep: lange Blöcke vor Grenzzeit dürfen bleiben
        if (cfg.smartEarlySleepEnabled && b.endTime) {
          const durMs = new Date(b.endTime) - new Date(b.startTime);
          const minMs = (cfg.minMainSleepHours || 3) * 3600000;

          if (durMs >= minMs) {
            dbg(
              `[FILTER] Early block kept (${Math.round(durMs / 60000)} min ≥ ${minMs / 60000})`,
            );
            return true;
          }
        }

        dbg(
          `[FILTER] Early main sleep ignored (${st.toTimeString().slice(0, 5)} < ${cfg.ignoreEarlyMainSleepTime})`,
        );
        return false;
      });
    }

    // === Mindestdauer für Hauptschlaf ===
    if (cfg.minMainSleepHours && cfg.minMainSleepHours > 0) {
      const minMs = (cfg.minMainSleepHours || 3) * 3600000;
      dbg(`[FILTER] Min main sleep duration ≥ ${minMs / 60000} min`);

      arr = arr.filter((b) => {
        if (!b?.isMainSleep || !b.endTime) return true;

        const dur = new Date(b.endTime) - new Date(b.startTime);
        const keep = dur >= minMs;
        dbg(
          `[FILTER] Block ${b.startTime} → ${b.endTime} = ${dur / 60000} min → ${
            keep ? "OK" : "VERWORFEN (zu kurz)"
          }`,
        );
        return keep;
      });
    }

    // === Fallback: Wenn alles rausgefiltert wurde, Naps behalten ===
    if (arr.length === 0) {
      const naps = blocks.filter((b) => !b.isMainSleep);
      if (naps.length) {
        dbg(`[FILTER] No main sleep left → using ${naps.length} nap(s)`);
        return naps;
      }
    }
    return arr;
  }

  // ---- 2. Hauptfunktion -----------------------------------------------------
  async setSleepStates(data, options = {}) {
    const blocks = data?.sleep || [];
    if (!blocks.length) return false;

    const effectiveOptions = { ...options };
    const filtered = this.filterSleepBlocks(
      blocks,
      this.effectiveConfig,
      effectiveOptions,
    );
    if (!filtered.length) {
      this.dlog("debug", "[FILTER] No sleep blocks left after filtering.");
      return false;
    }

    // ------------------------------------------------------------
    // Warten auf Intraday-HR beim Hauptschlaf
    // ------------------------------------------------------------
    const sleep = filtered[0];

    // Hauptschlaf nur „parken“, wenn Intraday aktiv ist
    if (
      sleep.isMainSleep &&
      this.effectiveConfig.intraday &&
      !options.forceMainProcess
    ) {
      const start = this._parseISO(sleep.startTime);
      const end = this._parseISO(sleep.endTime);

      this.log.info(
        `[SLEEP] Hauptschlaf erkannt (${sleep.startTime} – ${sleep.endTime}) → warte auf HR-Daten (kein sofortiges Schreiben!)`,
      );

      // Struktur passend für checkNightHRAndProcess()
      this.pendingMainSleep = {
        start:
          start instanceof Date && !isNaN(start)
            ? start
            : new Date(sleep.startTime),
        end: end instanceof Date && !isNaN(end) ? end : new Date(sleep.endTime),
        raw: sleep, // kompletter Fitbit-Block inkl. levels usw.
      };

      return true;
    }

    // Nickerchen → direkt analysieren
    if (!sleep.isMainSleep) {
      this.log.info(`[SLEEP] Nap → direkte Analyse`);
      // kein return – Code läuft unten weiter
    }

    // ----------------------------------------------------------------------
    // 🧠 DSPP – Duplicate Sleep Packet Protection
    // Wenn mehrere Sleep-Blocks mit identischen IDs kommen (z.B. nachts +
    // morgens), NUR den finalen verarbeiten.
    // ----------------------------------------------------------------------
    if (filtered.length > 1) {
      const unique = new Map();
      for (const b of filtered) {
        const key = b.logId || `${b.startTime}_${b.endTime}`;
        const existing = unique.get(key);

        // den neueren = längeren Block behalten
        if (!existing || (b.timeInBed || 0) > (existing.timeInBed || 0)) {
          unique.set(key, b);
        }
      }

      const deduped = [...unique.values()];
      if (deduped.length !== filtered.length) {
        this.dlog(
          "info",
          `[DSPP] Duplicate Fitbit sleep packets detected → using ${deduped.length} of ${filtered.length}`,
        );
      }
      filtered.length = 0;
      filtered.push(...deduped);
    }

    // Hauptschlaf und Naps trennen
    const mainBlocks = filtered.filter((b) => b.isMainSleep);
    const napBlocks = filtered.filter((b) => !b.isMainSleep);
    const main = mainBlocks.sort(
      (a, b) => new Date(b.endTime) - new Date(a.endTime),
    )[0];

    if (!main) {
      this.dlog("warn", "[SLEEP] No main sleep block found.");
      return false;
    }

    // Berechnete Zeiten
    const fell = await this.computeFellAsleepAt(main, effectiveOptions);
    const woke = this.computeWokeUpAt(main);
    const asleepMin = main.minutesAsleep || 0;
    const inBedMin = main.timeInBed || 0;

    // ---- Late Wake Correction (optional) ----
    const lateWakeLimit =
      this.effectiveConfig.sleepLateWakeCorrectionMinutes || 0;
    if (lateWakeLimit > 0) {
      const now = new Date();
      const diffMin = Math.round((now - woke) / 60000);
      if (diffMin > 0 && diffMin <= lateWakeLimit) {
        this.dlog(
          "debug",
          `[SLEEP] LateWake correction applied: Fitbit end ${woke.toLocaleTimeString()} → corrected +${diffMin} min`,
        );
        woke.setMinutes(woke.getMinutes() + diffMin);
      }
    }

    // Naps
    const napsAsleep = napBlocks.reduce(
      (a, b) => a + (b.minutesAsleep || 0),
      0,
    );
    const napsInBed = napBlocks.reduce((a, b) => a + (b.timeInBed || 0), 0);

    // ============================================================
    // 🧠 Erweiterte Nap-Validierung (optional)
    // ============================================================
    let napsValid = napBlocks;

    if (this.effectiveConfig.smartNapValidationEnabled) {
      this.dlog(
        "info",
        `[NAP] Smart nap validation enabled – checking ${napBlocks.length} naps...`,
      );
      napsValid = await this.validateNaps(napBlocks);
    } else {
      this.dlog(
        "debug",
        `[NAP] Smart nap validation disabled – accepting all naps`,
      );
    }

    const validNaps = napsValid.filter((n) => n.isValid !== false);
    await this.setStateAsync("sleep.Naps.ValidCount", {
      val: validNaps.length,
      ack: true,
    });
    await this.setStateAsync("sleep.Naps.ValidList", {
      val: JSON.stringify(validNaps, null, 2),
      ack: true,
    });

    // ===========================================================
    // 💤 Fitbit-Schlafphasen (Deep/Light/REM/Wake) 1:1 übernehmen
    // ===========================================================
    try {
      if (main.levels?.summary) {
        const s = main.levels.summary;
        const deepMin = s.deep?.minutes || 0;
        const lightMin = s.light?.minutes || 0;
        const remMin = s.rem?.minutes || 0;
        const wakeMin = s.wake?.minutes || 0;

        await Promise.all([
          this.setObjectNotExistsAsync("sleep.Deep", {
            type: "state",
            common: {
              name: "Deep Sleep (minutes)",
              type: "number",
              role: "value",
              unit: "min",
              read: true,
              write: false,
            },
            native: {},
          }),
          this.setObjectNotExistsAsync("sleep.Light", {
            type: "state",
            common: {
              name: "Light Sleep (minutes)",
              type: "number",
              role: "value",
              unit: "min",
              read: true,
              write: false,
            },
            native: {},
          }),
          this.setObjectNotExistsAsync("sleep.Rem", {
            type: "state",
            common: {
              name: "REM Sleep (minutes)",
              type: "number",
              role: "value",
              unit: "min",
              read: true,
              write: false,
            },
            native: {},
          }),
          this.setObjectNotExistsAsync("sleep.Wake", {
            type: "state",
            common: {
              name: "Awake (minutes)",
              type: "number",
              role: "value",
              unit: "min",
              read: true,
              write: false,
            },
            native: {},
          }),
        ]);

        await Promise.all([
          this.setStateAsync("sleep.Deep", { val: deepMin, ack: true }),
          this.setStateAsync("sleep.Light", { val: lightMin, ack: true }),
          this.setStateAsync("sleep.Rem", { val: remMin, ack: true }),
          this.setStateAsync("sleep.Wake", { val: wakeMin, ack: true }),
        ]);

        this.dlog(
          "debug",
          `[SLEEP] Fitbit phases → deep=${deepMin}, light=${lightMin}, rem=${remMin}, wake=${wakeMin}`,
        );
      } else {
        this.dlog(
          "warn",
          "[SLEEP] No summary levels found in main block → skipping phase update",
        );
      }
    } catch (err) {
      this.log.warn(`Sleep phase update failed: ${err.message}`);
    }

    // Danach die bisherigen States schreiben
    await this.writeSleepStates({
      fell,
      woke,
      asleepMin,
      inBedMin,
      napsAsleep,
      napsInBed,
      napsCount: napBlocks.length,
      naps: napBlocks,
    });

    this.dlog(
      "info",
      `[SLEEP] Main ${fell.toISOString()} → ${woke.toISOString()} (${asleepMin} min asleep, ${inBedMin} min in bed)`,
    );

    // ---- DEBUG/TEST ----
    if (DEBUG_SLEEP_LOG || this.effectiveConfig.debugEnabled) {
      const dur = Math.round((woke - fell) / 60000);
      this.dlog(
        "debug",
        `[SLEEP-DETAIL] Naps=${napBlocks.length} (${napsAsleep} asleep/${napsInBed} in bed)`,
      );
      this.dlog(
        "debug",
        `MainSleep → ${fell.toLocaleTimeString()} – ${woke.toLocaleTimeString()} (${dur} min)`,
      );
      napBlocks.forEach((n, i) => {
        this.dlog(
          "debug",
          `Nap ${i + 1}: ${n.startTime} – ${n.endTime} (${n.minutesAsleep} min)`,
        );
      });
    }

    return true;
  }

  // -------------------------------------------------------------------------
  // Segment-Tools für Sleep
  // -------------------------------------------------------------------------
  getLevelSegments(block) {
    const a =
      block && block.levels && Array.isArray(block.levels.data)
        ? block.levels.data
        : [];
    const b =
      block && block.levels && Array.isArray(block.levels.shortData)
        ? block.levels.shortData
        : [];
    const segs = [...a, ...b].filter((s) => s && s.dateTime && s.level);
    segs.sort((x, y) => new Date(x.dateTime) - new Date(y.dateTime));
    return segs;
  }

  //
  // --- SMART PREFILTER: verhindert Film-/Lese-Abende ---
  //
  preSleepSmartFilter(block, segs) {
    try {
      if (!this.recentHeartData || this.recentHeartData.length < 6) return null;

      const SLEEP = new Set(["asleep", "light", "deep", "rem"]);

      // 1. erster Sleep-Level
      const firstSleepSeg = segs.find((s) => SLEEP.has(s.level));
      if (!firstSleepSeg) return null;

      const sleepStart = new Date(firstSleepSeg.dateTime);

      // 2. (KEIN zusätzlicher Cutoff mehr hier!)
      //    Die Zeitgrenze wird bereits:
      //    - im Block-Filter (filterSleepBlocks)
      //    - und in computeFellAsleepAt beim Suchen der stabilen Phase
      //    berücksichtigt.

      // 3. HR-Drop grob prüfen
      const before = this.recentHeartData
      .filter((p) => p.ts < sleepStart)
      .slice(-15)
      .map((p) => p.value);

      const after = this.recentHeartData
      .filter((p) => p.ts >= sleepStart)
      .slice(0, 20)
      .map((p) => p.value);

      if (!before.length || !after.length) return null;

      const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
      const drop = mean(before) - mean(after);

      if (drop < 2) return null; // kleiner HR-Drop → zu ruhig → Film/Lesen

      // 4. stabile Phase benutzen (bestehende Logik)
      const segsList = segs;
      const S = new Set(["asleep", "light", "deep", "rem"]);
      const findStable = () => {
        for (let i = 0; i < segsList.length; i++) {
          if (!S.has(segsList[i].level)) continue;
          const start = new Date(segsList[i].dateTime);
          let dur = 0;
          for (
            let j = i;
            j < segsList.length && S.has(segsList[j].level);
            j++
          ) {
            const cur = new Date(segsList[j].dateTime);
            const nxt = segsList[j + 1]
              ? new Date(segsList[j + 1].dateTime)
              : null;
            if (nxt) dur += (nxt - cur) / 60000;
          }
          if (dur >= (this.effectiveConfig.sleepStabilityMinutes || 20))
            return start;
        }
        return null;
      };

      const stable = findStable();
      if (!stable) return null;

      this.dlog(
        "debug",
        `[SMART] Prefilter accepted stable sleep @ ${stable.toISOString()} (HR drop ${drop.toFixed(1)})`,
      );
      return stable;
    } catch (e) {
      this.dlog("warn", `SmartPrefilter error: ${e.message}`);
      return null;
    }
  }

  // ---- 3. Fell-Asleep-Erkennung (mit Cutoff + HR-Analyse + Sicherheitsgrenze) ------------
  async computeFellAsleepAt(block, options = {}) {
    const segs = this.getLevelSegments(block);
    if (!segs.length) return this._parseISO(block?.startTime);

    const startDT = new Date(Date.parse(block.startTime));  // garantiert UTC

    // --- SMART PREFILTER ---
    const smart = this.preSleepSmartFilter(block, segs);
    if (smart instanceof Date && !isNaN(smart)) {
      const diffMin = Math.round((smart - startDT) / 60000);
      if (diffMin > MAX_SLEEP_START_DELAY_MINUTES) {
        this.dlog(
          "warn",
          `[START] SmartPrefilter Δ ${diffMin} > limit → using Fitbit startTime`,
        );
        return startDT;
      }
      this._lastSleepSource = "corrected";
      return smart;
    }

    const baseStable =
      Number(this.effectiveConfig?.sleepStabilityMinutes) || 20;
    const stabilityMin = options.relaxed
      ? Math.max(5, baseStable / 2)
      : baseStable;
    const SLEEP = new Set(["asleep", "light", "deep", "rem"]);
    const candidate = (s) => SLEEP.has(s.level);

    const findStableFrom = (startIdx) => {
      for (let i = startIdx; i < segs.length; i++) {
        if (!candidate(segs[i])) continue;
        const start = new Date(Date.parse(segs[i].dateTime));  // bleibt UTC → korrekt
        let dur = 0;
        for (let j = i; j < segs.length && candidate(segs[j]); j++) {
          const cur = new Date(Date.parse(segs[i].dateTime));
          const next = segs[j + 1] ? new Date(segs[j + 1].dateTime) : null;
          if (next) dur += (next - cur) / 60000;
        }
        if (dur >= stabilityMin) return start;
      }
      return null;
    };

    const threeHours = 3 * 60 * 60 * 1000;

    // =================================================================
    // 1. Cutoff + Startindex  (ZEITFEHLERFREI)
    // =================================================================
    let cutoffDT = null;
    let searchStartIdx = 0;

    if (
      this.effectiveConfig.ignoreEarlyMainSleepEnabled &&
      this.effectiveConfig.ignoreEarlyMainSleepTime
    ) {
      const [h, m] = this.effectiveConfig.ignoreEarlyMainSleepTime
      .split(":")
      .map(Number);

      if (!isNaN(h) && !isNaN(m)) {

        // ------------------------------------------------------------
        // Lokale Startzeit aus UTC erzeugen (sauber, einmalig)
        // ------------------------------------------------------------
        const localStart = new Date(startDT.getTime() - startDT.getTimezoneOffset() * 60000);

        const year  = localStart.getFullYear();
        const month = localStart.getMonth();
        let day     = localStart.getDate();

        // ------------------------------------------------------------
        // Lokale Cutoff-Uhrzeit konstruieren
        // ------------------------------------------------------------
        let localCutoff = new Date(year, month, day, h, m, 0);

        // Falls Start < Cutoff → Cutoff gehört zum nächsten Tag
        if (localStart < localCutoff) {
          localCutoff.setDate(localCutoff.getDate() + 1);
        }

        // ------------------------------------------------------------
        // EINMALIGE Rückwandlung nach UTC (korrekt)
        // ------------------------------------------------------------
        cutoffDT = new Date(localCutoff.getTime() + localCutoff.getTimezoneOffset() * 60000);

        this.dlog(
          "debug",
          `[START] Cutoff LOCAL: ${localCutoff.toISOString().replace("T"," ").substring(0,16)} → UTC: ${cutoffDT.toISOString()}`,
        );
      }
    }

    // =================================================================
    // Suche Startindex ab Cutoff
    // =================================================================
    if (cutoffDT && startDT < cutoffDT) {
      for (let i = 0; i < segs.length; i++) {
        const segDT = new Date(Date.parse(segs[i].dateTime));  // garantiert UTC
        if (segDT >= cutoffDT) {
          searchStartIdx = i;
          break;
        }
      }

      this.dlog("debug", `[START] Searching stable segments from idx=${searchStartIdx}`);
    }

    // =================================================================
    // 2. Deep/REM bevorzugen
    // =================================================================
    const deepRemIdx = (() => {
      for (let i = searchStartIdx; i < segs.length; i++) {
        const t = new Date(Date.parse(segs[i].dateTime));  // bleibt UTC → korrekt
        if (t - startDT > threeHours) break;
        if (segs[i].level === "deep" || segs[i].level === "rem") return i;
      }
      return -1;
    })();

    let candidateDT = null;

    if (deepRemIdx >= 0) {
      const stable = findStableFrom(deepRemIdx);
      if (stable) {
        candidateDT = stable;
      }
    }

    // =================================================================
    // 3. Alle stabilen Segmente sammeln
    // =================================================================
    let stableSegments = [];
    try {
      let i = searchStartIdx;
      while (i < segs.length) {
        if (!candidate(segs[i])) {
          i++;
          continue;
        }

        const start = new Date(Date.parse(segs[i].dateTime));
        let dur = 0;
        let j = i;

        while (j < segs.length && candidate(segs[j])) {
          const cur = new Date(Date.parse(segs[i].dateTime));
          const next = segs[j + 1] ? new Date(segs[j + 1].dateTime) : null;
          if (next) dur += (next - cur) / 60000;
          j++;
        }

        if (dur >= stabilityMin) stableSegments.push(start);
        i = j;
      }
    } catch (e) {
      this.dlog("warn", `Stable-phase error: ${e.message}`);
    }

    // =================================================================
    // 4. Zweite stabile Phase bevorzugen
    // =================================================================
    if (stableSegments.length >= 2) {
      const first = stableSegments[0];
      const second = stableSegments[1];
      const diff = Math.round((second - first) / 60000);

      if (diff > 0 && diff <= 60) {
        candidateDT = second;
        this._lastSleepSource = "second-stable";
      }
    }

    // =================================================================
    // 5. Falls keine zweite → erste stabile
    // =================================================================
    if (!candidateDT && stableSegments.length >= 1) {
      candidateDT = stableSegments[0];
      this._lastSleepSource = "first-stable";
    }

    // =================================================================
    // 6. Fallback: irgendeine stabile Phase
    // =================================================================
    if (!candidateDT) {
      const any = findStableFrom(0);
      if (any) {
        candidateDT = any;
        this._lastSleepSource = "fallback-stable";
      }
    }

    // =================================================================
    // 7. Wenn nichts → Fitbit Start
    // =================================================================
    if (!candidateDT) {
      this._lastSleepSource = "fitbit";
      return startDT;
    }

    // =================================================================
    // 7a. HR darf nicht VOR Fitbit-Start liegen
    //     → wenn candidateDT < startDT, nimm den Fitbit-Start
    // =================================================================
    if (candidateDT < startDT) {
      this.dlog(
        "debug",
        `[START] HR-Kandidat ${candidateDT.toISOString()} liegt vor Fitbit-Start ${startDT.toISOString()} → Fitbit-Start wird verwendet`,
      );
      this._lastSleepSource = "fitbit-clamped";
      return startDT;
    }

    // =================================================================
    // 8. Sicherheitsgrenze (nur nach hinten begrenzen)
    // =================================================================
    const deltaMin = Math.round((candidateDT - startDT) / 60000);
    if (deltaMin > MAX_SLEEP_START_DELAY_MINUTES) {
      return startDT;
    }

    return candidateDT;
  }

  // ---- 4. Wake-Up-Erkennung -------------------------------------------------
  computeWokeUpAt(block) {
    const segs = this.getLevelSegments(block);
    const SLEEP = new Set(["asleep", "light", "deep", "rem"]);
    if (!segs.length) return this._parseISO(block?.endTime);

    let lastSleepIdx = -1;
    for (let i = segs.length - 1; i >= 0; i--)
      if (SLEEP.has(segs[i].level)) {
        lastSleepIdx = i;
        break;
      }
    if (lastSleepIdx === -1) return this._parseISO(block?.endTime);

    const s = segs[lastSleepIdx];
    const segStart = this._parseISO(s.dateTime);
    const endOfSleep = s.seconds
      ? this._addSeconds(segStart, s.seconds)
      : segs[lastSleepIdx + 1]
        ? this._parseISO(segs[lastSleepIdx + 1].dateTime)
        : this._parseISO(block?.endTime);

    const base = Number(this.effectiveConfig?.sleepStabilityMinutes) || 20;
    const wakeStable = Math.min(base, 15);
    let wakeDur = 0;

    for (
      let j = lastSleepIdx + 1;
      j < segs.length && !SLEEP.has(segs[j].level);
      j++
    ) {
      const wStart = this._parseISO(segs[j].dateTime);
      const wNext = segs[j + 1] ? this._parseISO(segs[j + 1].dateTime) : null;
      const endRef = wNext || this._parseISO(block?.endTime);
      wakeDur += (endRef - wStart) / 60000;
    }

    if (wakeDur < wakeStable) {
      this.dlog("debug", `[WAKE] Short wake (${wakeDur} m) → early end`);
      return endOfSleep;
    }
    this.dlog("debug", `[WAKE] Stable wake detected (${wakeDur} m)`);
    return endOfSleep;
  }

  // ---- 5. States schreiben ---------------------------------------------------
  async writeSleepStates({
    fell,
    woke,
    asleepMin,
    inBedMin,
    napsAsleep,
    napsInBed,
    napsCount,
    naps,
  }) {
    const fellIso = fell instanceof Date ? fell.toISOString() : String(fell);
    const wokeIso = woke instanceof Date ? woke.toISOString() : String(woke);

    // -------------------------------------------------------------------------
    // HR-Analyse: Vor-/Nach-HF und HF-Abfall rund um Einschlafzeit
    // -------------------------------------------------------------------------
    try {
      if (this.effectiveConfig.intraday && fell instanceof Date) {
        const startDT = fell;
        const windowStart = new Date(startDT.getTime() - 6 * 3600000);
        const windowEnd = new Date(startDT.getTime() + 2 * 3600000);

        let nightHR = [];
        try {
          const tsState = await this.getStateAsync("activity.HeartRate-ts");
          if (tsState?.val) {
            const allTs = JSON.parse(tsState.val);
            nightHR = allTs.filter((e) => {
              if (!e.ts) return false;
              const t = Date.parse(e.ts);
              return t >= windowStart.getTime() && t <= windowEnd.getTime();
            });
            this.dlog(
              "debug",
              `[HR] Gefundene Punkte im 8h-Fenster: ${nightHR.length} (von ${allTs.length} total)`,
            );
          }
        } catch (e) {
          this.dlog(
            "warn",
            "[HR] Fehler beim Laden von HeartRate-ts: " + e.message,
          );
        }

        if (nightHR.length < 8) {
          this.dlog(
            "info",
            `[HR] Zu wenig Messpunkte im 8h-Fenster (${nightHR.length}/8) → HR-Werte leer`,
          );
          await Promise.all([
            this.setStateAsync("sleep.HRBeforeSleep", { val: null, ack: true }),
            this.setStateAsync("sleep.HRAfterSleep", { val: null, ack: true }),
            this.setStateAsync("sleep.HRDropAtSleep", { val: null, ack: true }),
          ]);
        } else {
          const now = startDT.getTime();
          const beforeArr = nightHR
            .filter(
              (p) =>
                Date.parse(p.ts) >= now - 120 * 60000 &&
                Date.parse(p.ts) <= now - 15 * 60000,
            )
            .map((p) => p.value);
          const afterArr = nightHR
            .filter(
              (p) =>
                Date.parse(p.ts) >= now + 15 * 60000 &&
                Date.parse(p.ts) <= now + 120 * 60000,
            )
            .map((p) => p.value);

          if (beforeArr.length >= 2 && afterArr.length >= 2) {
            const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
            const before = mean(beforeArr);
            const after = mean(afterArr);
            const drop = before - after;

            await Promise.all([
              this.setStateAsync("sleep.HRBeforeSleep", {
                val: Number(before.toFixed(1)),
                ack: true,
              }),
              this.setStateAsync("sleep.HRAfterSleep", {
                val: Number(after.toFixed(1)),
                ack: true,
              }),
              this.setStateAsync("sleep.HRDropAtSleep", {
                val: Number(drop.toFixed(1)),
                ack: true,
              }),
            ]);

            this.dlog(
              "info",
              `[HR] Erfolgreich analysiert → Vor: ${before.toFixed(1)} BPM (${beforeArr.length} Werte), Nach: ${after.toFixed(1)} BPM (${afterArr.length} Werte), Abfall: ${drop.toFixed(1)} BPM`,
            );
          } else {
            this.dlog(
              "info",
              `[HR] Zu wenige Punkte in den Fein-Fenstern (vor=${beforeArr.length}, nach=${afterArr.length}) → HR-Werte leer`,
            );
            await Promise.all([
              this.setStateAsync("sleep.HRBeforeSleep", {
                val: null,
                ack: true,
              }),
              this.setStateAsync("sleep.HRAfterSleep", {
                val: null,
                ack: true,
              }),
              this.setStateAsync("sleep.HRDropAtSleep", {
                val: null,
                ack: true,
              }),
            ]);
          }
        }
      }
    } catch (e) {
      this.log.warn(`HR-Analyse fehlgeschlagen: ${e.message || e}`);
      await Promise.all([
        this.setStateAsync("sleep.HRBeforeSleep", { val: null, ack: true }),
        this.setStateAsync("sleep.HRAfterSleep", { val: null, ack: true }),
        this.setStateAsync("sleep.HRDropAtSleep", { val: null, ack: true }),
      ]);
    }

    // ✳️ Lokale Formatierung — KORREKT
    // Wichtig: writeSleepStates hat KEINEN Zugriff auf mainBlock!
    // Es dürfen nur fellIso / wokeIso verwendet werden.
    const fellLocal = this.formatLocalShort(fellIso);
    const wokeLocal = this.formatLocalShort(wokeIso);

    // Wochentag in deutsch & englisch
    const weekdayDE = fell.toLocaleDateString("de-DE", { weekday: "long" });
    const weekdayShortDE = fell.toLocaleDateString("de-DE", {
      weekday: "short",
    });

    const weekdayEN = fell.toLocaleDateString("en-US", { weekday: "long" });
    const weekdayShortEN = fell.toLocaleDateString("en-US", {
      weekday: "short",
    });

    // Nap-Auswahl (korrekt sortiert + Config beachtet)
    let selectedNap = null;

    if (naps.length > 0) {
      // FITBIT liefert Naps oft unsortiert → immer zuerst sortieren
      const sortedNaps = [...naps].sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime)
      );

      // Auswahl: erstes oder letztes Nap
      selectedNap = this.effectiveConfig.showLastOrFirstNap
      ? sortedNaps[sortedNaps.length - 1]   // letztes Nap
      : sortedNaps[0];                      // erstes Nap
    }

    const napFellIso = selectedNap ? selectedNap.startTime : null;
    const napWokeIso = selectedNap ? selectedNap.endTime : null;

    const napFellLocal = selectedNap ? this.formatLocalShort(napFellIso) : "";
    const napWokeLocal = selectedNap ? this.formatLocalShort(napWokeIso) : "";

    // Liste aller Naps
    const napsFormatted = naps.map((n) => ({
      start: this.formatLocalShort(n.startTime),
                                           end: this.formatLocalShort(n.endTime),
                                           minutesAsleep: n.minutesAsleep,
                                           timeInBed: n.timeInBed,
    }));

    // -------------------------------------------------------------------------
    // 📝 Alle States schreiben
    // -------------------------------------------------------------------------
    await Promise.all([
      this.setStateAsync("sleep.AsleepTotal", {
        val: asleepMin + napsAsleep,
        ack: true,
      }),
      this.setStateAsync("sleep.InBedTotal", {
        val: inBedMin + napsInBed,
        ack: true,
      }),

      this.setStateAsync("sleep.Main.FellAsleepAt", {
        val: fellIso,
        ack: true,
      }),
      this.setStateAsync("sleep.Main.FellAsleepAtLocal", {
        val: fellLocal,
        ack: true,
      }),
      this.setStateAsync("sleep.Main.WokeUpAt", { val: wokeIso, ack: true }),
                      this.setStateAsync("sleep.Main.WokeUpAtLocal", {
                        val: wokeLocal,
                        ack: true,
                      }),

                      this.setStateAsync("sleep.Naps.FellAsleepAt", {
                        val: napFellIso,
                        ack: true,
                      }),
                      this.setStateAsync("sleep.Naps.FellAsleepAtLocal", {
                        val: napFellLocal,
                        ack: true,
                      }),
                      this.setStateAsync("sleep.Naps.WokeUpAt", { val: napWokeIso, ack: true }),
                      this.setStateAsync("sleep.Naps.WokeUpAtLocal", {
                        val: napWokeLocal,
                        ack: true,
                      }),

                      this.setStateAsync("sleep.Naps.Asleep", { val: napsAsleep, ack: true }),
                      this.setStateAsync("sleep.Naps.InBed", { val: napsInBed, ack: true }),
                      this.setStateAsync("sleep.Naps.Count", { val: napsCount, ack: true }),
                      this.setStateAsync("sleep.Naps.List", {
                        val: JSON.stringify(napsFormatted),
                                         ack: true,
                      }),
    ]);

    // -------------------------------------------------------------------------
    // Sleep History Update (inkl. KI-Felder & Herzwerte)
    // -------------------------------------------------------------------------
    try {
      const historyState = await this.getStateAsync("sleep.History.JSON");
      let history = [];

      // vorhandene History laden
      if (historyState && historyState.val) {
        try {
          history = JSON.parse(historyState.val);
          if (!Array.isArray(history)) history = [];
        } catch {
          history = [];
        }
      }

      // ---------------------------------------------------------------------
      // Herzwerte laden (aus States)
      // ---------------------------------------------------------------------
      const hrBefore = await this.getStateAsync("sleep.HRBeforeSleep").then(s => s?.val ?? null);
      const hrAfter  = await this.getStateAsync("sleep.HRAfterSleep").then(s => s?.val ?? null);
      const hrDrop   = await this.getStateAsync("sleep.HRDropAtSleep").then(s => s?.val ?? null);

      // Sleep stages laden
      const deep  = await this.getStateAsync("sleep.Deep").then(s => s?.val ?? null);
      const light = await this.getStateAsync("sleep.Light").then(s => s?.val ?? null);
      const rem   = await this.getStateAsync("sleep.Rem").then(s => s?.val ?? null);
      const wake  = await this.getStateAsync("sleep.Wake").then(s => s?.val ?? null);

      // ---------------------------------------------------------------------
      // KI-Hilfsfunktionen
      // ---------------------------------------------------------------------
      const mean = arr => arr.reduce((a,b)=>a+b,0) / arr.length;

      // letzte realen Nächte (mit echten HR-Werten)
      const lastReal = history
      .filter(h => h.hrBefore != null && h.hrAfter != null)
      .slice(-10);

      let baselineBefore = null;
      let baselineAfter = null;
      let baselineDrop = null;

      if (lastReal.length >= 5) {
        baselineBefore = Number(mean(lastReal.map(h => h.hrBefore)).toFixed(1));
        baselineAfter  = Number(mean(lastReal.map(h => h.hrAfter)).toFixed(1));
        baselineDrop   = Number(mean(lastReal.map(h => h.hrDrop)).toFixed(1));
      }

      // Trends
      const trendDrop = lastReal.length >= 3
      ? Number((lastReal[lastReal.length-1].hrDrop - lastReal[0].hrDrop).toFixed(1))
      : null;

      const trendAsleep = lastReal.length >= 3
      ? Number((lastReal[lastReal.length-1].asleepMinutes - lastReal[0].asleepMinutes).toFixed(0))
      : null;

      // Nap-Daten
      let napUsed = null;
      if (naps.length > 0) {
        napUsed = this.effectiveConfig.showLastOrFirstNap
        ? naps[naps.length - 1]
        : naps[0];
      }

      // ---------------------------------------------------------------------
      // Neuer History-Eintrag
      // ---------------------------------------------------------------------
      const entry = {
        date: fellIso.substring(0, 10),

        weekday: weekdayDE,
        weekdayShort: weekdayShortDE,
        weekdayEN,
        weekdayShortEN,

        fellAsleepAt: fellIso,
        wokeUpAt: wokeIso,
        asleepMinutes: asleepMin,
        inBedMinutes: inBedMin,

        // Sleep stages
        deep,
        light,
        rem,
        wake,

        // Herzwerte
        hrBefore,
        hrAfter,
        hrDrop,

        naps: napsCount,
        sleepSource: this._lastSleepSource || "fitbit",

        // Nap-Daten
        napUsedStart: napUsed ? napUsed.startTime : null,
        napUsedEnd:   napUsed ? napUsed.endTime   : null,
        napUsedMinutesAsleep: napUsed ? napUsed.minutesAsleep : null,
        napUsedTimeInBed:     napUsed ? napUsed.timeInBed     : null,

        // -----------------------------------------------------------------
        // KI-Felder **(korrekt auf Basis der HR-Werte oben)**
        // -----------------------------------------------------------------

        baselineHrBefore: baselineBefore,
        baselineHrAfter:  baselineAfter,
        baselineHrDrop:   baselineDrop,

        deltaHrBefore: baselineBefore != null ? Number((hrBefore - baselineBefore).toFixed(1)) : null,
        deltaHrAfter:  baselineAfter  != null ? Number((hrAfter  - baselineAfter ).toFixed(1)) : null,
        deltaHrDrop:   baselineDrop   != null ? Number((hrDrop   - baselineDrop  ).toFixed(1)) : null,

        trendDrop,
        trendAsleep,

        isHrDropStrong: hrDrop != null ? hrDrop >= 10 : null,
        isHrBeforeLow:  (hrBefore != null && baselineBefore != null) ? hrBefore < baselineBefore : null,
        isHrAfterLow:   (hrAfter  != null && baselineAfter  != null) ? hrAfter  < baselineAfter  : null,

        weekdayIndex: fell.getDay(),
        isWeekend: fell.getDay() === 6 || fell.getDay() === 0,
      };

      // Eintrag ersetzen oder anhängen
      const idx = history.findIndex(h => h.date === entry.date);
      if (idx >= 0) history[idx] = entry;
      else history.push(entry);

      history = history.slice(-90);

      await this.setStateAsync("sleep.History.JSON", {
        val: JSON.stringify(history, null, 2),
                               ack: true,
      });

      await this.setStateAsync("sleep.History.LastEntry", {
        val: JSON.stringify(entry, null, 2),
                               ack: true,
      });

      this.dlog("info", `[HISTORY] Saved sleep entry for ${entry.date} (History size: ${history.length})`);

    } catch (e) {
      this.log.warn(`History update failed: ${e.message}`);
    }
  }

  // ============================================================
  // Formatierungshilfe: 08.11.2025 - 07:53 (ohne Sekunden)
  // ============================================================
  formatLocalShort(isoStr) {
    const dt = new Date(isoStr);
    if (isNaN(dt)) return "";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2, "0");
    const mi = String(dt.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} - ${hh}:${mi}`;
  }

  // =========================================================================
  // Token Introspect (optional)
  // =========================================================================
  async getTokenInfo() {
    const token = this.fitbit.tokens.access_token;
    try {
      const url = "https://api.fitbit.com/1.1/oauth2/introspect";
      const payload = `token=${token}`;
      const response = await axios({
        url,
        method: "post",
        headers: { authorization: `Bearer ${token}` },
        data: payload,
      });
      this.fitbit.tokens = response.data;
      this.dlog(`debug`, `Token introspection ok (client_id present)`);
      return true;
    } catch (err) {
      this.log.error(`getTokenInfo failed: ${err}`);
      throw new Error(`${err}`);
    }
  }

  // =========================================================================
  // Token-Erneuerung
  // =========================================================================
  async renewToken() {
    if (this._renewInProgress) {
      this.dlog("debug", "renewToken: already in progress");
      return false;
    }
    this._renewInProgress = true;

    try {
      const st = await this.getStateAsync("tokens.refresh");
      const refreshToken =
        st && st.val
          ? String(st.val)
          : this.fitbit.tokens && this.fitbit.tokens.refresh_token;
      if (!refreshToken)
        throw new Error(
          "No refresh_token available (state empty). Re-auth required.",
        );

      const cid = this.effectiveConfig.clientId || "";
      const csec = this.effectiveConfig.clientSecret || "";
      if (!cid || !csec)
        throw new Error(
          "ClientId/ClientSecret missing in config. Please set them in admin UI.",
        );

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: cid,
      }).toString();

      const resp = await axios({
        method: "post",
        url: "https://api.fitbit.com/oauth2/token",
        headers: {
          Authorization: `Basic ${Buffer.from(`${cid}:${csec}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: body,
        timeout: axiosTimeout,
        validateStatus: () => true,
      });

      if (resp.status !== 200) {
        this.log.error(
          `Renew Token failed ${resp.status}: ${JSON.stringify(resp.data)}`,
        );
        return false;
      }

      this.fitbit.tokens = resp.data;

      const expireAt = new Date(
        Date.now() + (this.fitbit.tokens.expires_in || 0) * 1000,
      );
      await this.setStateAsync(
        "tokens.access",
        this.fitbit.tokens.access_token,
        true,
      );
      await this.setStateAsync(
        "tokens.refresh",
        this.fitbit.tokens.refresh_token,
        true,
      );
      await this.setStateAsync("tokens.expire", expireAt.toISOString(), true);

      this.log.info(`Token renewed: ${expireAt.toISOString()}`);
      return true;
    } catch (e) {
      const msg =
        e && e.response && e.response.data
          ? JSON.stringify(e.response.data)
          : String(e);
      this.log.error(`Renew Token error: ${msg}`);
      return false;
    } finally {
      this._renewInProgress = false;
    }
  }

  // =========================================================================
  // Token-Check (erneuert < 1h vor Ablauf)
  // =========================================================================
  async checkToken() {
    const stateExpire = await this.getStateAsync("tokens.expire");
    if (!stateExpire || !stateExpire.val)
      throw new Error("No valid tokens. Please authenticate in configuration.");

    const expireTime = new Date(String(stateExpire.val)).getTime();
    const now = Date.now();

    if (expireTime - now < 3600000) {
      return await this.renewToken();
    } else {
      return true;
    }
  }

  // =========================================================================
  // Gewicht schreiben (Benutzeraktion)
  // =========================================================================
  async setWeight(actWeight) {
    const url = `${BASE_URL}-/body/log/weight.json`;
    const token = this.fitbit.tokens.access_token;

    const datetime = this.getDateTime();
    const payload = `weight=${actWeight}&date=${datetime.dateString}&time=${datetime.time}`;

    this.log.info(`Set weight payload: ${payload}`);

    try {
      const response = await axios({
        url,
        method: "post",
        headers: { Authorization: `Bearer ${token}` },
        timeout: axiosTimeout,
        data: payload,
      });
      this.log.info(`setWeight status: ${response.status}`);
    } catch (err) {
      this.log.warn(`setWeight failed: ${err}`);
    }
  }

  // =========================================================================
  // Tools / Utils
  // =========================================================================
  formatDE_Short(dateObj) {
    if (!(dateObj instanceof Date) || isNaN(dateObj)) return "";
    const parts = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(dateObj);

    const val = (t) => (parts.find((p) => p.type === t) || {}).value || "";
    const TT = val("day");
    const MM = val("month");
    const JJ = val("year");
    const SS = val("hour");
    const MI = val("minute");
    return `${TT}.${MM}.${JJ} - ${SS}:${MI}`;
  }

  _parseISO(d) {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt) ? null : dt;
  }

  _addSeconds(d, secs) {
    if (!(d instanceof Date) || isNaN(d)) return null;
    return new Date(d.getTime() + (secs || 0) * 1000);
  }
  _todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  getDateTime(ts = new Date(), addDays = 0) {
    const datetime = {};
    const date = new Date(ts);
    date.setDate(date.getDate() + addDays);

    const dd = date.getDate();
    const mm = date.getMonth() + 1;
    const year = date.getFullYear();

    const hh = date.getHours();
    const mi = date.getMinutes();
    const ss = date.getSeconds();

    datetime.dateString = `${year}-${mm.toString(10).padStart(2, "0")}-${dd.toString(10).padStart(2, "0")}`;
    datetime.date = date;
    datetime.time = `${hh.toString(10).padStart(2, "0")}:${mi.toString(10).padStart(2, "0")}:${ss.toString(10).padStart(2, "0")}`;
    datetime.timeShort = `${hh.toString(10).padStart(2, "0")}:${mi.toString(10).padStart(2, "0")}`;
    datetime.ts = date.getTime();
    return datetime;
  }

  _validTime(t) {
    if (typeof t !== "string") return false;
    const m = t.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    return !!m;
  }

  _coalesceBool(v, fallback) {
    if (typeof v === "boolean") return v;
    if (v === "true") return true;
    if (v === "false") return false;
    return !!fallback;
  }

  async _clearNapStates(opts = { onlyList: false }) {
    await this.setStateAsync("sleep.Naps.List", { val: "[]", ack: true });
    if (!opts.onlyList) {
      await this.setStateAsync("sleep.Naps.FellAsleepAt", {
        val: "",
        ack: true,
      });
      await this.setStateAsync("sleep.Naps.FellAsleepAtLocal", {
        val: "",
        ack: true,
      });
      await this.setStateAsync("sleep.Naps.WokeUpAt", { val: "", ack: true });
      await this.setStateAsync("sleep.Naps.WokeUpAtLocal", {
        val: "",
        ack: true,
      });
    }
  }

  async validateNaps(napBlocks) {
    const validated = [];

    for (const nap of napBlocks) {
      const start = new Date(nap.startTime);
      const end = new Date(nap.endTime);
      const duration = (end - start) / 60000;

      // Kurze Naps unter 15 Minuten ignorieren
      if (duration < 15) {
        this.dlog(
          "debug",
          `[NAP] Ignored (${start.toLocaleTimeString()} – ${end.toLocaleTimeString()}) too short (${duration} min)`,
        );
        validated.push({ ...nap, isValid: false });
        continue;
      }

      // Falls Intraday-Daten vorhanden, prüfen auf Bewegung/Herzfrequenz
      const intraday = this.recentHeartData || [];
      const segment = intraday.filter((p) => {
        const t = new Date(p.ts);
        return t >= start && t <= end;
      });

      const avgHR = segment.length
        ? segment.reduce((a, b) => a + (b.value || 0), 0) / segment.length
        : 0;

      // Bewegung simulativ über Herzfrequenzunterschied bewerten
      if (avgHR > 65) {
        this.dlog(
          "debug",
          `[NAP] Ignored (${start.toLocaleTimeString()}) high HR avg ${avgHR}`,
        );
        validated.push({ ...nap, isValid: false });
        continue;
      }

      this.dlog(
        "debug",
        `[NAP] Accepted (${start.toLocaleTimeString()} – ${end.toLocaleTimeString()}) ${duration} min`,
      );
      validated.push({ ...nap, isValid: true });
    }

    return validated;
  }

  /**
   * Prüft, ob genügend HR-Daten für die Nacht vorhanden sind.
   * Wenn ja → Hauptschlaf analysieren.
   * Falls zu lange gewartet wurde → Failsafe ohne HR-Wait.
   */
  async checkNightHRAndProcess() {
    const pending = this.pendingMainSleep;
    if (!pending) return;

    const now = new Date();

    // Failsafe: pendingMainSleep zu alt?
    if (pending.start instanceof Date && !isNaN(pending.start)) {
      const ageMs = now - pending.start;
      const maxAgeMs = PENDING_MAIN_SLEEP_MAX_AGE_HOURS * 60 * 60 * 1000;

      if (ageMs > maxAgeMs) {
        this.log.warn(
          `[SLEEP] pendingMainSleep älter als ${PENDING_MAIN_SLEEP_MAX_AGE_HOURS}h → ` +
            `Schlaf wird ohne weiteres HR-Warten verarbeitet (HR-Dichte zu dünn?).`,
        );
        try {
          // relaxed + forceMainProcess → keine erneute pendingMainSleep-Setzung,
          // aber vorhandene Daten trotzdem sauber durch die Pipeline jagen.
          await this.setSleepStates(
            { sleep: [pending.raw] },
            { relaxed: true, forceMainProcess: true },
          );
        } catch (e) {
          this.log.error(
            `[SLEEP] Failsafe-Verarbeitung von pendingMainSleep fehlgeschlagen: ${e.message || e}`,
          );
        }
        this.pendingMainSleep = null;
        return;
      }
    }

    const start = pending.start;
    const end = pending.end;

    // Verbesserte HR-Erkennung: 6h vor Start bis 2h nach Start
    const windowStart = new Date(start.getTime() - 6 * 60 * 60 * 1000);
    const windowEnd = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    // HeartRate-ts laden
    const tsState = await this.getStateAsync("activity.HeartRate-ts");
    if (!tsState?.val) {
      this.log.info("[WAIT] Noch keine HR-TS Daten → später erneut prüfen");
      return;
    }

    let ts = [];
    try {
      ts = JSON.parse(tsState.val);
    } catch {}

    const nightHR = ts.filter((e) => {
      const t = new Date(e.ts);
      return t >= windowStart && t <= windowEnd;
    });

    // Mindestanzahl HR Punkte
    if (nightHR.length < 5) {
      this.log.info(
        `[WAIT] Nacht-HR unvollständig (${nightHR.length}) → später erneut prüfen`,
      );
      return;
    }

    this.log.info(`[OK] HR-Daten vollständig → starte Schlafanalyse`);
    await this.setSleepStates(
      { sleep: [pending.raw] },
      { relaxed: false, forceMainProcess: true },
    );

    this.pendingMainSleep = null;
  }

  // ============================================================================
  // Interner 48h-Puffer nach Adapterstart aus TS wiederherstellen
  // ============================================================================
  async restoreRecentHeartDataFromTs() {
    const tsId = "activity.HeartRate-ts";
    const state = await this.getStateAsync(tsId);

    this.recentHeartData = [];

    if (!state?.val) return;

    try {
      const arr = JSON.parse(state.val);
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 48);

      for (const entry of arr) {
        const ts = new Date(entry.ts);
        if (ts >= cutoff) {
          this.recentHeartData.push({
            ts,
            value: entry.value,
          });
        }
      }

      this.log.info(
        `Puffer wiederhergestellt: ${this.recentHeartData.length} HR-Einträge (48h)`,
      );
    } catch (e) {
      this.log.error("restoreRecentHeartDataFromTs: JSON Fehler");
    }
  }

  // =========================================================================
  // Unload / Stop
  // =========================================================================
  onUnload(callback) {
    try {
      // Haupt-Update-Intervall
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      // Sleep-Scheduler (node-schedule Job)
      if (this.sleepSchedule) {
        this.sleepSchedule.cancel();
        this.sleepSchedule = null;
      }

      // 🔥 NEU: Intraday-Intervall stoppen
      if (this.intradayInterval) {
        clearInterval(this.intradayInterval);
        this.intradayInterval = null;
      }

      // 🔥 NEU: ZoneMetrics-Intervall stoppen
      if (this.zoneMetricsInterval) {
        clearInterval(this.zoneMetricsInterval);
        this.zoneMetricsInterval = null;
      }

      callback();
    } catch (e) {
      callback();
    }
  }

  // =========================================================================
  // State-Änderungen (Benutzeraktionen)
  // =========================================================================
  async onStateChange(id, state) {
    if (!state) {
      this.log.info(`state ${id} deleted`);
      return;
    }

    if (state.ack === false) {
      // ----------------------------------------------------------
      // Gewicht ändern
      // ----------------------------------------------------------
      if (id.includes("body.weight")) {
        this.log.info(`weight changed → ${state.val}`);
        await this.setWeight(state.val);
        await this.setStateAsync("body.weight", { val: state.val, ack: true });
        return;
      }

      // ----------------------------------------------------------
      // Manuelle Schlaf-Neuberechnung (Recalc) – jetzt mit voller HR-Korrektur!
      // ----------------------------------------------------------
      if (id.endsWith("sleep.Recalculate") && state.val === true) {
        if (this._recalcInProgress) {
          this.log.warn("Recalc bereits aktiv – bitte warten.");
          await this.setStateAsync(id, { val: false, ack: true });
          return;
        }

        this._recalcInProgress = true;

        try {
          const raw = await this.getStateAsync("sleep.RawData");
          if (!raw?.val) {
            this.log.warn(
              "Kein sleep.RawData vorhanden → nichts zum Recalculaten",
            );
            return;
          }

          const parsed = JSON.parse(raw.val);
          const mainBlock = (parsed.sleep || []).find(
            (b) => b.isMainSleep === true,
          );

          if (!mainBlock) {
            this.log.warn(
              "Kein Hauptschlaf im RawData → nichts zu recalculaten",
            );
            return;
          }

          this.log.info("Recalculate mit voller HR-Analyse gestartet...");

          // ← Das ist der entscheidende Unterschied zu vorher:
          this.pendingMainSleep = {
            start: new Date(mainBlock.startTime),
            end: new Date(mainBlock.endTime),
            raw: mainBlock,
          };

          await this.checkNightHRAndProcess(); // ← nutzt alle HR-Logik!

          await this.setStateAsync("sleep.LastRecalculated", {
            val: new Date().toISOString(),
            ack: true,
          });

          this.log.info(
            "Recalculate mit HR-Korrektur erfolgreich abgeschlossen!",
          );
        } catch (err) {
          this.log.error(`Recalc fehlgeschlagen: ${err.message || err}`);
        } finally {
          this._recalcInProgress = false;
          await this.setStateAsync(id, { val: false, ack: true });
        }

        return; // ← Ende des Recalc-Blocks
      } // ← 1. schließende Klammer
    } // ← 2. schließende Klammer (if state.ack === false)
  } // ← 3. schließende Klammer (onStateChange)
} // ← 4. schließende Klammer (Klasse oder äußeres if)

// =========================================================================
// Modul-Export / Start
// =========================================================================
if (require.main !== module) {
  module.exports = (options) => new FitBit(options);
} else {
  new FitBit();
}
