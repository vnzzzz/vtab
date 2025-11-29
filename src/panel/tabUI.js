// tabUI.js
// Renders grouped tabs, handles drag-and-drop interactions, and surfaces a right-click
// context menu for associating tabs with groups.

import { createContextMenu } from "./contextMenu.js";
import {
  buildGroupLayout,
  createGroup,
  findGroupContaining,
  getGroups,
  isTabGrouped,
  moveGroupBefore,
  moveGroupToIndex,
  moveTabToGroup,
  moveTabToUngrouped,
  renameGroup,
  syncGroupsWithTabs,
} from "./groupStore.js";

const DEFAULT_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' fill='%23E0E0E0'/%3E%3C/svg%3E";

const DRAG_TYPE_TAB = "tab";
const DRAG_TYPE_GROUP = "group";

let currentTabs = [];
let currentHandlers = null;
let isGroupDragging = false;
let contextMenu = null;

function ensureContextMenu() {
  if (contextMenu) {
    return contextMenu;
  }
  contextMenu = createContextMenu({
    getGroups,
    onAssignToGroup(tabId, groupId) {
      moveTabToGroup(tabId, groupId);
      rerenderAndNotify();
    },
    onCreateGroup(name) {
      return createGroup(name);
    },
  });
  return contextMenu;
}

function beginGroupDrag() {
  if (isGroupDragging) {
    return;
  }
  isGroupDragging = true;
  document.body.classList.add("is-group-dragging");
}

function endGroupDrag() {
  if (!isGroupDragging) {
    return;
  }
  isGroupDragging = false;
  document.body.classList.remove("is-group-dragging");
  document
    .querySelectorAll(".group-drop-zone.active")
    .forEach((el) => el.classList.remove("active"));
}

function getDragType(event) {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    return null;
  }
  if (dataTransfer.types?.includes("type")) {
    const value = dataTransfer.getData("type");
    if (value) {
      return value;
    }
  }
  if (dataTransfer.types?.includes(DRAG_TYPE_GROUP)) {
    return DRAG_TYPE_GROUP;
  }
  if (dataTransfer.types?.includes(DRAG_TYPE_TAB)) {
    return DRAG_TYPE_TAB;
  }
  return dataTransfer.getData("type") || null;
}

function isTabDrag(event) {
  return getDragType(event) === DRAG_TYPE_TAB;
}

function isGroupDrag(event) {
  return isGroupDragging || getDragType(event) === DRAG_TYPE_GROUP;
}

function rerender() {
  if (!currentHandlers) {
    return;
  }
  renderTabList(currentTabs, currentHandlers);
}

function notifyLayoutChange() {
  currentHandlers?.onGroupLayoutChange?.(buildGroupLayout(currentTabs));
}

function rerenderAndNotify() {
  rerender();
  notifyLayoutChange();
}

function createTabRow(tab) {
  const div = document.createElement("div");
  div.className = "tab" + (tab.active ? " active" : "");
  div.dataset.tabId = String(tab.id);
  div.draggable = true;
  div.dataset.dragType = DRAG_TYPE_TAB;

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
    currentHandlers?.onActivate?.(tab.id);
  });

  div.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    ensureContextMenu().show(tab.id, event.clientX, event.clientY);
  });

  div.addEventListener("dragstart", (event) => {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
      return;
    }
    dataTransfer.setData("type", DRAG_TYPE_TAB);
    dataTransfer.setData(DRAG_TYPE_TAB, String(tab.id));
    dataTransfer.setDragImage(div, 0, 0);
    dataTransfer.effectAllowed = "move";
    div.classList.add("dragging");
  });

  div.addEventListener("dragend", () => {
    div.classList.remove("dragging");
  });

  div.addEventListener("dragover", (event) => {
    if (!isTabDrag(event)) {
      return;
    }
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
    if (!isTabDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    div.classList.remove("drop-target");
    const type = event.dataTransfer?.getData("type");
    if (type !== DRAG_TYPE_TAB) {
      return;
    }
    const sourceId = Number(event.dataTransfer?.getData(DRAG_TYPE_TAB));
    if (!sourceId || sourceId === tab.id) {
      return;
    }
    const sourceGroup = findGroupContaining(sourceId);
    const targetGroup = findGroupContaining(tab.id);
    if (sourceGroup?.id !== targetGroup?.id) {
      if (targetGroup) {
        moveTabToGroup(sourceId, targetGroup.id);
      } else {
        moveTabToUngrouped(sourceId);
      }
      rerenderAndNotify();
      return;
    }
    await currentHandlers?.onTabReorder?.(sourceId, tab.index);
  });

  return div;
}

