// tabService.js
// Encapsulates Chrome tab queries/mutations so the panel UI code can remain focused on rendering.

export async function getCurrentWindowTabs() {
  return await chrome.tabs.query({ currentWindow: true });
}

export async function moveTabToIndex(tabId, targetIndex) {
  try {
    await chrome.tabs.move(tabId, { index: targetIndex });
  } catch (error) {
    console.error("[VTab] Failed to move tab", error);
  }
}

const tabEvents = [
  chrome.tabs.onActivated,
  chrome.tabs.onCreated,
  chrome.tabs.onRemoved,
  chrome.tabs.onUpdated,
];

export function subscribeToTabEvents(callback) {
  for (const event of tabEvents) {
    event.addListener(callback);
  }
}
