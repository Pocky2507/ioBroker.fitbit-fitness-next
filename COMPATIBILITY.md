# Compatibility Report – ioBroker.fitbit-fitness

## ✅ Supported Environments

| Component | Version | Status | Notes |
|:-----------|:---------|:--------|:------|
| **Node.js** | 18.x, 20.x, 22.x, 24.x | ✅ Supported | Tested under Node 22, verified compatible with Node 24 |
| **ioBroker js-controller** | 5.x, 6.x, 7x | ✅ Supported | Fully compatible and API-stable |
| **Operating Systems** | Linux, macOS, Windows | ✅ Supported | No OS-specific dependencies |

---

## 🧠 Technical Notes

- Built entirely with **modern JavaScript (ES2022+)**
- Uses `async/await`, `axios`, and native `fetch` – no deprecated APIs
- No use of `request`, `request-promise`, or internal Node modules
- Time parsing and formatting rely on **ISO 8601 (`YYYY-MM-DDTHH:mm:ss.SSS`)**
- Locale-aware strings (e.g. `toLocaleTimeString('de-DE')`) are used only for logs and safe under Node 24
- No native bindings or low-level C++ dependencies

---

## 🧩 Tested Configurations

| Environment | Result | Details |
|:-------------|:--------|:--------|
| Node.js **22.21.0** + js-controller **7.0.7** | ✅ OK | Running in production (Pocky2507 fork) |
| Node.js **24.0.0** (test build) + js-controller **7.0.7** | ✅ OK | Verified syntax & time handling compatibility |
| Ubuntu **24.04 LTS** | ✅ OK | Stable operation confirmed |
| Windows **11** | ✅ OK | No environment-specific issues |

---

## 🛠 Recommendations

- Prefer `Date.toISOString()` or UTC-based comparisons for time-critical logic  
- Avoid locale-specific `Date.parse()` calls (not used in current version)  
- Keep dependencies (`axios`, `node-fetch`) updated regularly  
- Test with next Node.js LTS after release for continued compatibility  

---

_Last validated: 2025-10-30_  
_Maintainer: **Pocky2507** (<https://github.com/Pocky2507>)_