function renderUngroupedTabs(container) {
  const fragment = document.createDocumentFragment();
  for (const tab of currentTabs) {
    if (!isTabGrouped(tab.id)) {
      fragment.appendChild(createTabRow(tab));
    }
  }
  if (!fragment.childNodes.length) {
    return;
  }
  const wrapper = document.createElement("div");
  wrapper.className = "ungrouped-tabs";
  const header = document.createElement("div");
  header.className = "ungrouped-header";
  header.textContent = "Ungrouped";
  wrapper.appendChild(header);
  wrapper.appendChild(fragment);
  container.appendChild(wrapper);
}

function createGroupSection(group) {
  const section = document.createElement("div");
  section.className = "tab-group";
  section.dataset.groupId = group.id;

  const header = document.createElement("div");
  header.className = "tab-group-header";

  function bindGroupDragSource(element) {
    element.setAttribute("draggable", "true");
    element.dataset.dragType = DRAG_TYPE_GROUP;
    element.dataset.groupId = group.id;
    element.addEventListener("dragstart", (event) => {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) {
        return;
      }
      dataTransfer.setData("type", DRAG_TYPE_GROUP);
      dataTransfer.setData(DRAG_TYPE_GROUP, group.id);
      dataTransfer.setData("text/plain", group.id);
      dataTransfer.setData("text", group.id);
      dataTransfer.effectAllowed = "move";
      dataTransfer.dropEffect = "move";
      if (typeof dataTransfer.setDragImage === "function") {
        const rect = element.getBoundingClientRect();
        dataTransfer.setDragImage(
          element,
          rect.width / 2,
          rect.height / 2
        );
      }
      header.classList.add("header-dragging");
      beginGroupDrag();
    });
    element.addEventListener("dragend", () => {
      header.classList.remove("header-dragging");
      endGroupDrag();
    });
    element.addEventListener("mousedown", () => {
      // Show drop zones immediately so the user gets feedback before moving.
      beginGroupDrag();
    });
    element.addEventListener("mouseup", () => {
      if (isGroupDragging) {
        endGroupDrag();
      }
    });
  }

  const titleSpan = document.createElement("span");
  titleSpan.className = "group-title";
  titleSpan.textContent = group.title;
  header.appendChild(titleSpan);

  bindGroupDragSource(header);

  header.addEventListener("dragover", (event) => {
    const type = getDragType(event);
    if (type !== DRAG_TYPE_TAB && !isGroupDragging && type !== DRAG_TYPE_GROUP) {
      return;
    }
    event.preventDefault();
    if (!isGroupDragging && type === DRAG_TYPE_GROUP) {
      beginGroupDrag();
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    header.classList.add("header-drop-target");
  });

  header.addEventListener("dragleave", () => {
    header.classList.remove("header-drop-target");
  });

  header.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    header.classList.remove("header-drop-target");
    const type = event.dataTransfer?.getData("type");
    if (type === DRAG_TYPE_TAB) {
      const tabId = Number(event.dataTransfer?.getData(DRAG_TYPE_TAB));
      if (tabId) {
        moveTabToGroup(tabId, group.id);
        rerenderAndNotify();
      }
    } else if (type === DRAG_TYPE_GROUP) {
      const sourceGroupId = event.dataTransfer?.getData(DRAG_TYPE_GROUP);
      if (sourceGroupId) {
        moveGroupBefore(sourceGroupId, group.id);
        rerenderAndNotify();
      }
    }
    endGroupDrag();
  });

  const renameInput = document.createElement("input");
  renameInput.className = "group-rename-input";
  renameInput.type = "text";
  renameInput.value = group.title;
  renameInput.autocomplete = "off";
  renameInput.spellcheck = false;
  renameInput.style.display = "none";

  const renameButton = document.createElement("button");
  renameButton.type = "button";
  renameButton.className = "group-rename";
  renameButton.title = "Rename group";
  renameButton.textContent = "✎";
  renameButton.addEventListener("click", (event) => {
    event.stopPropagation();
    startInlineRename();
  });

  function startInlineRename() {
    header.classList.add("is-editing");
    titleSpan.style.display = "none";
    renameButton.style.display = "none";
    renameInput.value = group.title;
    renameInput.style.display = "inline-flex";
    renameInput.focus();
    renameInput.select();
  }

  function commitRename() {
    const value = renameInput.value.trim();
    if (value) {
      renameGroup(group.id, value);
    }
    endInlineRename();
  }

  function cancelRename() {
    endInlineRename();
  }

  function endInlineRename() {
    renameInput.style.display = "none";
    titleSpan.style.display = "";
    renameButton.style.display = "";
    titleSpan.textContent = group.title;
    header.classList.remove("is-editing");
    notifyLayoutChange();
  }

  renameInput.addEventListener("blur", commitRename);
  renameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      commitRename();
    } else if (event.key === "Escape") {
      cancelRename();
    }
  });

  header.appendChild(renameInput);
  header.appendChild(renameButton);

  section.appendChild(header);

  const body = document.createElement("div");
  body.className = "tab-group-body";
  body.addEventListener("dragover", (event) => {
    if (!isTabDrag(event)) {
      return;
    }
    event.preventDefault();
    body.classList.add("group-drop-target");
  });

  body.addEventListener("dragleave", () => {
    body.classList.remove("group-drop-target");
  });

  body.addEventListener("drop", (event) => {
    if (!isTabDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    body.classList.remove("group-drop-target");
    const type = event.dataTransfer?.getData("type");
    if (type !== DRAG_TYPE_TAB) {
      return;
    }
    const tabId = Number(event.dataTransfer?.getData(DRAG_TYPE_TAB));
    if (tabId) {
      moveTabToGroup(tabId, group.id);
      rerenderAndNotify();
    }
  });

  const fragment = document.createDocumentFragment();
  for (const tab of currentTabs) {
    if (group.tabIds.has(tab.id)) {
      fragment.appendChild(createTabRow(tab));
    }
  }
  body.appendChild(fragment);

  section.appendChild(body);
  return section;
}

