# VTab – Vertical Tabs Side Panel

Tab list for the Chrome side panel. Displays the current window’s tabs vertically and lets you switch with a single click.

## Highlights

- Emphasizes the active tab while keeping a concise vertical list of all open tabs
- Shows `(no title)` when a tab title is unavailable to clarify state
- Shows each tab’s favicon for quicker visual identification
- Keeps the list fresh by listening to `chrome.tabs` creation, update, removal, and activation events
- Applies `setPanelBehavior` in `background.js` so the side panel opens automatically when the extension icon is clicked

## Development

1. Launch Chrome in developer mode and load `src/manifest.json` as an unpacked extension
2. `src/sidepanel.html` + `src/sidepanel.js` render the tab list
3. Reload the extension or Chrome after source changes to see updates

## Packaging

Run `scripts/package.sh` to copy `src` into `dist` and emit `vtab.zip` for Chrome Web Store submission or redistribution.
