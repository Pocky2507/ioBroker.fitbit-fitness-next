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

// -----------------------------------------------------------------------------
// Timeouts und API-Basen
// -----------------------------------------------------------------------------
const axiosTimeout = 15000;
const BASE_URL  = "https://api.fitbit.com/1/user/";
const BASE2_URL = "https://api.fitbit.com/1.2/user/";
const HEART_RATE_ZONE_RANGES = ["customHeartRateZones", "heartRateZones"];

// -----------------------------------------------------------------------------
// Backward-compat Defaults (werden über Admin-Config übersteuert)
// -----------------------------------------------------------------------------
const DEFAULTS = {
    intraday: false,
    showLastOrFirstNap: true,       // true = letztes Nap, false = erstes Nap
    clearNapListAtNight: true,      // 00–04 Uhr Nap-Liste leeren
    enableDailyNapClear: false,     // zusätzl. fester täglicher Reset
    dailyNapClearTime: "02:45",     // HH:MM

    // Frühschlaf-Filter (fixe Uhrzeit)
    ignoreEarlyMainSleepEnabled: true,
    ignoreEarlyMainSleepTime: "23:00",

    // 🆕 Smart-Filter: kurze Hauptschlafphasen ignorieren
    smartEarlySleepEnabled: true,
    minMainSleepHours: 3,

    // 🆕 Debug-Schalter aus Admin
    debugEnabled: false
};

