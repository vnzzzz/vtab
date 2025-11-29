// sidepanel.js
// Renders the list of tabs for the VTab side panel, keeping it in sync with
// the active Chrome window and managing inline reordering.

// Simple gray tile used when tabs do not expose a favicon.
const DEFAULT_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' fill='%23E0E0E0'/%3E%3C/svg%3E";

let currentTabs = [];

async function moveTabToIndex(tabId, targetIndex) {
  try {
    await chrome.tabs.move(tabId, { index: targetIndex });
  } catch (e) {
    console.error("[VTab] Failed to move tab", e);
  }
}

async function getCurrentWindowTabs() {
  // Fetch all tabs belonging to the window that currently owns focus.
  return await chrome.tabs.query({ currentWindow: true });
}

function renderTabs(tabs) {
  const container = document.getElementById("tabs");
  container.innerHTML = "";
  // Remove any stale rows before re-rendering.
  currentTabs = tabs;

  for (const tab of tabs) {
    const div = document.createElement("div");
    div.className = "tab" + (tab.active ? " active" : "");
    div.dataset.tabId = String(tab.id); // store the numeric tab id for the click handler
    div.draggable = true;

    // Build the row content: favicon, title, and click handler.
    const icon = document.createElement("img");
    icon.className = "tab-icon";
    icon.src = tab.favIconUrl || DEFAULT_FAVICON;
    icon.alt = "";
    icon.onerror = () => {
      if (icon.src !== DEFAULT_FAVICON) {
        icon.src = DEFAULT_FAVICON;
      }
    };
    div.appendChild(icon);

    const span = document.createElement("span");
    span.className = "tab-title";
    span.textContent = tab.title || "(no title)";
    div.appendChild(span);

    // Activate the tab when the user clicks the row.
    div.addEventListener("click", async () => {
      const tabId = Number(div.dataset.tabId);
      try {
        await chrome.tabs.update(tabId, { active: true });
      } catch (e) {
        console.error("[VTab] Failed to activate tab", e);
      }
    });

    div.addEventListener("dragstart", (event) => {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) {
        return;
      }
      dataTransfer.setData("text/plain", String(tab.id));
      // Provide visual feedback by hiding the default drag image.
      dataTransfer.setDragImage(div, 0, 0);
      dataTransfer.effectAllowed = "move";
      div.classList.add("dragging");
    });

    div.addEventListener("dragend", () => {
      div.classList.remove("dragging");
    });

    div.addEventListener("dragover", (event) => {
      event.preventDefault();
      const dataTransfer = event.dataTransfer;
      if (dataTransfer) {
        dataTransfer.dropEffect = "move";
      }
      div.classList.add("drop-target");
    });

    div.addEventListener("dragleave", () => {
      div.classList.remove("drop-target");
    });

    div.addEventListener("drop", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      div.classList.remove("drop-target");
      const sourceId = Number(event.dataTransfer?.getData("text/plain"));
      if (!sourceId || sourceId === tab.id) {
        return;
      }
      await moveTabToIndex(sourceId, tab.index);
      refreshTabs().catch(console.error);
    });

    container.appendChild(div);
  }

  container.ondragover = (event) => {
    event.preventDefault();
    const dataTransfer = event.dataTransfer;
    if (dataTransfer) {
      dataTransfer.dropEffect = "move";
    }
  };

  container.ondrop = async (event) => {
    event.preventDefault();
    const sourceId = Number(event.dataTransfer?.getData("text/plain"));
    if (!sourceId) {
      return;
    }
    const lastIndex = currentTabs.length - 1;
    await moveTabToIndex(sourceId, lastIndex);
    refreshTabs().catch(console.error);
  };
}

// Pull the latest tab list and redraw the UI.
async function refreshTabs() {
  const tabs = await getCurrentWindowTabs();
  renderTabs(tabs);
}

// Initial render when the side panel loads.
refreshTabs().catch(console.error);

// Keep the view synchronized with chrome.tabs lifecycle events.
chrome.tabs.onActivated.addListener(() => {
  refreshTabs().catch(console.error);
});

chrome.tabs.onCreated.addListener(() => {
  refreshTabs().catch(console.error);
});

chrome.tabs.onRemoved.addListener(() => {
  refreshTabs().catch(console.error);
});

chrome.tabs.onUpdated.addListener(() => {
  refreshTabs().catch(console.error);
});
