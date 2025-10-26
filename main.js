"use strict";

/*
 * Created with @iobroker/create-adapter v2.0.2
 */

const utils = require("@iobroker/adapter-core");
const axios = require("axios").default;
const mSchedule = require("node-schedule");

const axiosTimeout = 15000;

// ▶️ Intraday optional (ohne UI-Schalter)
const DEFAULT_INTRADAY = false;

// ▶️ Welches Nickerchen soll in die Einzel-Datenpunkte geschrieben werden?
// true  = letztes Nap des Tages
// false = erstes Nap des Tages
const SHOW_LAST_OR_FIRST_NAP = true;

// ▶️ Nickerchenliste nachts automatisch leeren
//  (optional und nur falls von FitBit nicht automatisch geleert wird; wirkt beim Abruf in getSleepRecords)
const CLEAR_NAP_LIST_AT_NIGHT = false; // Standard = AUS

// ▶️ Zusätzlicher täglicher Nickerchen-Reset-Schedule (fester Zeitpunkt)
//  Standard AUS, nur wenn ENABLE_CLEAR_NAP_LIST = true
const ENABLE_CLEAR_NAP_LIST = false;           // <- auf true setzen, um den Planer zu aktivieren
const FORCE_CLEAR_NAP_LIST_SCHEDULE = true;    // zusätzlicher Schutzschalter (belassen)
const FORCE_CLEAR_NAP_LIST_TIME = "02:45";     // Uhrzeit HH:MM im 24h-Format

// ▶️ Fitbit APIs
const BASE_URL = "https://api.fitbit.com/1/user/";
const BASE2_URL = "https://api.fitbit.com/1.2/user/";

const HEART_RATE_ZONE_RANGES = ["customHeartRateZones", "heartRateZones"];

