# Wayback Archive Viewer

A fast, modern Chrome extension for quickly viewing archived versions of any webpage using the Internet Archive Wayback Machine.

## 🎯 Core Functionality

-   **1-Click Latest Snapshot**: Open the most recent archived version instantly.
-   **Archive Timeline**: Quick access to the full Wayback Machine calendar for any URL.
-   **Manual Archiving**: Send a request to the Wayback Machine to archive the current page.
-   **Context Menu Integration**: Right-click on any page or link to open it in the archive.
-   **Keyboard Shortcut**: Press `Ctrl+Shift+A` (Mac: `Cmd+Shift+A`) to trigger your default archive action.
-   **Smart Fallbacks**: If no snapshot is found, get a friendly notification with options to search or archive.

## ⚙️ Settings & Preferences

-   **Default Action**: Choose between opening the latest snapshot or the archive timeline directly.
-   **Auto-Open**: Enable/disable automatic redirection for even faster access.
-   **Appearance**: System-aware dark/light mode with a manual theme override.
-   **Badge Notifications**: A green checkmark badge appears on the extension icon when an archive is available for the active tab.

## 🧠 Performance & Architecture

-   **Dual-API Strategy**: Uses the Wayback CDX API as primary (more reliable) with the Availability API as fallback.
-   **Local Caching**: 5-minute in-memory TTL cache for lookups to minimize redundant network requests.
-   **Fetch Timeouts**: 10-second timeout handling with `AbortController` ensures the UI remains responsive even when the archive service is degraded.
-   **Minimal Permissions**: Uses Manifest V3 and requests only necessary `host_permissions` for `archive.org`.

## 🛠️ Installation

1.  Clone this repository or download the source code.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** in the top-right corner.
4.  Click **Load unpacked** and select the extension directory.

## 📦 Tech Stack

-   **Manifest V3**
-   **Vanilla JavaScript (ES Modules)**
-   **Vanilla CSS**
-   **Wayback Machine CDX & Availability APIs**

---

Built with ❤️ by [dev4488](https://github.com/dev4488)
