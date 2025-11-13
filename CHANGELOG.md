# 📜 Changelog

<--
    ## **WORK IN PROGRESS**
-->

## **1.0.3 (2025-11-13)**
- Smart pre-filter for movie nights, reading, TV
- Uses HR drop (before/after sleep) to detect real sleep
- Requires HR drop ≥ 2 BPM + stable phase (default 20 min)
- Respects ignoreEarlyMainSleep cutoff
- Sets HRDropAtSleep, HRBeforeSleep, HRAfterSleep states
- Fully backward compatible – no breaking changes
- Shift work supported
- No false positives from evening relaxation

## **1.0.2 (2025-11-12)**
- Optional: Naps are checked for duration and heart-rate activity to exclude false naps (like resting or reading)

## **1.0.1 (2025-11-10)**
- Added configurable late wake correction (optional time buffer for too-early wake detection)

## **1.0.0 (2025-11-08)**
- Code completely cleaned up, sorted and re-nested.
- Further fine-tuning of the sleep logic.
- Ready for final version to 1.0.0

----------------------------------

## **0.5.7 (2025-11-05)**
- Fine-tuning the "Couchtimes"

## **0.5.6 (2025-10-30)**
- Added a new setting for sleep stability (minutes)
- Default value: 20 minutes
- Debug output now only appears once at adapter startup
- Improved display in the Debug tab
- Optimizations to the configuration and internal logic

## 0.5.5 (2025-10-28)
- Added **combined real-time EarlySleep & SmartSleep filter**
  → Combines current time check with sleep duration logic
- Long main-sleep blocks before cutoff are now accepted
- Improved debug output and sleep logic stability
- Added **total sleep and nap summary datapoints**
- Enhanced overall performance and logic

## 0.5.4 (2025-10-27)
- Added **Debug & Advanced Options** tab
- Added SmartSleep detection with configurable minimum duration (e.g. 3 h)
- Improved main-sleep filtering
- UI and translation improvements

## 0.5.3 (2025-10-26)
- Added configurable EarlySleep filter (ignore sleep before defined cutoff)
- Improved sleep logic and nap separation

## 0.5.2 (2025-10-25)
- Added nap management and intraday mode
- Improved stability in sleep and activity retrieval

## 0.5.1 (2025-10-24)
- Maintenance and cleanup update
  
## 0.5.0 (2023-11-18)
- Maintenance issues

## 0.4.14 (2023-11-18)
- Fixed some minor bugs

## 0.4.13 (2023-10-31)
- make heartrate time series working

## 0.4.12 (2023-10-03)
- changed node dependencies to node 16

## 0.4.11 (2023-09-26)
- Catch unpresent activity data

## 0.4.10 (2023-02-17)
- fixed web page for token

## 0.4.9 (2023-02-14)
- Changed Repo name

## 0.4.8 (2022-10-09)
- added lowBatteryAlarm
- fixed body records undefined

## 0.4.7 (2022-09-20)
- Added Devices request and battery status

## 0.4.6 (2022-08-01)
- Changed the schedule variance also to 2 hours

## 0.4.5 (2022-06-16)
 - bumping version 0.4.5

## 0.4.4 (2022-06-16)
- fixed minor issues with versions and testing

## 0.4.3 (2022-06-14)
- fixed lower case iobroker
- moved axios to normal dependency
- changed node.schedule to random schedule with an hour
- prepared for syncing history data will come in the next versions server request to fitbit is pending.

## 0.4.0 (2022-06-09)
- fixed lower case iobroker
- moved axios to normal dependency
- changed node.schedule to random schedule with an hour
- prepared for syncing history data will come in the next versions

## 0.3.10 (2022-04-16)
- added Resting Heartrate

## 0.3.9 (2022-04-16)
- added ActiveMinutes
- added Floors (activities)

## 0.3.8 (2022-04-09)
- corrected the auth method of the redirection

## 0.3.7 (2022-03-24)
- changed the auth method. Tested also with Chrome

## 0.3.1 (2022-03-24)
- changed the auth method. resolved the bug with iframe. Now also chrome is working

## 0.3.0 (2022-03-22)
- changed logging -> debug for detailed logging
- bug fixes

## 0.2.5 (2022-02-20)
- add possibility to read sleep records only in the morning and evening to reduce traffic

## 0.2.4 (2022-02-17)
- changed the auth method (ported from @GermanBluefox fitbit-api)
- added a debug option to reduce the logs
- some minor changes

## 0.2.3 (2022-02-15)
- added Food: Carbs, Fiber, Sodium
- fixed Water recording

## 0.2.2 (2022-02-14)
- Bug fixes

## 0.2.1 (2022-02-14)
- Minor fixes

## 0.2.0 (2022-02-14)
- renamed repo to fitbit-fitness

## 0.1.3 (2022-02-07)
- Add: Loggings adapted
- Fix: Changes Refresh Time to minutes

## 0.1.2 (2022-02-03)
- added Activity Records
- Fixed refresh rate

## 0.1.1 (2022-02-02)
- Minor Fixes

## 0.1.0 (2022-01-30)
- Initial version
- ported parts from project @GermanBluefox fitbit-api [GermanBluefox](https://github.com/GermanBluefox)
- [ iobroker-community-adapters/iobroker.fitbit-fitness-api ](https://github.com/iobroker-community-adapters/iobroker.fitbit-fitness-api)
- adapted and enhanced
- used the new createadapter script to follow the latest adapter standard
- reduced parallel reading since the web page blocks after some time
- included food and sleep records to be retrieved
