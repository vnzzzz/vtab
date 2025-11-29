// index.js
// Entry point that wires the UI to Chrome tab APIs via dedicated helper modules.

import {
  getCurrentWindowTabs,
  moveTabToIndex,
  subscribeToTabEvents,
} from "./tabService.js";
import { initializeGroupStore } from "./groupStore.js";
import { renderTabList } from "./tabUI.js";

async function activateTab(tabId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
  } catch (error) {
    console.error("[VTab] Failed to activate tab", error);
  }
}

async function handleTabReorder(sourceId, targetIndex) {
  await moveTabToIndex(sourceId, targetIndex);
  await refreshTabs();
}

async function refreshTabs() {
  const tabs = await getCurrentWindowTabs();
  renderTabList(tabs, {
    onActivate: activateTab,
    onTabReorder: handleTabReorder,
    onGroupLayoutChange: handleGroupLayoutChange,
  });
}

async function handleGroupLayoutChange(layout) {
  await reorderChromeTabs(layout);
}

async function reorderChromeTabs(layout) {
  let cursor = 0;
  for (const group of layout) {
    for (const tabId of group.tabIds) {
      await moveTabToIndex(tabId, cursor);
      cursor += 1;
    }
  }
  await refreshTabs();
}

async function start() {
  await initializeGroupStore();
  await refreshTabs();
  subscribeToTabEvents(() => {
    refreshTabs().catch(console.error);
  });
}

start().catch((error) => {
  console.error("[VTab] Failed to initialize panel", error);
});