class FitBit extends utils.Adapter {
    constructor(options) {
        super({ ...options, name: "fitbit-fitness" });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));

        this.updateInterval = null;
        this.schedule = null;

        this.fitbit = {};
        this.fitbit.sleepRecordsStoredate = null;

        this.FORBIDDEN_CHARS = /[.\[\],]/g;
        this._renewInProgress = false;
    }

    // ================================
    // Adapter start
    // ================================
    async onReady() {
        this.setState("info.connection", false, true);

        if (typeof this.config.intraday === "undefined") {
            this.config.intraday = DEFAULT_INTRADAY;
        }
        this.log.info(`Intraday mode: ${this.config.intraday ? "ENABLED" : "DISABLED"} (DEFAULT=${DEFAULT_INTRADAY})`);
        this.log.info(`Nap display mode: using ${SHOW_LAST_OR_FIRST_NAP ? "LAST" : "FIRST"} nap for nap time states.`);
        this.log.info(`Nightly nap clear (00–04): ${CLEAR_NAP_LIST_AT_NIGHT ? "ENABLED" : "DISABLED"}`);
        this.log.info(`Daily nap reset schedule: ${ENABLE_CLEAR_NAP_LIST ? `ENABLED @ ${FORCE_CLEAR_NAP_LIST_TIME}` : "DISABLED"}`);

        try {
            // Login (holt vorhandene Tokens aus tokens.*; wir legen diese NICHT neu an)
            await this.login();

            if (this.fitbit.status === 200) {
                this.setState("info.connection", true, true);

                // Nur eigene Zusatz-States vorbereiten
                await this.initCustomSleepStates();

                // Schlaf-Scheduling wie im Original (+ optionaler Nap-Reset-Schedule)
                this.initSleepSchedule();

                // Erster Abruf
                await this.getFitbitRecords();

                // Zyklischer Abruf nach Konfig (Minuten)
                this.updateInterval = setInterval(async () => {
                    try {
                        await this.getFitbitRecords();
                    } catch (err) {
                        this.log.error(`Interval fetch failed: ${err}`);
                    }
                }, this.config.refresh * 60 * 1000);
            } else {
                this.setState("info.connection", false, true);
                this.log.warn(`FITBIT login failed with status ${this.fitbit.status}`);
            }
        } catch (error) {
            this.log.error(`Adapter start failed: ${error}`);
        }

        // Schreibbare States abonnieren (User-Action)
        this.subscribeStates("body.weight");
    }

    // ================================
    // Eigene Sleep-States (zusätzlich zum Original)
    // ================================
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

        // Zeitstempel-States (string)
        const timeStates = [
            // Hauptschlaf
            { id: "sleep.Main.FellAsleepAt",      name: "Main sleep - fell asleep at (ISO)" },
            { id: "sleep.Main.FellAsleepAtLocal", name: "Main sleep - fell asleep at (local de-DE)" },
            { id: "sleep.Main.WokeUpAt",          name: "Main sleep - woke up at (ISO)" },
            { id: "sleep.Main.WokeUpAtLocal",     name: "Main sleep - woke up at (local de-DE)" },

            // „ausgewähltes“ Nickerchen (erstes/letztes je nach Konstante)
            { id: "sleep.Naps.FellAsleepAt",      name: "Nap - fell asleep at (ISO)" },
            { id: "sleep.Naps.FellAsleepAtLocal", name: "Nap - fell asleep at (local de-DE)" },
            { id: "sleep.Naps.WokeUpAt",          name: "Nap - woke up at (ISO)" },
            { id: "sleep.Naps.WokeUpAtLocal",     name: "Nap - woke up at (local de-DE)" },

            // Liste aller heutigen Nickerchen (JSON)
            { id: "sleep.Naps.List",              name: "List of today naps as JSON" },
        ];

        for (const s of timeStates) {
            await this.setObjectNotExistsAsync(s.id, {
                type: "state",
                common: { name: s.name, type: "string", role: "text", read: true, write: true },
                native: {},
            });
        }
    }

    // ================================
    // Hauptabruf
    // ================================
    async getFitbitRecords(retry = false) {
        try {
            if (await this.checkToken()) {
                this.log.debug(`Tokens OK/check passed`);
            }

            // Aktivitäten & Herz
            if (this.config.activityrecords) {
                await this.getActivityRecords();
                await this.getHeartRateTimeSeries();
                if (this.config.intraday) {
                    await this.getIntradayHeartRate();
                }
            }

            // Körper
            if (this.config.bodyrecords) {
                await this.getBodyRecords();
            }

            // Food
            if (this.config.foodrecords) {
                await this.getFoodRecords();
            }

            // Schlaf
            if (this.config.sleeprecords) {
                if (this.config.sleeprecordsschedule) {
                    this.log.debug(`Sleep via daily schedule active → skip in interval`);
                } else {
                    await this.getSleepRecords();
                }
            }

            // Geräte
            if (this.config.devicerecords) {
                await this.getDeviceRecords();
            }
        } catch (err) {
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

    // ================================
    // Login (Original-Verhalten)
    // ================================
    async login() {
        try {
            const url = "https://api.fitbit.com/1/user/-/profile.json";

            const accessToken = await this.getStateAsync("tokens.access");
            const refreshToken = await this.getStateAsync("tokens.refresh");

            if (accessToken && refreshToken && accessToken.val && refreshToken.val) {
                this.fitbit.tokens = {
                    access_token: accessToken.val,
                    refresh_token: refreshToken.val
                };
            } else {
                throw new Error("no tokens available. Recreate token in config");
            }

            const response = await axios.get(url, {
                headers: { "Authorization": `Bearer ${this.fitbit.tokens.access_token}` },
                timeout: axiosTimeout
            });

            this.fitbit.status = response.status;

            if (this.fitbit.status === 200) {
                this.setState("info.connection", true, true);
                this.setUserStates(response.data);
                this.log.info(`Login OK for user ${this.fitbit.user?.fullName || "?"}`);
            }
        } catch (err) {
            throw new Error(err);
        }
    }

    setUserStates(data) {
        this.fitbit.user = data.user;
        this.log.info(`User logged in ${this.fitbit.user.fullName} id:${this.fitbit.user.encodedId}`);
        this.setState("user.fullName", this.fitbit.user.fullName, true);
        this.setState("user.userid", this.fitbit.user.encodedId, true);
    }

    // ================================
    // Schlaf-Scheduling (Original + optionaler Reset-Schedule)
    // ================================
    initSleepSchedule() {
        if (this.config.sleeprecords && this.config.sleeprecordsschedule) {
            const rndMinutes = Math.floor(Math.random() * 59);
            const rndHours = 20 + Math.floor(Math.random() * 2);
            this.log.info(`Schedule for sleep activated → daily ${rndHours}:${rndMinutes} (randomized)`);
            this.schedule = mSchedule.scheduleJob(`${rndMinutes} ${rndHours} * * *`, () => {
                if (this.config.sleeprecords) this.getSleepRecords();
            });
        }

        // ► Täglicher, fester Nap-Reset (nur wenn aktiviert)
        if (ENABLE_CLEAR_NAP_LIST && FORCE_CLEAR_NAP_LIST_SCHEDULE) {
            const [h, m] = String(FORCE_CLEAR_NAP_LIST_TIME).split(":");
            const hour = parseInt(h, 10);
            const min  = parseInt(m, 10);
            if (!isNaN(hour) && !isNaN(min)) {
                this.log.info(`Daily nap reset scheduled at ${FORCE_CLEAR_NAP_LIST_TIME}`);
                mSchedule.scheduleJob(`${min} ${hour} * * *`, async () => {
                    this.log.info("Nap reset schedule triggered");
                    try {
                        await this.setStateAsync("sleep.Naps.List",              { val: "[]", ack: true });
                        await this.setStateAsync("sleep.Naps.FellAsleepAt",      { val: "", ack: true });
                        await this.setStateAsync("sleep.Naps.FellAsleepAtLocal", { val: "", ack: true });
                        await this.setStateAsync("sleep.Naps.WokeUpAt",          { val: "", ack: true });
                        await this.setStateAsync("sleep.Naps.WokeUpAtLocal",     { val: "", ack: true });
                        this.log.info("Nap states cleared (scheduled reset)");
                    } catch (e) {
                        this.log.error(`Error clearing naps: ${e}`);
                    }
                });
            } else {
                this.log.warn(`FORCE_CLEAR_NAP_LIST_TIME "${FORCE_CLEAR_NAP_LIST_TIME}" is invalid (expected HH:MM)`);
            }
        }
    }

    // ================================
    // Gewicht (user-writable)
    // ================================
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
                headers: { "Authorization": `Bearer ${token}` },
                timeout: axiosTimeout,
                data: payload
            });
            this.log.info(`setWeight status: ${response.status}`);
        } catch (err) {
            this.log.warn(`setWeight failed: ${err}`);
        }
    }

    // ================================
    // Aktivitäten
    // ================================
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
                    this.log.debug(`No activity records available`);
                } else {
                    this.log.debug(`Activity records updated`);
                }
            }
        } catch (err) {
            this.log.warn(`getActivityRecords: ${err}`);
        }
    }

    setActivityStates(data) {
        if (!data.summary) return false;

        this.fitbit.activities = data;

        this.setState("activity.Steps", data.summary.steps || 0, true);
        this.setState("activity.Floors", data.summary.floors || 0, true);
        this.setState("activity.ActiveMinutes", data.summary.veryActiveMinutes || 0, true);
        this.setState("activity.RestingHeartRate", data.summary.restingHeartRate || 0, true);
        this.setState("activity.Calories", data.summary.caloriesOut || 0, true);
        this.setState("activity.ActivitiesCount", (data.activities && data.activities.length) || 0, true);

        return true;
    }

    // ================================
    // Herzfrequenz (Tages-Overview + Zonen)
    // ================================
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
                    this.log.debug(`No heart rate time series available`);
                } else {
                    this.log.debug(`Heart rate time series updated`);
                }
            }
        } catch (err) {
            this.log.error(`Error in getHeartRateTimeSeries: ${err}`);
        }
    }

    async setHeartRateTimeSeries(data) {
        if (!data["activities-heart"]) return false;

        for (const entry of data["activities-heart"]) {
            const val = entry.value || {};

            for (const zonesKey of Object.keys(val).filter(k => HEART_RATE_ZONE_RANGES.includes(k))) {
                const zonesArr = val[zonesKey] || [];

                for (const zone of zonesArr) {
                    const zoneName = String(zone.name || "Zone").replace(this.FORBIDDEN_CHARS, "_");

                    for (const entryValue of Object.keys(zone).filter(k => k !== "name")) {
                        const entryValueName = entryValue.replace(this.FORBIDDEN_CHARS, "_");
                        const id = `activity.heartratezones.${zoneName}.${entryValueName}`;

                        await this.setObjectNotExistsAsync(id, {
                            type: "state",
                            common: { name: `${entryValue} - ${zoneName}`, type: "number", read: true, write: true },
                            native: {}
                        });
                        await this.setStateAsync(id, { val: zone[entryValue] ?? 0, ack: true });
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

            if (entry.value && typeof entry.value.restingHeartRate === "number") {
                await this.setStateAsync("activity.RestingHeartRate", { val: entry.value.restingHeartRate, ack: true });
            }
        }

        return true;
    }

    // Intraday (optional)
    async getIntradayHeartRate() {
        if (!this.fitbit.user || !this.fitbit.tokens || !this.config.intraday) return;

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

    // ================================
    // Geräte
    // ================================
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
        if (!data) return false;

        await this.setObjectNotExistsAsync("devices", {
            type: "channel",
            common: { name: "FITBIT Devices" },
            native: {}
        });

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
                { id: "batteryLevel", val: device.batteryLevel || 0,    type: "number" },
                { id: "type",         val: device.type || "unknown",    type: "string" },
                { id: "batteryAlarm", val: (device.battery || "").toLowerCase() === "empty", type: "boolean" }
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

    // ================================
    // Körper
    // ================================
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
                    this.log.debug(`No body records available`);
                }
            }
        } catch (err) {
            this.log.warn(`getBodyRecords: ${err}`);
        }
    }

    setBodyStates(data) {
        if (!data.weight || data.weight.length === 0) return false;

        this.fitbit.body = data.weight.slice(-1)[0];
        if (this.fitbit.body.weight != null) this.setState("body.weight", this.fitbit.body.weight, true);
        if (this.fitbit.body.fat    != null) this.setState("body.fat", this.fitbit.body.fat, true);
        if (this.fitbit.body.bmi    != null) this.setState("body.bmi", this.fitbit.body.bmi, true);

        return true;
    }

    // ================================
    // Food
    // ================================
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
                    this.log.debug(`No food records available`);
                }
            }
        } catch (err) {
            this.log.warn(`getFoodRecords: ${err}`);
        }
    }

    setFoodStates(data) {
        if (!data.summary) return false;

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

    // ================================
    // Sleep – Abruf
    // ================================
    async getSleepRecords() {
        const url = `${BASE2_URL}-/sleep/date/${this.getDateTime().dateString}.json`;
        const token = this.fitbit.tokens.access_token;

        try {
            // 🔄 Option: Nickerchenliste nach Mitternacht automatisch leeren
            if (CLEAR_NAP_LIST_AT_NIGHT) {
                const hour = new Date().getHours();
                if (hour >= 0 && hour < 4) {
                    this.log.info("CLEAR_NAP_LIST_AT_NIGHT → Liste wird geleert (nach Mitternacht).");
                    await this.setStateAsync("sleep.Naps.List", { val: "[]", ack: true });
                }
            }

            const response = await axios.get(url, {
                headers: { "Authorization": `Bearer ${token}` },
                timeout: axiosTimeout
            });

            if (response.status === 200) {
                if (!this.setSleepStates(response.data)) {
                    // keine Schlafdaten verfügbar → Tagesreset durchführen (nur Nap-Liste)
                    await this.setStateAsync("sleep.Naps.List", { val: "[]", ack: true });
                    this.log.debug(`No sleep data available`);
                }
            } else {
                this.log.warn(`getSleepRecords unexpected status: ${response.status}`);
            }
        } catch (err) {
            this.log.error(`getSleepRecords failed: ${err}`);
        }
    }

    // ================================
    // Helpers für Sleep-Zeitpunkte
    // ================================
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

    parseISO(d) {
        if (!d) return null;
        const dt = new Date(d);
        return isNaN(dt) ? null : dt;
    }

    addSeconds(d, secs) {
        if (!(d instanceof Date) || isNaN(d)) return null;
        return new Date(d.getTime() + (secs || 0) * 1000);
    }

    getLevelSegments(block) {
        const a = (block && block.levels && Array.isArray(block.levels.data)) ? block.levels.data : [];
        const b = (block && block.levels && Array.isArray(block.levels.shortData)) ? block.levels.shortData : [];
        const segs = [...a, ...b].filter(s => s && s.dateTime && s.level);
        segs.sort((x, y) => new Date(x.dateTime) - new Date(y.dateTime));
        return segs;
    }

    // First sleep segment
    computeFellAsleepAt(block) {
        const segs = this.getLevelSegments(block);
        const SLEEP_LEVELS = new Set(["asleep", "light", "deep", "rem"]);
        const first = segs.find(s => SLEEP_LEVELS.has(s.level));
        if (first) return this.parseISO(first.dateTime);
        return this.parseISO(block && block.startTime);
    }

    // End of last sleep segment
    computeWokeUpAt(block) {
        const segs = this.getLevelSegments(block);
        const SLEEP_LEVELS = new Set(["asleep", "light", "deep", "rem"]);
        for (let i = segs.length - 1; i >= 0; i--) {
            const s = segs[i];
            if (SLEEP_LEVELS.has(s.level)) {
                const start = this.parseISO(s.dateTime);
                if (start) {
                    if (typeof s.seconds === "number") return this.addSeconds(start, s.seconds);
                    return this.parseISO(block && block.endTime) || start;
                }
            }
        }
        return this.parseISO(block && block.endTime);
    }

    // ================================
    // Sleep – Schreiben (mit Nap-Auswahl)
    // ================================
    async setSleepStates(data) {
        const blocks = data && data.sleep ? data.sleep : [];
        if (blocks.length === 0) return false;

        // Summen
        let totalAsleep = 0;
        let totalInBed = 0;

        // Naps
        let napsAsleep = 0;
        let napsInBed = 0;
        let napsCount = 0;

        // Hauptschlaf Phasen
        let mainDeep = 0, mainLight = 0, mainRem = 0, mainWake = 0;

        // Für Nickerchenliste
        const napList = [];

        for (const block of blocks) {
            totalAsleep += block.minutesAsleep || 0;
            totalInBed  += block.timeInBed || 0;

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
                // Nickerchen sammeln
                napsAsleep += block.minutesAsleep || 0;
                napsInBed  += block.timeInBed || 0;
                napsCount++;

                const napFell = this.computeFellAsleepAt(block);
                const napWoke = this.computeWokeUpAt(block);

                napList.push({
                    startISO:  napFell ? napFell.toISOString() : "",
                    endISO:    napWoke ? napWoke.toISOString() : "",
                    startDE:   napFell ? this.formatDE_Short(napFell) : "",
                    endDE:     napWoke ? this.formatDE_Short(napWoke) : "",
                    minutesAsleep: block.minutesAsleep || 0,
                    timeInBed:     block.timeInBed || 0
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
        const mainBlock = blocks.find(b => b.isMainSleep);
        if (mainBlock) {
            const fell = this.computeFellAsleepAt(mainBlock);
            const woke = this.computeWokeUpAt(mainBlock);

            await this.setStateAsync("sleep.Main.FellAsleepAt",      { val: fell ? fell.toISOString() : "", ack: true });
            await this.setStateAsync("sleep.Main.FellAsleepAtLocal", { val: fell ? this.formatDE_Short(fell) : "", ack: true });

            await this.setStateAsync("sleep.Main.WokeUpAt",          { val: woke ? woke.toISOString() : "", ack: true });
            await this.setStateAsync("sleep.Main.WokeUpAtLocal",     { val: woke ? this.formatDE_Short(woke) : "", ack: true });
        } else {
            await this.setStateAsync("sleep.Main.FellAsleepAt",      { val: "", ack: true });
            await this.setStateAsync("sleep.Main.FellAsleepAtLocal", { val: "", ack: true });
            await this.setStateAsync("sleep.Main.WokeUpAt",          { val: "", ack: true });
            await this.setStateAsync("sleep.Main.WokeUpAtLocal",     { val: "", ack: true });
        }

        // 🧩 Sortierung der Nickerchen nach Startzeit
        napList.sort((a, b) => new Date(a.startISO) - new Date(b.startISO));

        // ► Welches Nap in die Einzel-Datenpunkte? (erstes/letztes)
        if (napList.length > 0) {
            const napBlock = SHOW_LAST_OR_FIRST_NAP ? napList[napList.length - 1] : napList[0];
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

    // ================================
    // Token Introspect (optional)
    // ================================
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
            this.log.debug(`Token introspection ok (client_id present)`);
            return true;
        } catch (err) {
            this.log.error(`getTokenInfo failed: ${err}`);
            throw new Error(`${err}`);
        }
    }

    // ================================
    // Renew (verbessert, nutzt UI-Creds)
    // ================================
    async renewToken() {
        if (this._renewInProgress) {
            this.log.debug("renewToken: already in progress");
            return false;
        }
        this._renewInProgress = true;

        try {
            const st = await this.getStateAsync("tokens.refresh");
            const refreshToken = st && st.val ? String(st.val) : (this.fitbit.tokens && this.fitbit.tokens.refresh_token);
            if (!refreshToken) throw new Error("No refresh_token available (state empty). Re-auth required.");

            const cid = this.config.clientId || "";
            const csec = this.config.clientSecret || "";
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
            await this.setStateAsync("tokens.access", this.fitbit.tokens.access_token, true);
            await this.setStateAsync("tokens.refresh", this.fitbit.tokens.refresh_token, true);
            await this.setStateAsync("tokens.expire",  expireAt.toISOString(), true);

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

    // ================================
    // Token-Check (Originalverhalten)
    // ================================
    async checkToken() {
        const stateExpire = await this.getStateAsync("tokens.expire");
        if (!stateExpire || !stateExpire.val) throw new Error("No valid tokens. Please authenticate in configuration.");

        const expireTime = new Date(stateExpire.val.toString()).getTime();
        const now = Date.now();

        // < 1 Stunde → erneuern
        if (expireTime - now < 3600000) {
            return await this.renewToken();
        } else {
            return true;
        }
    }

    // ================================
    // Tools
    // ================================
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

    // ================================
    // Shutdown
    // ================================
    onUnload(callback) {
        try {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            if (this.schedule) {
                this.schedule.cancel();
            }
            callback();
        } catch (e) {
            callback();
        }
    }

    // ================================
    // State changes
    // ================================
    async onStateChange(id, state) {
        if (!state) {
            this.log.info(`state ${id} deleted`);
            return;
        }

        // Nur auf Benutzer-Schreibvorgänge reagieren
        if (state.ack === false) {

            if (id.indexOf("body.weight") !== -1) {
                this.log.info(`weight changed → ${state.val}`);
                await this.setWeight(state.val);
                await this.setStateAsync("body.weight", { val: state.val, ack: true }); // Bestätigung
                return;
            }

            // (Keine manuellen Token-Buttons o.ä. mehr)
        }
    }
}

if (require.main !== module) {
    module.exports = (options) => new FitBit(options);
} else {
    new FitBit();
}
