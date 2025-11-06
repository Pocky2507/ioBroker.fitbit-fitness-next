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

      await this.login();

      if (this.fitbit.status === 200) {
        await this.setStateAsync("info.connection", { val: true, ack: true });
        await this.initCustomSleepStates();
        this.initSleepSchedule();
        await this.getFitbitRecords();
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
  // Sleep States anlegen
  // =========================================================================
  async initCustomSleepStates() {
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

    await this.setObjectNotExistsAsync("devices", {
      type: "channel",
      common: { name: "FITBIT Devices" },
      native: {},
    });
  }

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

        // Intraday dynamisch gekoppelt an Config-Intervall
        if (this.effectiveConfig.intraday) {
            // Auflösung dynamisch nach Refresh-Intervall wählen
            const refresh = Math.max(1, Math.round(this.effectiveConfig.refresh));
            const resolution =
            refresh <= 1 ? "1min" : refresh <= 5 ? "5min" : "15min";
            await this.getIntradayHeartRate(resolution);
        }
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

      //
      // Geräte
      //
      if (this.effectiveConfig.devicerecords) {
        try {
          const deviceResponse = await this.getDeviceRecords();

          if (deviceResponse && deviceResponse.status === 200 && Array.isArray(deviceResponse.data?.devices)) {
            this.fitbit.devices = deviceResponse.data.devices;
            this.dlog("debug", `Device info cached (${deviceResponse.data.devices.length} Geräte)`);
          } else if (Array.isArray(deviceResponse?.data)) {
            this.fitbit.devices = deviceResponse.data;
            this.dlog("debug", `Device info cached (${deviceResponse.data.length} Geräte, direct array)`);
          } else {
            this.dlog("debug", "Device info not cached (unexpected response format)");
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
        this.log.error("Still 401 after renew attempt. Manual re-auth may be required.");
      } else {
        this.log.error(`Data retrieval error: ${err}`);
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

        // Herzfrequenz-Puffer täglich zurücksetzen
        this.recentHeartData = [];
        this.dlog("debug", "Heart data buffer cleared for new day");

        this.apiCallsToday++;
        await this.setStateAsync("info.apiCalls.todayTotal", {
          val: this.apiCallsToday,
          ack: true,
        });
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

  // =========================================================================
  // Intraday Herz (optional, gekoppelt an Config-Intervall + HR-Puffer)
  // =========================================================================
  async getIntradayHeartRate(resolution = "1min") {
    if (!this.fitbit.tokens || !this.effectiveConfig.intraday) return;

    const token = this.fitbit.tokens.access_token;
    const userId = "-";
    const dateString = this.getDateTime().dateString;

    const url = `https://api.fitbit.com/1/user/${userId}/activities/heart/date/${dateString}/1d/${resolution}.json`;

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: axiosTimeout,
      });

      if (
        response.status === 200 &&
        response.data["activities-heart-intraday"]
      ) {
        const dataset =
          response.data["activities-heart-intraday"].dataset || [];
        if (dataset.length > 0) {
          const lastEntry = dataset[dataset.length - 1];

          const id = "activity.CurrentHeartRate";
          await this.setObjectNotExistsAsync(id, {
            type: "state",
            common: {
              name: "Current Heart Rate",
              type: "number",
              role: "value.bpm",
              read: true,
              write: true,
            },
            native: {},
          });
          await this.setStateAsync(id, { val: lastEntry.value, ack: true });

          if (!this.recentHeartData) this.recentHeartData = [];
          this.recentHeartData.push({
            ts: new Date(`${dateString}T${lastEntry.time}`),
            value: lastEntry.value,
          });

          this.recentHeartData = this.recentHeartData.slice(-60);

          if (DEBUG_SLEEP_LOG) {
            const prev =
              this.recentHeartData.length > 1
                ? this.recentHeartData[this.recentHeartData.length - 2].value
                : null;
            const diff = prev != null ? Math.abs(lastEntry.value - prev) : 0;

            if (this.effectiveConfig.refresh >= 5 || diff > 5) {
              this.log.debug(
                `Intraday fetch (${resolution}) → ${lastEntry.time}, HR=${lastEntry.value} BPM${diff > 5 ? ` (Δ${diff})` : ""}`,
              );
            }
          }
        }
      }
    } catch (err) {
      this.log.warn(`getIntradayHeartRate failed: ${err}`);
    }

    if (this.recentHeartData?.length > 0) {
      const today = this.getDateTime().dateString;
      this.recentHeartData = this.recentHeartData.filter((p) =>
        p.ts.toISOString().startsWith(today),
      );
    }
  }

  // =========================================================================
  // Geräte
  // =========================================================================
  async getDeviceRecords() {
      const url = `${BASE_URL}-/devices.json`;
      const token = this.fitbit.tokens.access_token;
      let response = null;                          // <— Variable vorab definieren

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
    .filter(d => d.lastSyncTime)
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
            `${lastSyncDevice.deviceVersion || "Gerät"} zuletzt synchronisiert: ${this.formatDE_Short(syncTime)} (vor ${hoursDiff.toFixed(2)}h)`
        );
        this.dlog(
            "info",
            `Aktuellster Sync stammt von: ${lastSyncDevice.deviceVersion || "unknown"} (${this.formatDE_Short(syncTime)})`
        );
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

        if (!this.setSleepStates(response.data)) {
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

  // =========================================================================
  // Sleep – Schreiblogik (inkl. Segmentanalyse + Filter)
  // =========================================================================
  async setSleepStates(data, options = {}) {
      // Relaxed mode → Analyse-Filter abschalten
      if (options.relaxed) {
          this.dlog("info", "Relaxed mode active → disabling strict sleep filters");
          this.effectiveConfig.ignoreEarlyMainSleepEnabled = false;
          this.effectiveConfig.smartEarlySleepEnabled = false;
      }

    const blocks = data && data.sleep ? data.sleep : [];
    if (blocks.length === 0) return false;

    if (
      this.effectiveConfig.ignoreEarlyMainSleepEnabled &&
      this.effectiveConfig.ignoreEarlyMainSleepTime
    ) {
      try {
        const [h, m] = String(this.effectiveConfig.ignoreEarlyMainSleepTime)
          .split(":")
          .map((n) => parseInt(n, 10));

        const now = new Date();
        const tooEarlyNow =
          now.getHours() < h || (now.getHours() === h && now.getMinutes() < m);

        if (tooEarlyNow) {
          const hasCompleteMainSleep =
            Array.isArray(blocks) &&
            blocks.some(
              (b) =>
                b &&
                b.isMainSleep &&
                b.startTime &&
                b.endTime &&
                new Date(b.endTime).getTime() < Date.now(),
            );

          if (hasCompleteMainSleep) {
            this.dlog(
              "debug",
              `It’s currently early (${now.toTimeString().slice(0, 5)} < ${this.effectiveConfig.ignoreEarlyMainSleepTime}), ` +
                `but Fitbit already reports a complete main sleep → proceed with analysis.`,
            );
          } else {
            this.dlog(
              "debug",
              `It’s currently too early (${now.toTimeString().slice(0, 5)} < ${this.effectiveConfig.ignoreEarlyMainSleepTime}) → skip nightly sleep analysis.`,
            );
            return false;
          }
        } else if (DEBUG_SLEEP_LOG) {
          this.log.debug(
            `Current time ${now.toTimeString().slice(0, 5)} >= ${this.effectiveConfig.ignoreEarlyMainSleepTime} → proceed with sleep analysis.`,
          );
        }
      } catch (err) {
        this.log.warn(`Real-time night check failed: ${err.message}`);
      }
    }

    let filteredBlocks = blocks;

    if (this.effectiveConfig.ignoreEarlyMainSleepEnabled) {
      const [h, m] = String(this.effectiveConfig.ignoreEarlyMainSleepTime)
        .split(":")
        .map((n) => parseInt(n, 10));

      if (Number.isInteger(h) && Number.isInteger(m)) {
        filteredBlocks = filteredBlocks.filter((b) => {
          if (b && b.isMainSleep && b.startTime) {
            const start = new Date(b.startTime);
            const sh = start.getHours();
            const sm = start.getMinutes();
            const before = sh < h || (sh === h && sm < m);

            if (before) {
              if (this.effectiveConfig.smartEarlySleepEnabled && b.endTime) {
                const dur = new Date(b.endTime).getTime() - start.getTime();
                const minMs =
                  Math.max(
                    0.5,
                    Number(this.effectiveConfig.minMainSleepHours) || 3,
                  ) *
                  60 *
                  60 *
                  1000;

                if (dur >= minMs) {
                  this.dlog(
                    "info",
                    `Main sleep accepted (starts ${start.toISOString()} < ${this.effectiveConfig.ignoreEarlyMainSleepTime}, duration ${Math.round(dur / 60000)}min ≥ ${Math.round(minMs / 60000)}min)`,
                  );
                  return true;
                }
              }

              this.dlog(
                "info",
                `Main sleep ignored (starts ${start.toISOString()} < ${this.effectiveConfig.ignoreEarlyMainSleepTime})`,
              );
              return false;
            }
          }
          return true;
        });
      }
    }

    if (
      this.effectiveConfig.smartEarlySleepEnabled &&
      !this.effectiveConfig.ignoreEarlyMainSleepEnabled
    ) {
      const minMs =
        Math.max(0.5, Number(this.effectiveConfig.minMainSleepHours) || 3) *
        60 *
        60 *
        1000;
      filteredBlocks = filteredBlocks.filter((b) => {
        if (b && b.isMainSleep && b.startTime && b.endTime) {
          const dur =
            new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
          if (dur > 0 && dur < minMs) {
            this.dlog(
              "info",
              `Main sleep ignored (duration ${Math.round(dur / 60000)}min < ${Math.round(minMs / 60000)}min)`,
            );
            return false;
          }
        }
        return true;
      });
    }

    if (filteredBlocks.length === 0) {
      const naps = blocks.filter((b) => !b.isMainSleep);
      if (naps.length > 0) {
        this.dlog(
          "info",
          `Main sleep ignored, but ${naps.length} nap(s) found → using those.`,
        );
        filteredBlocks = naps;
      } else {
        this.dlog(
          "debug",
          "All sleep blocks ignored by filters (no naps or main sleep)",
        );
        return false;
      }
    }

    let totalAsleep = 0;
    let totalInBed = 0;
    let napsAsleep = 0;
    let napsInBed = 0;
    let napsCount = 0;

    let mainDeep = 0,
      mainLight = 0,
      mainRem = 0,
      mainWake = 0;
    const napList = [];

    for (const block of filteredBlocks) {
      totalAsleep += block.minutesAsleep || 0;
      totalInBed += block.timeInBed || 0;

      if (block.isMainSleep) {
        const s =
          block.levels && block.levels.summary ? block.levels.summary : {};
        mainDeep = (s.deep && s.deep.minutes) || 0;
        mainLight = (s.light && s.light.minutes) || 0;
        mainRem = (s.rem && s.rem.minutes) || 0;
        mainWake = (s.wake && s.wake.minutes) || 0;

        this.setState("sleep.Deep", mainDeep, true);
        this.setState("sleep.Light", mainLight, true);
        this.setState("sleep.Rem", mainRem, true);
        this.setState("sleep.Wake", mainWake, true);
      } else {
        const napFell = this.computeFellAsleepAt(block);
        const napWoke = this.computeWokeUpAt(block);

        napsAsleep += block.minutesAsleep || 0;
        napsInBed += block.timeInBed || 0;
        napsCount++;

        napList.push({
          startISO: napFell ? napFell.toISOString() : "",
          endISO: napWoke ? napWoke.toISOString() : "",
          startDE: napFell ? this.formatDE_Short(napFell) : "",
          endDE: napWoke ? this.formatDE_Short(napWoke) : "",
          minutesAsleep: block.minutesAsleep || 0,
          timeInBed: block.timeInBed || 0,
        });
      }
    }

    let realSleepMinutes = totalAsleep;
    const mainBlockForTotal = filteredBlocks.find((b) => b.isMainSleep);

    if (mainBlockForTotal) {
      const fell = this.computeFellAsleepAt(mainBlockForTotal);
      const woke = this.computeWokeUpAt(mainBlockForTotal);

      if (fell && woke) {
        realSleepMinutes = Math.round(
          (woke.getTime() - fell.getTime()) / 60000,
        );
        this.dlog(
          "info",
          `Gesamtschlafzeit (berechnet): ${realSleepMinutes}min (Fitbit meldet ${totalAsleep}min)`,
        );
      } else {
        this.dlog(
          "warn",
          "Konnte keine gültigen Ein-/Aufwachzeiten berechnen – benutze Fitbit-Wert.",
        );
      }
    } else {
      this.dlog(
        "warn",
        "Kein Hauptschlafblock gefunden – benutze Fitbit-Wert.",
      );
    }

    const totalWithNaps = realSleepMinutes + (napsAsleep || 0);

    await this.setStateAsync("sleep.AsleepTotal", totalWithNaps, true);
    await this.setStateAsync("sleep.InBedTotal", totalInBed, true);

    this.dlog(
      "info",
      `Gesamtschlaf inkl. Naps: ${totalWithNaps}min (Hauptschlaf ${realSleepMinutes}min + Naps ${napsAsleep}min)`,
    );

    await this.setStateAsync("sleep.Naps.Asleep", napsAsleep, true);
    await this.setStateAsync("sleep.Naps.InBed", napsInBed, true);
    await this.setStateAsync("sleep.Naps.Count", napsCount, true);

    const mainBlock = filteredBlocks.find((b) => b.isMainSleep);
    if (mainBlock) {
      const fell = this.computeFellAsleepAt(mainBlock, options);
      const woke = this.computeWokeUpAt(mainBlock);

      this.dlog(
        "info",
        `Hauptschlaf erkannt → Eingeschlafen: ${this.formatDE_Short(fell)}, Aufgewacht: ${this.formatDE_Short(woke)}`
      );

      await this.setStateAsync("sleep.Main.FellAsleepAt", {
        val: fell ? fell.toISOString() : "",
        ack: true,
      });
      await this.setStateAsync("sleep.Main.FellAsleepAtLocal", {
        val: fell ? this.formatDE_Short(fell) : "",
        ack: true,
      });
      await this.setStateAsync("sleep.Main.WokeUpAt", {
        val: woke ? woke.toISOString() : "",
        ack: true,
      });
      await this.setStateAsync("sleep.Main.WokeUpAtLocal", {
        val: woke ? this.formatDE_Short(woke) : "",
        ack: true,
      });
    } else {
      await this.setStateAsync("sleep.Main.FellAsleepAt", {
        val: "",
        ack: true,
      });
      await this.setStateAsync("sleep.Main.FellAsleepAtLocal", {
        val: "",
        ack: true,
      });
      await this.setStateAsync("sleep.Main.WokeUpAt", { val: "", ack: true });
      await this.setStateAsync("sleep.Main.WokeUpAtLocal", {
        val: "",
        ack: true,
      });
    }

    napList.sort((a, b) => new Date(a.startISO) - new Date(b.startISO));

    if (napList.length > 0) {
      const napBlock = this.effectiveConfig.showLastOrFirstNap
        ? napList[napList.length - 1]
        : napList[0];
      await this.setStateAsync("sleep.Naps.FellAsleepAt", {
        val: napBlock.startISO,
        ack: true,
      });
      await this.setStateAsync("sleep.Naps.FellAsleepAtLocal", {
        val: napBlock.startDE,
        ack: true,
      });
      await this.setStateAsync("sleep.Naps.WokeUpAt", {
        val: napBlock.endISO,
        ack: true,
      });
      await this.setStateAsync("sleep.Naps.WokeUpAtLocal", {
        val: napBlock.endDE,
        ack: true,
      });
    } else {
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

    await this.setStateAsync("sleep.Naps.List", {
      val: JSON.stringify(napList),
      ack: true,
    });

    if (DEBUG_SLEEP_LOG) {
      this.log.info(
        `Sleep: totalAsleep=${totalAsleep}min, totalInBed=${totalInBed}min, naps=${napsCount}x (${napsAsleep}min)`,
      );
    }

    if (DEBUG_TEST_MODE) {
      const mainBlock = filteredBlocks.find((b) => b.isMainSleep);
      if (mainBlock) {
        const fell = this.computeFellAsleepAt(mainBlock, options);
        const woke = this.computeWokeUpAt(mainBlock);
        const dur = woke && fell ? Math.round((woke - fell) / 60000) : 0;
        const refined =
          fell &&
          woke &&
          Math.abs(new Date(mainBlock.startTime) - fell) > 120000;
        const source = refined ? "refined" : "fallback";

        this.log.info(
          `MainSleep (${source}) → Fell: ${this.formatDE_Short(fell)}, Wake: ${this.formatDE_Short(woke)}, Duration: ${dur}min`,
        );
      }

      if (napsCount > 0 && napList.length > 0) {
        napList
          .filter((n) => n.minutesAsleep >= 10)
          .forEach((nap, idx) => {
            this.log.info(
              `Nap ${idx + 1}/${napList.length} → ${nap.startDE} – ${nap.endDE} (${nap.minutesAsleep}min)`,
            );
          });
      }
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

  computeFellAsleepAt(block, options = {}) {
    const segs = this.getLevelSegments(block);
    const SLEEP_LEVELS = new Set(["asleep", "light", "deep", "rem"]);

    if (
      block.isMainSleep &&
      this.effectiveConfig.intraday &&
      this.recentHeartData?.length > 10
    ) {
      const start = new Date(block.startTime);
      const window60 = this.recentHeartData.filter(
        (p) => Math.abs(start - p.ts) <= 60 * 60000
      );
      if (window60.length > 10) {
        const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const before = mean(window60.filter(p => p.ts < start).map(p => p.value));
        const after  = mean(window60.filter(p => p.ts >= start).map(p => p.value));
        const drop = before - after;

        if (drop < 8) {
          this.dlog(
            "debug",
            `[COUCH-FILTER] Heart-rate drop only ${drop.toFixed(1)} BPM around ${start.toISOString()} → likely not asleep (Couch phase).`
          );
          return this._parseISO(block.startTime);
        } else {
          this.dlog(
            "debug",
            `[COUCH-FILTER] Heart-rate dropped ${drop.toFixed(1)} BPM → likely real sleep.`
          );
        }
      }
    }

    if (block.isMainSleep && segs.length > 0) {
      const start = new Date(block.startTime);
      const within180 = segs.filter(s => new Date(s.dateTime) - start <= 180 * 60000);
      const hasDeepRem = within180.some(s => s.level === "deep" || s.level === "rem");
      if (!hasDeepRem) {
        const firstReal = segs.find(s => s.level === "deep" || s.level === "rem" || s.level === "light");
        if (firstReal) {
          this.dlog(
            "debug",
            `[COUCH-FILTER] No Deep/REM within 3 h after ${start.toISOString()} → adjusted start to ${firstReal.dateTime}`
          );
          return new Date(firstReal.dateTime);
        }
      }
    }

    if (block.isMainSleep && this.effectiveConfig.ignoreEarlyMainSleepEnabled) {
      const [h, m] = this.effectiveConfig.ignoreEarlyMainSleepTime
      .split(":")
      .map(Number);
      const earlyLimit = h + m / 60;
      const stabilityMin = options?.relaxed ? 5 : (this.effectiveConfig?.sleepStabilityMinutes || 20);

      if (segs.length > 0) {
        const firstValid = segs.find((s) => {
          const dt = new Date(s.dateTime);
          const hour = dt.getHours() + dt.getMinutes() / 60;
          const afterLimit = hour >= earlyLimit;
          const isDeepOrRem = s.level === "deep" || s.level === "rem";
          return afterLimit && isDeepOrRem;
        });

        if (firstValid) {
          const idx = segs.indexOf(firstValid);
          const next = segs[idx + 1]
          ? new Date(segs[idx + 1].dateTime)
          : new Date(firstValid.dateTime);
          const durMin = (next - new Date(firstValid.dateTime)) / 60000;

          if (durMin >= stabilityMin) {
            this.dlog(
              "info",
              `[EARLY-FILTER] First stable Deep/REM found after ${this.effectiveConfig.ignoreEarlyMainSleepTime} → ${firstValid.dateTime} (${Math.round(durMin)}min ≥ ${stabilityMin}min)`
            );
            return new Date(firstValid.dateTime);
          } else {
            this.dlog(
              "debug",
              `[EARLY-FILTER] Deep/REM ${firstValid.dateTime} too short (${Math.round(durMin)}min < ${stabilityMin}min) → ignoring`
            );
          }
        }
      }
    }

    if (block.isMainSleep && this.effectiveConfig.ignoreEarlyMainSleepEnabled) {
      const [h, m] = this.effectiveConfig.ignoreEarlyMainSleepTime
        .split(":")
        .map(Number);
      const earlyLimit = h + m / 60;
      if (!segs.length) return this._parseISO(block.startTime);

      const firstSeg = new Date(segs[0].dateTime);
      const startHour = firstSeg.getHours() + firstSeg.getMinutes() / 60;

      if (startHour < earlyLimit) {
        let firstLight = null,
          firstDeep = null,
          firstREM = null;

        for (const s of segs) {
          if (!firstLight && s.level === "light")
            firstLight = new Date(s.dateTime);
          if (!firstDeep && s.level === "deep")
            firstDeep = new Date(s.dateTime);
          if (!firstREM && s.level === "rem") firstREM = new Date(s.dateTime);
        }

        const firstReal = firstDeep || firstREM || firstLight;
        if (firstReal && firstReal > firstSeg) {
          this.dlog(
            "debug",
            `Adjusted early main sleep start from ${firstSeg.toISOString()} → ${firstReal.toISOString()}`,
          );
          return firstReal;
        }
      }
    }

    if (!segs.length) return this._parseISO(block && block.startTime);
    const stabilityMin = options?.relaxed ? 5 : (this.effectiveConfig?.sleepStabilityMinutes || 20);

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (SLEEP_LEVELS.has(s.level)) {
        const start = this._parseISO(s.dateTime);
        let sleepDurMin = 0;

        for (
          let j = i;
          j < segs.length && SLEEP_LEVELS.has(segs[j].level);
          j++
        ) {
          const next = segs[j + 1]
            ? this._parseISO(segs[j + 1].dateTime)
            : null;
          if (next)
            sleepDurMin += (next - this._parseISO(segs[j].dateTime)) / 60000;
        }

        const nextWake = segs[i + 1];
        const nextWakeDur =
          nextWake && !SLEEP_LEVELS.has(nextWake.level) && segs[i + 2]
            ? (this._parseISO(segs[i + 2].dateTime) -
                this._parseISO(nextWake.dateTime)) /
              60000
            : 0;

        if (sleepDurMin >= stabilityMin && nextWakeDur < 15) {
          this.dlog(
            "debug",
            `Refined sleep start detected at ${start?.toISOString() || "?"} (stable ${Math.round(sleepDurMin)} min ≥ ${stabilityMin} min)`,
          );
          return start;
        }
      }
    }

    if (block.isMainSleep) {
      try {
        let adjustedStart = start instanceof Date ? new Date(start) : this._parseISO(block?.startTime);

        const devices = this.fitbit?.devices || [];

        if ((this.effectiveConfig.intraday || this.recentHeartData?.length > 0) && devices.length > 0) {

          const lastHR = this.recentHeartData
          .filter(h => h.ts instanceof Date && h.ts < adjustedStart)
          .sort((a, b) => b.ts - a.ts)[0];

          const lastSyncDevice = devices.find(d => d.lastSyncTime);
          const lastSync = lastSyncDevice ? new Date(lastSyncDevice.lastSyncTime) : null;

          const lastActivity = [lastHR?.ts, lastSync]
          .filter(Boolean)
          .sort((a, b) => b - a)[0];

          if (lastActivity) {
            const bufferMinutes = this.effectiveConfig.smartEarlySleepEnabled ? 15 : 10;
            const minSleepStart = new Date(lastActivity.getTime() + bufferMinutes * 60000);

            if (adjustedStart < minSleepStart) {
              this.dlog(
                "info",
                `Auto-corrected sleep start: ${adjustedStart.toLocaleTimeString("de-DE")} → ${minSleepStart.toLocaleTimeString("de-DE")} (last activity: ${lastActivity.toLocaleTimeString("de-DE")})`
              );
              adjustedStart = minSleepStart;
            }
          }
        }

        if (adjustedStart) return adjustedStart;

      } catch (err) {
        this.dlog("warn", `Auto activity correction failed: ${err.message}`);
      }
    }

    this.dlog(
      "debug",
      "No refined sleep phase found → fallback to block.startTime",
    );
    return this._parseISO(block && block.startTime);
  }

  computeWokeUpAt(block) {
    const segs = this.getLevelSegments(block);
    const SLEEP_LEVELS = new Set(["asleep", "light", "deep", "rem"]);

    if (!segs.length) return this._parseISO(block && block.endTime);

    let lastSleepIdx = -1;
    for (let i = segs.length - 1; i >= 0; i--) {
      if (SLEEP_LEVELS.has(segs[i].level)) {
        lastSleepIdx = i;
        break;
      }
    }
    if (lastSleepIdx === -1) return this._parseISO(block && block.endTime);

    const s = segs[lastSleepIdx];
    const segStart = this._parseISO(s.dateTime);

    let endOfLastSleep = null;
    if (typeof s.seconds === "number") {
      endOfLastSleep = this._addSeconds(segStart, s.seconds);
    } else if (segs[lastSleepIdx + 1]) {
      endOfLastSleep = this._parseISO(segs[lastSleepIdx + 1].dateTime);
    } else {
      endOfLastSleep = this._parseISO(block && block.endTime) || segStart;
    }

    const wakeStableMin = this.effectiveConfig?.sleepStabilityMinutes || 20;
    let wakeDurMin = 0;

    for (
      let j = lastSleepIdx + 1;
      j < segs.length && !SLEEP_LEVELS.has(segs[j].level);
      j++
    ) {
      const wStart = this._parseISO(segs[j].dateTime);
      const wNext = segs[j + 1] ? this._parseISO(segs[j + 1].dateTime) : null;
      if (wNext) {
        wakeDurMin += (wNext - wStart) / 60000;
      } else {
        const endTime =
          this._parseISO(block && block.endTime) || endOfLastSleep;
        wakeDurMin += (endTime - wStart) / 60000;
      }
    }

    if (wakeDurMin < wakeStableMin) {
      const fallback = this._parseISO(block && block.endTime);
      this.dlog(
        "debug",
        `Wake stability only ${Math.round(wakeDurMin)} min < ${wakeStableMin} min → fallback to block.endTime ${fallback?.toISOString() || "?"}`,
      );
      return fallback || endOfLastSleep;
    }

    this.dlog(
      "debug",
      `Final wake at end of last sleep seg: ${endOfLastSleep?.toISOString() || "?"} (stable wake ${Math.round(wakeDurMin)} min ≥ ${wakeStableMin} min)`,
    );

    return endOfLastSleep;
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

  // =========================================================================
  // Unload / Stop
  // =========================================================================
  onUnload(callback) {
    try {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      if (this.sleepSchedule) {
        this.sleepSchedule.cancel();
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
      if (id.includes("body.weight")) {
        this.log.info(`weight changed → ${state.val}`);
        await this.setWeight(state.val);
        await this.setStateAsync("body.weight", { val: state.val, ack: true });
        return;
      }

      if (id.endsWith("sleep.Recalculate") && state.val === true) {
        if (this._recalcInProgress) {
          this.log.warn("Recalculation already in progress — skipping duplicate click.");
          return;
        }
        this._recalcInProgress = true;
        try {
          const raw = await this.getStateAsync("sleep.RawData");
          if (raw && raw.val) {
            const parsed = JSON.parse(raw.val);
            this.log.info("Recalculating sleep data from stored RawData (relaxed mode)...");
            await this.setSleepStates(parsed, { relaxed: true });
            await this.setStateAsync("sleep.LastRecalculated", {
              val: new Date().toISOString(),
              ack: true,
            });
            this.log.info("Sleep recalculation completed successfully.");
          } else {
            this.log.warn("No stored RawData available — nothing to recalc.");
          }
        } catch (err) {
          this.log.error(`Recalculation failed: ${err}`);
        } finally {
          this._recalcInProgress = false;
          await this.setStateAsync(id, { val: false, ack: true });
        }
        return;
      }
    }
  }
}

// =========================================================================
// Modul-Export / Start
// =========================================================================
if (require.main !== module) {
  module.exports = (options) => new FitBit(options);
} else {
  new FitBit();
}