function createGroupDropZone(targetIndex) {
  const zone = document.createElement("div");
  zone.className = "group-drop-zone";
  zone.dataset.targetIndex = String(targetIndex);

  const handleDragOver = (event) => {
    if (!isGroupDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!isGroupDragging) {
      beginGroupDrag();
    }
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    zone.classList.add("active");
  };

  zone.addEventListener("dragenter", handleDragOver);
  zone.addEventListener("dragover", handleDragOver);
  zone.addEventListener("dragleave", () => {
    zone.classList.remove("active");
  });
  zone.addEventListener("drop", (event) => {
    if (!isGroupDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    zone.classList.remove("active");
    const sourceGroupId = event.dataTransfer?.getData(DRAG_TYPE_GROUP);
    const target = Number(zone.dataset.targetIndex);
    if (!sourceGroupId || Number.isNaN(target)) {
      endGroupDrag();
      return;
    }
    moveGroupToIndex(sourceGroupId, target);
    rerenderAndNotify();
    endGroupDrag();
  });

  return zone;
}

function setupContainerDrop(container) {
  container.ondragover = (event) => {
    if (!isTabDrag(event)) {
      if (isGroupDragging) {
        event.preventDefault();
      }
      return;
    }
    event.preventDefault();
  };
  container.ondrop = (event) => {
    if (!isTabDrag(event)) {
      return;
    }
    event.preventDefault();
    const type = event.dataTransfer?.getData("type");
    if (type !== DRAG_TYPE_TAB) {
      return;
    }
    const tabId = Number(event.dataTransfer?.getData(DRAG_TYPE_TAB));
    if (!tabId) {
      return;
    }
    moveTabToUngrouped(tabId);
    rerenderAndNotify();
  };
}

export function renderTabList(tabs, handlers) {
  currentTabs = tabs;
  currentHandlers = handlers;
  syncGroupsWithTabs(tabs);

  const container = document.getElementById("tabs");
  container.innerHTML = "";
  renderUngroupedTabs(container);

  const groups = getGroups();
  if (groups.length) {
    container.appendChild(createGroupDropZone(0));
    groups.forEach((group, index) => {
      container.appendChild(createGroupSection(group));
      container.appendChild(createGroupDropZone(index + 1));
    });
  }

  setupContainerDrop(container);
  ensureContextMenu();
}
