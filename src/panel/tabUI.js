// tabUI.js
// Handles rendering the tab list plus drag-and-drop visuals without interacting with Chrome APIs directly.

const DEFAULT_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' fill='%23E0E0E0'/%3E%3C/svg%3E";

let currentTabs = [];
let containerDropSetup = false;

function createTabRow(tab, handlers) {
  const div = document.createElement("div");
  div.className = "tab" + (tab.active ? " active" : "");
  div.dataset.tabId = String(tab.id);
  div.draggable = true;

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

  div.addEventListener("click", () => {
    handlers?.onActivate?.(tab.id);
  });

  div.addEventListener("dragstart", (event) => {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
      return;
    }
    dataTransfer.setData("text/plain", String(tab.id));
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
    await handlers?.onRowDrop?.(sourceId, tab.index);
  });

  return div;
}

export function renderTabList(tabs, handlers) {
  const container = document.getElementById("tabs");
  container.innerHTML = "";
  currentTabs = tabs;
  container.scrollTop = 0;

  for (const tab of tabs) {
    container.appendChild(createTabRow(tab, handlers));
  }

  if (!containerDropSetup) {
    containerDropSetup = true;
    container.ondragover = (event) => {
      event.preventDefault();
      const dataTransfer = event.dataTransfer;
      if (dataTransfer) {
        dataTransfer.dropEffect = "move";
      }
    };
  }
}

export function registerContainerDrop(handler) {
  const container = document.getElementById("tabs");
  container.ondrop = async (event) => {
    event.preventDefault();
    const sourceId = Number(event.dataTransfer?.getData("text/plain"));
    if (!sourceId) {
      return;
    }
    await handler(sourceId);
  };
}

export function getRenderedTabCount() {
  return currentTabs.length;
}