class FitBit extends utils.Adapter {
    constructor(options) {
        super({ ...options, name: "fitbit-fitness" });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));

        this.updateInterval = null;
        this.sleepSchedule  = null;

        this.fitbit = {
            tokens: null,
            status: null,
            user: null,
            sleepRecordsStoredate: null,
        };

        this._renewInProgress = false;
        this.FORBIDDEN_CHARS = /[.\[\],]/g;

        // kleine Helper, werden in onReady() belegt
        this.dlog = (level, msg) => {}; // Debug-Logger
    }

    // =========================================================================
    // Adapter Start
    // =========================================================================
    async onReady() {
        try {
            // Verbindung erstmal auf false
            await this.setStateAsync("info.connection", { val: false, ack: true });

            // Konfiguration mit Defaults zusammenführen (rückwärtskompatibel)
            this.effectiveConfig = {
                // bestehende Optionen
                intraday:               this._coalesceBool(this.config.intraday,               DEFAULTS.intraday),
                showLastOrFirstNap:     this._coalesceBool(this.config.showLastOrFirstNap,     DEFAULTS.showLastOrFirstNap),
                clearNapListAtNight:    this._coalesceBool(this.config.clearNapListAtNight,    DEFAULTS.clearNapListAtNight),
                enableDailyNapClear:    this._coalesceBool(this.config.enableDailyNapClear,    DEFAULTS.enableDailyNapClear),
                dailyNapClearTime:      this._validTime(this.config.forceClearNapListTime || this.config.dailyNapClearTime)
                                         ? (this.config.forceClearNapListTime || this.config.dailyNapClearTime)
                                         : DEFAULTS.dailyNapClearTime,

                // Frühschlaf-Filter (fixe Uhrzeit)
                ignoreEarlyMainSleepEnabled: this._coalesceBool(this.config.ignoreEarlyMainSleepEnabled, DEFAULTS.ignoreEarlyMainSleepEnabled),
                ignoreEarlyMainSleepTime:    this._validTime(this.config.ignoreEarlyMainSleepTime) ? this.config.ignoreEarlyMainSleepTime : DEFAULTS.ignoreEarlyMainSleepTime,

                // 🆕 Smart-Filter (Mindestdauer Hauptschlaf)
                smartEarlySleepEnabled: this._coalesceBool(this.config.smartEarlySleepEnabled, DEFAULTS.smartEarlySleepEnabled),
                minMainSleepHours:      Number.isFinite(this.config.minMainSleepHours) ? Number(this.config.minMainSleepHours) : DEFAULTS.minMainSleepHours,

                // 🆕 Debug-Schalter
                debugEnabled:           this._coalesceBool(this.config.debugEnabled, DEFAULTS.debugEnabled),

                // Admin/Bestandsoptionen
                refresh:                Number.isFinite(this.config.refresh) ? Number(this.config.refresh) : 5,
                bodyrecords:            !!this.config.bodyrecords,
                activityrecords:        !!this.config.activityrecords,
                sleeprecords:           !!this.config.sleeprecords,
                sleeprecordsschedule:   !!this.config.sleeprecordsschedule,
                foodrecords:            !!this.config.foodrecords,
                devicerecords:          !!this.config.devicerecords,
                clientId:               this.config.clientId || "",
                clientSecret:           this.config.clientSecret || "",
                redirectUri:            this.config.redirectUri || "",
            };

            // Debug-Schalter aktivieren
            DEBUG_SLEEP_LOG = !!this.effectiveConfig.debugEnabled;
            this.dlog = (level, msg) => { if (DEBUG_SLEEP_LOG && this.log && typeof this.log[level] === "function") this.log[level](msg); };

            // Log der effektiven Einstellungen
            this.log.info(
                `Config → intraday=${this.effectiveConfig.intraday ? "on" : "off"}, ` +
                `showLastOrFirstNap=${this.effectiveConfig.showLastOrFirstNap ? "last" : "first"}, ` +
                `clearNapListAtNight=${this.effectiveConfig.clearNapListAtNight ? "on" : "off"}, ` +
                `enableDailyNapClear=${this.effectiveConfig.enableDailyNapClear ? `on @ ${this.effectiveConfig.dailyNapClearTime}` : "off"}, ` +
                `ignoreEarlyMainSleep=${this.effectiveConfig.ignoreEarlyMainSleepEnabled ? `on < ${this.effectiveConfig.ignoreEarlyMainSleepTime}` : "off"}, ` +
                `smartEarlySleep=${this.effectiveConfig.smartEarlySleepEnabled ? `on < ${this.effectiveConfig.minMainSleepHours}h` : "off"}, ` +
                `debug=${DEBUG_SLEEP_LOG ? "on" : "off"}`
            );
            this.log.info(`Intervals → refresh every ${this.effectiveConfig.refresh} min; scheduled sleep fetch=${this.effectiveConfig.sleeprecordsschedule ? "on" : "off"}`);

            // Login (holt Tokens aus States)
            await this.login();

            if (this.fitbit.status === 200) {
                await this.setStateAsync("info.connection", { val: true, ack: true });

                // Zusatz-States anlegen (nur einmalig)
                await this.initCustomSleepStates();

                // Sleep-Pläne (Admin-Optionen)
                this.initSleepSchedule();

                // Erster Abruf
                await this.getFitbitRecords();

                // Wiederholter Abruf
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

        // Schreibbare States abonnieren (z.B. body.weight)
        this.subscribeStates("body.weight");
    }

    // =========================================================================
    // States vorbereiten (zusätzlich zu io-package / Original)
    // =========================================================================
    async initCustomSleepStates() {
        // Minuten-/Zähler-States
        const minuteStates = [
            { id: "sleep.AsleepTotal", name: "Total minutes asleep (incl. naps)", unit: "min" },
            { id: "sleep.InBedTotal",  name: "Total minutes in bed (incl. naps)", unit: "min" },
            { id: "sleep.Naps.Asleep", name: "Minutes asleep in naps", unit: "min" },
            { id: "sleep.Naps.InBed",  name: "Minutes in bed during naps", unit: "min" },
            { id: "sleep.Naps.Count",  name: "Number of naps", unit: "" },
        ];

        for (const s of minuteStates) {
            await this.setObjectNotExistsAsync(s.id, {
                type: "state",
                common: { name: s.name, type: "number", role: "value", unit: s.unit, read: true, write: true },
                native: {},
            });
        }

        // Zeitstempel- und Text-States
        const timeStates = [
            // Hauptschlaf
            { id: "sleep.Main.FellAsleepAt",      name: "Main sleep - fell asleep at (ISO)" },
            { id: "sleep.Main.FellAsleepAtLocal", name: "Main sleep - fell asleep at (local de-DE)" },
            { id: "sleep.Main.WokeUpAt",          name: "Main sleep - woke up at (ISO)" },
            { id: "sleep.Main.WokeUpAtLocal",     name: "Main sleep - woke up at (local de-DE)" },

            // ausgewähltes Nap
            { id: "sleep.Naps.FellAsleepAt",      name: "Nap - fell asleep at (ISO)" },
            { id: "sleep.Naps.FellAsleepAtLocal", name: "Nap - fell asleep at (local de-DE)" },
            { id: "sleep.Naps.WokeUpAt",          name: "Nap - woke up at (ISO)" },
            { id: "sleep.Naps.WokeUpAtLocal",     name: "Nap - woke up at (local de-DE)" },

            // Liste aller heutigen Naps (JSON)
            { id: "sleep.Naps.List",              name: "List of today naps as JSON" },
        ];

        for (const s of timeStates) {
            await this.setObjectNotExistsAsync(s.id, {
                type: "state",
                common: { name: s.name, type: "string", role: "text", read: true, write: true },
                native: {},
            });
        }

        // Geräte-Channel (falls nicht vorhanden)
        await this.setObjectNotExistsAsync("devices", {
            type: "channel",
            common: { name: "FITBIT Devices" },
            native: {}
        });
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
                if (this.effectiveConfig.intraday) {
                    await this.getIntradayHeartRate();
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
                    this.dlog("debug", `Sleep via daily schedule active → skip in interval fetch`);
                } else {
                    await this.getSleepRecords();
                }
            }

            // Geräte
            if (this.effectiveConfig.devicerecords) {
                await this.getDeviceRecords();
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
    // Login (holt Tokens aus States, validiert per /profile.json)
    // =========================================================================
    async login() {
        try {
            const accessToken  = await this.getStateAsync("tokens.access");
            const refreshToken = await this.getStateAsync("tokens.refresh");

            if (accessToken && refreshToken && accessToken.val && refreshToken.val) {
                this.fitbit.tokens = {
                    access_token:  String(accessToken.val),
                    refresh_token: String(refreshToken.val),
                };
            } else {
                throw new Error("no tokens available. Recreate token in config");
            }

            const url = "https://api.fitbit.com/1/user/-/profile.json";
            const response = await axios.get(url, {
                headers: { "Authorization": `Bearer ${this.fitbit.tokens.access_token}` },
                timeout: axiosTimeout
            });

            this.fitbit.status = response.status;

            if (response.status === 200) {
                await this.setStateAsync("info.connection", { val: true, ack: true });
                this.setUserStates(response.data);
                this.log.info(`Login OK for user ${this.fitbit.user?.fullName || "?"}`);
            } else {
                throw new Error(`Login failed with status ${response.status}`);
            }
        } catch (err) {
            throw new Error(err);
        }
    }

    setUserStates(data) {
        this.fitbit.user = data.user || {};
        this.log.info(`User logged in ${this.fitbit.user.fullName} id:${this.fitbit.user.encodedId}`);
        this.setState("user.fullName", this.fitbit.user.fullName || "", true);
        this.setState("user.userid",   this.fitbit.user.encodedId || "", true);
    }

    // =========================================================================
    // Sleep-Scheduling (Admin-Optionen + zusätzlicher Reset)
    // =========================================================================
    initSleepSchedule() {
        // 1) Täglicher randomisierter Abruf (wie original), wenn aktiviert
        if (this.effectiveConfig.sleeprecords && this.effectiveConfig.sleeprecordsschedule) {
            const rndMinutes = Math.floor(Math.random() * 59);
            const rndHours = 20 + Math.floor(Math.random() * 2); // 20–21 Uhr
            this.log.info(`Sleep schedule: daily ${rndHours}:${rndMinutes.toString().padStart(2, "0")} (randomized)`);
            this.sleepSchedule = mSchedule.scheduleJob(`${rndMinutes} ${rndHours} * * *`, () => {
                if (this.effectiveConfig.sleeprecords) this.getSleepRecords();
            });
        }

        // 2) Optional: fester täglicher Nap-Reset (nur wenn enableDailyNapClear=true)
        if (this.effectiveConfig.enableDailyNapClear) {
            const t = this.effectiveConfig.dailyNapClearTime || DEFAULTS.dailyNapClearTime;
            const [h, m] = String(t).split(":");
            const hour = parseInt(h, 10);
            const min  = parseInt(m, 10);
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
    // Aktivitäten
    // =========================================================================
    async getActivityRecords() {
        const url = `${BASE_URL}-/activities/date/${this.getDateTime().dateString}.json`;
        const token = this.fitbit.tokens.access_token;

        try {
            const response = await axios.get(url, {
                headers: { "Authorization": `Bearer ${token}` },
                timeout: axiosTimeout
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

        this.setState("activity.Steps",              data.summary.steps || 0, true);
        this.setState("activity.Floors",             data.summary.floors || 0, true);
        this.setState("activity.ActiveMinutes",      data.summary.veryActiveMinutes || 0, true);
        this.setState("activity.RestingHeartRate",   data.summary.restingHeartRate || 0, true);
        this.setState("activity.Calories",           data.summary.caloriesOut || 0, true);
        this.setState("activity.ActivitiesCount",    (data.activities && data.activities.length) || 0, true);

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
                headers: { "Authorization": `Bearer ${token}` },
                timeout: axiosTimeout
            });
            if (response.status === 200) {
                if (!this.setHeartRateTimeSeries(response.data)) {
                    this.dlog(`debug`, `No heart rate time series available`);
                } else {
                    this.dlog(`debug`, `Heart rate time series updated`);
                }
            }
        } catch (err) {
            this.log.error(`Error in getHeartRateTimeSeries: ${err}`);
        }
    }

    async setHeartRateTimeSeries(data) {
        if (!data || !data["activities-heart"]) return false;

        for (const entry of data["activities-heart"]) {
            const val = entry.value || {};

            // Zonen (custom/standard)
            for (const zonesKey of Object.keys(val).filter(k => HEART_RATE_ZONE_RANGES.includes(k))) {
                const zonesArr = Array.isArray(val[zonesKey]) ? val[zonesKey] : [];
                for (const zone of zonesArr) {
                    const zoneName = String(zone.name || "Zone").replace(this.FORBIDDEN_CHARS, "_");

                    for (const k of Object.keys(zone).filter(k => k !== "name")) {
                        const entryValueName = k.replace(this.FORBIDDEN_CHARS, "_");
                        const id = `activity.heartratezones.${zoneName}.${entryValueName}`;

                        await this.setObjectNotExistsAsync(id, {
                            type: "state",
                            common: { name: `${k} - ${zoneName}`, type: "number", read: true, write: true },
                            native: {}
                        });
                        await this.setStateAsync(id, { val: (zone[k] ?? 0), ack: true });
                    }

                    const idCustom = `activity.heartratezones.${zoneName}.isCustom`;
                    await this.setObjectNotExistsAsync(idCustom, {
                        type: "state",
                        common: { name: "custom heart rate zone", type: "boolean", read: true, write: true },
                        native: {}
                    });
                    await this.setStateAsync(idCustom, { val: zonesKey.includes("custom"), ack: true });
                }
            }

            // RHR ggf. überschreiben
            if (entry.value && typeof entry.value.restingHeartRate === "number") {
                await this.setStateAsync("activity.RestingHeartRate", { val: entry.value.restingHeartRate, ack: true });
            }
        }

        return true;
    }

    // =========================================================================
    // Intraday Herz (optional)
    // =========================================================================
    async getIntradayHeartRate() {
        if (!this.fitbit.tokens || !this.effectiveConfig.intraday) return;

        const token = this.fitbit.tokens.access_token;
        const userId = "-";
        const dateString = this.getDateTime().dateString;
        const url = `https://api.fitbit.com/1/user/${userId}/activities/heart/date/${dateString}/1d/1min.json`;

        try {
            const response = await axios.get(url, {
                headers: { "Authorization": `Bearer ${token}` },
                timeout: axiosTimeout
            });

            if (response.status === 200 && response.data["activities-heart-intraday"]) {
                const intradayData = response.data["activities-heart-intraday"].dataset || [];
                if (intradayData.length > 0) {
                    const lastEntry = intradayData[intradayData.length - 1];

                    const id = "activity.CurrentHeartRate";
                    await this.setObjectNotExistsAsync(id, {
                        type: "state",
                        common: { name: "Current Heart Rate", type: "number", role: "value.bpm", read: true, write: true },
                        native: {}
                    });
                    await this.setStateAsync(id, { val: lastEntry.value, ack: true });
                }
            }
        } catch (err) {
            this.log.warn(`getIntradayHeartRate failed: ${err}`);
        }
    }

    // =========================================================================
    // Geräte
    // =========================================================================
    async getDeviceRecords() {
        const url = `${BASE_URL}-/devices.json`;
        const token = this.fitbit.tokens.access_token;

        try {
            const response = await axios.get(url, {
                headers: { "Authorization": `Bearer ${token}` },
                timeout: axiosTimeout
            });

            if (response.status === 200) {
                await this.setDeviceStates(response.data);
            }
        } catch (err) {
            this.log.warn(`getDeviceRecords: ${err}`);
        }
    }

    async setDeviceStates(data) {
        if (!Array.isArray(data)) return false;

        for (const device of data) {
            const channelId = `devices.${device.id}`;
            const channelName = device.deviceVersion || `Device ${device.id}`;

            await this.setObjectNotExistsAsync(channelId, {
                type: "channel",
                common: { name: channelName },
                native: {}
            });

            const states = [
                { id: "battery",      val: device.battery || "unknown", type: "string" },
                { id: "batteryLevel", val: Number(device.batteryLevel) || 0, type: "number" },
                { id: "type",         val: device.type || "unknown",    type: "string" },
                { id: "batteryAlarm", val: (String(device.battery || "").toLowerCase() === "empty"), type: "boolean" }
            ];

            for (const s of states) {
                const sid = `${channelId}.${s.id}`;
                await this.setObjectNotExistsAsync(sid, {
                    type: "state",
                    common: { name: s.id, type: s.type, read: true, write: true },
                    native: {}
                });
                await this.setStateAsync(sid, { val: s.val, ack: true });
            }
        }

        return true;
    }

    // =========================================================================
    // Körper
    // =========================================================================
    async getBodyRecords() {
        const url = `${BASE_URL}-/body/log/weight/date/${this.getDateTime().dateString}.json`;
        const token = this.fitbit.tokens.access_token;

        try {
            const response = await axios.get(url, {
                headers: { "Authorization": `Bearer ${token}` },
                timeout: axiosTimeout
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
        if (!data || !Array.isArray(data.weight) || data.weight.length === 0) return false;

        this.fitbit.body = data.weight.slice(-1)[0];
        if (this.fitbit.body.weight != null) this.setState("body.weight", this.fitbit.body.weight, true);
        if (this.fitbit.body.fat    != null) this.setState("body.fat",    this.fitbit.body.fat,    true);
        if (this.fitbit.body.bmi    != null) this.setState("body.bmi",    this.fitbit.body.bmi,    true);

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
                headers: { "Authorization": `Bearer ${token}` },
                timeout: axiosTimeout
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
            { id: "food.Water",    val: f.water },
            { id: "food.Calories", val: f.calories },
            { id: "food.Carbs",    val: f.carbs },
            { id: "food.Sodium",   val: f.sodium },
            { id: "food.Fiber",    val: f.fiber },
            { id: "food.Fat",      val: f.fat },
            { id: "food.Protein",  val: f.protein },
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
            // Option: Nap-Liste nachts automatisch leeren (00–04 Uhr)
            if (this.effectiveConfig.clearNapListAtNight) {
                const hour = new Date().getHours();
                if (hour >= 0 && hour < 4) {
                    this.log.info("clearNapListAtNight → Liste wird geleert (nach Mitternacht).");
                    await this._clearNapStates({ onlyList: true });
                }
            }

            const response = await axios.get(url, {
                headers: { "Authorization": `Bearer ${token}` },
                timeout: axiosTimeout
            });

            if (response.status === 200) {
                if (!this.setSleepStates(response.data)) {
                    // keine Schlafdaten → Nap-Liste zurücksetzen
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
async setSleepStates(data) {
        const blocks = data && data.sleep ? data.sleep : [];
        if (blocks.length === 0) return false;

        // --- ⏰ Echtzeitprüfung: Ist es derzeit noch zu früh für Nachtschlaf? ---
        if (this.effectiveConfig.ignoreEarlyMainSleepEnabled && this.effectiveConfig.ignoreEarlyMainSleepTime) {
            try {
                const [h, m] = String(this.effectiveConfig.ignoreEarlyMainSleepTime)
                    .split(":")
                    .map(n => parseInt(n, 10));

                const now = new Date();
                const tooEarlyNow = (now.getHours() < h) || (now.getHours() === h && now.getMinutes() < m);

                if (tooEarlyNow) {
                    if (DEBUG_SLEEP_LOG) {
                        this.log.info(
                            `It’s currently too early (${now.toTimeString().slice(0,5)} < ${this.effectiveConfig.ignoreEarlyMainSleepTime}) → skip nightly sleep analysis.`
                        );
                    }
                    // 💡 Abbruch: Es ist noch zu früh für Nachtschlaf – Fitbit-Daten werden ignoriert
                    return false;
                } else if (DEBUG_SLEEP_LOG) {
                    this.log.debug(
                        `Current time ${now.toTimeString().slice(0,5)} >= ${this.effectiveConfig.ignoreEarlyMainSleepTime} → proceed with sleep analysis.`
                    );
                }
            } catch (err) {
                this.log.warn(`⚠️ Real-time night check failed: ${err.message}`);
            }
        }

        // --- Debug: Ausgabe der gelieferten Schlafblöcke ----------------------
        if (DEBUG_SLEEP_LOG) {
            const countMain = blocks.filter(b => b.isMainSleep).length;
            const countNap  = blocks.filter(b => !b.isMainSleep).length;
            this.log.info(`DEBUG → Fitbit sleep raw blocks: ${blocks.length} (main=${countMain}, nap=${countNap})`);
        }

// ---- Frühschlaf- und SmartSleep-Filter kombiniert (optimiert & fehlerfrei) ----
let filteredBlocks = blocks;

// Frühschlaffilter aktiv → prüfe Startzeit und ggf. Mindestdauer
if (this.effectiveConfig.ignoreEarlyMainSleepEnabled) {
    const [h, m] = String(this.effectiveConfig.ignoreEarlyMainSleepTime)
        .split(":")
        .map(n => parseInt(n, 10));

    if (Number.isInteger(h) && Number.isInteger(m)) {
        filteredBlocks = filteredBlocks.filter(b => {
            if (b && b.isMainSleep && b.startTime) {
                const start = new Date(b.startTime);
                const sh = start.getHours();
                const sm = start.getMinutes();
                const before = (sh < h) || (sh === h && sm < m);

                // Frühschlaf → prüfen ob trotzdem behalten (SmartSleep aktiv)
                if (before) {
                    if (this.effectiveConfig.smartEarlySleepEnabled && b.endTime) {
                        const dur = new Date(b.endTime).getTime() - start.getTime();
                        const minMs = Math.max(0.5, Number(this.effectiveConfig.minMainSleepHours) || 3) * 60 * 60 * 1000;

                        if (dur >= minMs) {
                            if (DEBUG_SLEEP_LOG) {
                                this.log.info(
                                    `Main sleep accepted (starts ${start.toISOString()} < ${this.effectiveConfig.ignoreEarlyMainSleepTime}, duration ${Math.round(dur / 60000)}min ≥ ${Math.round(minMs / 60000)}min)`
                                );
                            }
                            return true; // behalten, weil lang genug
                        }
                    }

                    // Sonst verwerfen
                    if (DEBUG_SLEEP_LOG) {
                        this.log.info(
                            `Main sleep ignored (starts ${start.toISOString()} < ${this.effectiveConfig.ignoreEarlyMainSleepTime})`
                        );
                    }
                    return false;
                }
            }
            return true; // Naps und spätere Sleeps behalten
        });
    }
}

// Nur SmartSleep-Filter aktiv (wenn Uhrzeitfilter deaktiviert ist)
if (this.effectiveConfig.smartEarlySleepEnabled && !this.effectiveConfig.ignoreEarlyMainSleepEnabled) {
    const minMs = Math.max(0.5, Number(this.effectiveConfig.minMainSleepHours) || 3) * 60 * 60 * 1000;
    filteredBlocks = filteredBlocks.filter(b => {
        if (b && b.isMainSleep && b.startTime && b.endTime) {
            const dur = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
            if (dur > 0 && dur < minMs) {
                if (DEBUG_SLEEP_LOG) {
                    this.log.info(
                        `Main sleep ignored (duration ${Math.round(dur / 60000)}min < ${Math.round(minMs / 60000)}min)`
                    );
                }
                return false;
            }
        }
        return true;
    });
}

        // --- Wenn kein Block übrig ist, aber Naps vorhanden wären, trotzdem weitermachen ---
        if (filteredBlocks.length === 0) {
            const naps = blocks.filter(b => !b.isMainSleep);
            if (naps.length > 0) {
                const msg = `Main sleep ignored, but ${naps.length} nap(s) found → using those.`;
                if (DEBUG_SLEEP_LOG) this.log.info(msg);
                filteredBlocks = naps;
            } else {
                if (DEBUG_SLEEP_LOG) {
                    const msg = "All sleep blocks ignored by filters (no naps or main sleep)";
                    this.log.debug(msg);
                }
                return false;
            }
        }

        // Summen
        let totalAsleep = 0;
        let totalInBed  = 0;

        // Naps
        let napsAsleep = 0;
        let napsInBed  = 0;
        let napsCount  = 0;

        // Hauptschlaf (Phasen)
        let mainDeep = 0, mainLight = 0, mainRem = 0, mainWake = 0;

        // Liste für Nickerchen
        const napList = [];

        for (const block of filteredBlocks) {
            totalAsleep += block.minutesAsleep || 0;
            totalInBed  += block.timeInBed     || 0;

            if (block.isMainSleep) {
                const s = (block.levels && block.levels.summary) ? block.levels.summary : {};
                mainDeep  = (s.deep  && s.deep.minutes)  || 0;
                mainLight = (s.light && s.light.minutes) || 0;
                mainRem   = (s.rem   && s.rem.minutes)   || 0;
                mainWake  = (s.wake  && s.wake.minutes)  || 0;

                this.setState("sleep.Deep",  mainDeep,  true);
                this.setState("sleep.Light", mainLight, true);
                this.setState("sleep.Rem",   mainRem,   true);
                this.setState("sleep.Wake",  mainWake,  true);
            } else {
                // Nickerchen sammeln (+ genauere Zeitpunkte aus Level-Segmenten bestimmen)
                const napFell = this.computeFellAsleepAt(block);
                const napWoke = this.computeWokeUpAt(block);

                napsAsleep += block.minutesAsleep || 0;
                napsInBed  += block.timeInBed     || 0;
                napsCount++;

                napList.push({
                    startISO:      napFell ? napFell.toISOString() : "",
                    endISO:        napWoke ? napWoke.toISOString() : "",
                    startDE:       napFell ? this.formatDE_Short(napFell) : "",
                    endDE:         napWoke ? this.formatDE_Short(napWoke) : "",
                    minutesAsleep: block.minutesAsleep || 0,
                    timeInBed:     block.timeInBed     || 0
                });
            }
        }

        // Zusatz-States
        await this.setStateAsync("sleep.AsleepTotal", totalAsleep, true);
        await this.setStateAsync("sleep.InBedTotal",  totalInBed,  true);
        await this.setStateAsync("sleep.Naps.Asleep", napsAsleep,  true);
        await this.setStateAsync("sleep.Naps.InBed",  napsInBed,   true);
        await this.setStateAsync("sleep.Naps.Count",  napsCount,   true);

        // Hauptschlaf-Zeitpunkte
        const mainBlock = filteredBlocks.find(b => b.isMainSleep);
        if (mainBlock) {
            const fell = this.computeFellAsleepAt(mainBlock);
            const woke = this.computeWokeUpAt(mainBlock);

            await this.setStateAsync("sleep.Main.FellAsleepAt",      { val: fell ? fell.toISOString() : "", ack: true });
            await this.setStateAsync("sleep.Main.FellAsleepAtLocal", { val: fell ? this.formatDE_Short(fell) : "", ack: true });

            await this.setStateAsync("sleep.Main.WokeUpAt",          { val: woke ?  woke.toISOString() : "", ack: true });
            await this.setStateAsync("sleep.Main.WokeUpAtLocal",     { val: woke ?  this.formatDE_Short(woke) : "", ack: true });
        } else {
            await this.setStateAsync("sleep.Main.FellAsleepAt",      { val: "", ack: true });
            await this.setStateAsync("sleep.Main.FellAsleepAtLocal", { val: "", ack: true });
            await this.setStateAsync("sleep.Main.WokeUpAt",          { val: "", ack: true });
            await this.setStateAsync("sleep.Main.WokeUpAtLocal",     { val: "", ack: true });
        }

        // Nickerchenliste sortieren
        napList.sort((a, b) => new Date(a.startISO) - new Date(b.startISO));

        // Ausgewähltes Nap in Einzel-States (per Config: erstes/letztes)
        if (napList.length > 0) {
            const napBlock = this.effectiveConfig.showLastOrFirstNap ? napList[napList.length - 1] : napList[0];
            await this.setStateAsync("sleep.Naps.FellAsleepAt",      { val: napBlock.startISO, ack: true });
            await this.setStateAsync("sleep.Naps.FellAsleepAtLocal", { val: napBlock.startDE,  ack: true });
            await this.setStateAsync("sleep.Naps.WokeUpAt",          { val: napBlock.endISO,   ack: true });
            await this.setStateAsync("sleep.Naps.WokeUpAtLocal",     { val: napBlock.endDE,    ack: true });
        } else {
            await this.setStateAsync("sleep.Naps.FellAsleepAt",      { val: "", ack: true });
            await this.setStateAsync("sleep.Naps.FellAsleepAtLocal", { val: "", ack: true });
            await this.setStateAsync("sleep.Naps.WokeUpAt",          { val: "", ack: true });
            await this.setStateAsync("sleep.Naps.WokeUpAtLocal",     { val: "", ack: true });
        }

        // Komplette Nickerchenliste (heute)
        await this.setStateAsync("sleep.Naps.List", { val: JSON.stringify(napList), ack: true });

        this.log.info(
            `Sleep: totalAsleep=${totalAsleep}min, totalInBed=${totalInBed}min, naps=${napsCount}x (${napsAsleep}min)`
        );

        return true;
    }

    // -------------------------------------------------------------------------
    // Segment-Tools für Sleep
    // -------------------------------------------------------------------------
    getLevelSegments(block) {
        const a = (block && block.levels && Array.isArray(block.levels.data)) ? block.levels.data : [];
        const b = (block && block.levels && Array.isArray(block.levels.shortData)) ? block.levels.shortData : [];
        const segs = [...a, ...b].filter(s => s && s.dateTime && s.level);
        segs.sort((x, y) => new Date(x.dateTime) - new Date(y.dateTime));
        return segs;
    }

    computeFellAsleepAt(block) {
        const segs = this.getLevelSegments(block);
        const SLEEP_LEVELS = new Set(["asleep", "light", "deep", "rem"]);
        const first = segs.find(s => SLEEP_LEVELS.has(s.level));
        if (first) return this._parseISO(first.dateTime) || this._parseISO(block && block.startTime);
        return this._parseISO(block && block.startTime);
    }

    computeWokeUpAt(block) {
        const segs = this.getLevelSegments(block);
        const SLEEP_LEVELS = new Set(["asleep", "light", "deep", "rem"]);
        for (let i = segs.length - 1; i >= 0; i--) {
            const s = segs[i];
            if (SLEEP_LEVELS.has(s.level)) {
                const start = this._parseISO(s.dateTime);
                if (start) {
                    if (typeof s.seconds === "number") return this._addSeconds(start, s.seconds);
                    return this._parseISO(block && block.endTime) || start;
                }
            }
        }
        return this._parseISO(block && block.endTime);
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
                headers: { "authorization": `Bearer ${token}` },
                data: payload
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
            const refreshToken = st && st.val ? String(st.val) : (this.fitbit.tokens && this.fitbit.tokens.refresh_token);
            if (!refreshToken) throw new Error("No refresh_token available (state empty). Re-auth required.");

            const cid  = this.effectiveConfig.clientId || "";
            const csec = this.effectiveConfig.clientSecret || "";
            if (!cid || !csec) throw new Error("ClientId/ClientSecret missing in config. Please set them in admin UI.");

            const body = new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: cid
            }).toString();

            const resp = await axios({
                method: "post",
                url: "https://api.fitbit.com/oauth2/token",
                headers: {
                    "Authorization": `Basic ${Buffer.from(`${cid}:${csec}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data: body,
                timeout: axiosTimeout,
                validateStatus: () => true
            });

            if (resp.status !== 200) {
                this.log.error(`Renew Token failed ${resp.status}: ${JSON.stringify(resp.data)}`);
                return false;
            }

            this.fitbit.tokens = resp.data;

            const expireAt = new Date(Date.now() + (this.fitbit.tokens.expires_in || 0) * 1000);
            await this.setStateAsync("tokens.access",  this.fitbit.tokens.access_token,  true);
            await this.setStateAsync("tokens.refresh", this.fitbit.tokens.refresh_token, true);
            await this.setStateAsync("tokens.expire",  expireAt.toISOString(),          true);

            this.log.info(`Token renewed: ${expireAt.toISOString()}`);
            return true;
        } catch (e) {
            const msg = e && e.response && e.response.data ? JSON.stringify(e.response.data) : String(e);
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
        if (!stateExpire || !stateExpire.val) throw new Error("No valid tokens. Please authenticate in configuration.");

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

        const datetime = this.getDateTime(); // nutzt lokale Zeit
        const payload = `weight=${actWeight}&date=${datetime.dateString}&time=${datetime.time}`;

        this.log.info(`Set weight payload: ${payload}`);

        try {
            const response = await axios({
                url,
                method: "post",
                headers: { "Authorization": `Bearer ${token}` },
                timeout: axiosTimeout,
                data: payload
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
            hour12: false
        }).formatToParts(dateObj);

        const val = t => (parts.find(p => p.type === t) || {}).value || "";
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
        datetime.date       = date;
        datetime.time       = `${hh.toString(10).padStart(2, "0")}:${mi.toString(10).padStart(2, "0")}:${ss.toString(10).padStart(2, "0")}`;
        datetime.timeShort  = `${hh.toString(10).padStart(2, "0")}:${mi.toString(10).padStart(2, "0")}`;
        datetime.ts         = date.getTime();
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
        await this.setStateAsync("sleep.Naps.List",              { val: "[]", ack: true });
        if (!opts.onlyList) {
            await this.setStateAsync("sleep.Naps.FellAsleepAt",      { val: "", ack: true });
            await this.setStateAsync("sleep.Naps.FellAsleepAtLocal", { val: "", ack: true });
            await this.setStateAsync("sleep.Naps.WokeUpAt",          { val: "", ack: true });
            await this.setStateAsync("sleep.Naps.WokeUpAtLocal",     { val: "", ack: true });
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

        // Nur auf Benutzer-Schreibvorgänge reagieren
        if (state.ack === false) {
            if (id.includes("body.weight")) {
                this.log.info(`weight changed → ${state.val}`);
                await this.setWeight(state.val);
                await this.setStateAsync("body.weight", { val: state.val, ack: true }); // Bestätigung
                return;
            }
            // (Keine manuellen Token-Buttons o.ä.)
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
