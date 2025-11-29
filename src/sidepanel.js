// sidepanel.js
// Entry point that wires the UI to Chrome tab APIs via dedicated helper modules.

import {
  getCurrentWindowTabs,
  moveTabToIndex,
  subscribeToTabEvents,
} from "./panel/tabService.js";
import {
  renderTabList,
  registerContainerDrop,
  getRenderedTabCount,
} from "./panel/tabUI.js";

async function activateTab(tabId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
  } catch (error) {
    console.error("[VTab] Failed to activate tab", error);
  }
}

async function handleRowDrop(sourceId, targetIndex) {
  await moveTabToIndex(sourceId, targetIndex);
  await refreshTabs();
}

async function handleContainerDrop(sourceId) {
  const lastIndex = Math.max(getRenderedTabCount() - 1, 0);
  await moveTabToIndex(sourceId, lastIndex);
  await refreshTabs();
}

async function refreshTabs() {
  const tabs = await getCurrentWindowTabs();
  renderTabList(tabs, {
    onActivate: activateTab,
    onRowDrop: handleRowDrop,
  });
}

refreshTabs().catch(console.error);

registerContainerDrop(handleContainerDrop);

subscribeToTabEvents(() => {
  refreshTabs().catch(console.error);
});
