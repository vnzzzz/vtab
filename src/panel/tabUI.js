// tabUI.js
// Renders grouped tabs, handles drag-and-drop interactions, and surfaces a right-click
// context menu for associating tabs with groups.

const DEFAULT_FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='16' height='16' fill='%23E0E0E0'/%3E%3C/svg%3E";

const groups = [];
let groupCounter = 1;
let currentTabs = [];
let currentHandlers = null;
let isGroupDragging = false;

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
  if (dataTransfer.types?.includes("group")) {
    return "group";
  }
  if (dataTransfer.types?.includes("tab")) {
    return "tab";
  }
  return dataTransfer.getData("type") || null;
}

function isTabDrag(event) {
  return getDragType(event) === "tab";
}

function isGroupDrag(event) {
  return isGroupDragging || getDragType(event) === "group";
}

const contextMenu = document.createElement("div");
contextMenu.className = "group-context-menu";
contextMenu.innerHTML = `
  <div class="menu-title">Assign to group</div>
  <div class="menu-items"></div>
  <div class="menu-divider"></div>
  <div class="menu-new">
    <input type="text" placeholder="New group name" autocomplete="off" spellcheck="false" />
    <button type="button">Create</button>
  </div>
`;
document.body.appendChild(contextMenu);
contextMenu.addEventListener("click", (event) => event.stopPropagation());
const menuItems = contextMenu.querySelector(".menu-items");
const newGroupInput = contextMenu.querySelector(".menu-new input");
const newGroupButton = contextMenu.querySelector(".menu-new button");
let contextMenuTabId = null;
let contextMenuListenersBound = false;

function ensureContextMenuListeners() {
  if (contextMenuListenersBound) {
    return;
  }
  contextMenuListenersBound = true;
  document.addEventListener("click", (event) => {
    if (!contextMenu.contains(event.target)) {
      hideContextMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideContextMenu();
    }
  });
  newGroupButton.addEventListener("click", () => {
    createGroupFromContextMenu();
  });
  newGroupInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      createGroupFromContextMenu();
    }
  });
}

function showContextMenu(tabId, x, y) {
  contextMenuTabId = tabId;
  menuItems.innerHTML = "";
  if (groups.length === 0) {
    const empty = document.createElement("div");
    empty.className = "menu-empty";
    empty.textContent = "No groups yet";
    menuItems.appendChild(empty);
  } else {
    for (const group of groups) {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "menu-item";
      option.textContent = group.title;
      option.addEventListener("click", () => {
        moveTabToGroup(contextMenuTabId, group.id);
        rerenderAndNotify();
        hideContextMenu();
      });
      menuItems.appendChild(option);
    }
  }

  const padding = 8;
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.add("visible");
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth - padding) {
    contextMenu.style.left = `${window.innerWidth - rect.width - padding}px`;
  }
  if (rect.bottom > window.innerHeight - padding) {
    contextMenu.style.top = `${window.innerHeight - rect.height - padding}px`;
  }
  newGroupInput.value = "";
  newGroupInput.focus();
}

function hideContextMenu() {
  contextMenu.classList.remove("visible");
  contextMenuTabId = null;
}

function createGroupFromContextMenu() {
  if (!contextMenuTabId) {
    return;
  }
  const name = newGroupInput.value.trim();
  const group = createGroup(name || `Group ${groupCounter}`);
  moveTabToGroup(contextMenuTabId, group.id);
  rerenderAndNotify();
  hideContextMenu();
}

function getGroupLayout() {
  const layout = [
    {
      id: null,
      title: null,
      tabIds: currentTabs
        .filter((tab) => !isTabGrouped(tab.id))
        .map((tab) => tab.id),
      isUngrouped: true,
    },
  ];
  for (const group of groups) {
    layout.push({
      id: group.id,
      title: group.title,
      tabIds: [...group.tabIds],
      isUngrouped: false,
    });
  }
  return layout;
}

function rerender() {
  if (!currentHandlers) {
    return;
  }
  renderTabList(currentTabs, currentHandlers);
}

function notifyLayoutChange() {
  currentHandlers?.onGroupLayoutChange?.(getGroupLayout());
}

function rerenderAndNotify() {
  rerender();
  notifyLayoutChange();
}

function syncGroupsWithTabs(tabs) {
  const validIds = new Set(tabs.map((tab) => tab.id));
  for (const group of groups) {
    group.tabIds = new Set([...group.tabIds].filter((id) => validIds.has(id)));
  }
}

function findGroupById(id) {
  return groups.find((group) => group.id === id);
}

function findGroupContaining(tabId) {
  return groups.find((group) => group.tabIds.has(tabId));
}

function isTabGrouped(tabId) {
  return !!findGroupContaining(tabId);
}

function createGroup(name) {
  const id = `group-${Date.now()}-${groupCounter}`;
  const group = {
    id,
    title: name || `Group ${groupCounter}`,
    tabIds: new Set(),
  };
  groupCounter += 1;
  groups.push(group);
  return group;
}

function moveTabToGroup(tabId, groupId) {
  const current = findGroupContaining(tabId);
  if (current?.id === groupId) {
    return;
  }
  if (current) {
    current.tabIds.delete(tabId);
  }
  const target = findGroupById(groupId);
  if (target) {
    target.tabIds.add(tabId);
  }
}

function moveTabToUngrouped(tabId) {
  const current = findGroupContaining(tabId);
  if (current) {
    current.tabIds.delete(tabId);
  }
}

function rerenderGroupOrder() {
  rerenderAndNotify();
}

function moveGroupToIndex(groupId, targetIndex) {
  const currentIndex = groups.findIndex((group) => group.id === groupId);
  if (currentIndex === -1) {
    return;
  }
  const [group] = groups.splice(currentIndex, 1);
  let destination = targetIndex;
  if (currentIndex < destination) {
    destination -= 1;
  }
  destination = Math.max(0, Math.min(destination, groups.length));
  groups.splice(destination, 0, group);
}

function moveGroupBefore(groupId, targetGroupId) {
  const targetIndex = groups.findIndex((group) => group.id === targetGroupId);
  if (targetIndex === -1) {
    return;
  }
  moveGroupToIndex(groupId, targetIndex);
}

function createTabRow(tab) {
  const div = document.createElement("div");
  div.className = "tab" + (tab.active ? " active" : "");
  div.dataset.tabId = String(tab.id);
  div.draggable = true;
  div.dataset.dragType = "tab";

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
    showContextMenu(tab.id, event.clientX, event.clientY);
  });

  div.addEventListener("dragstart", (event) => {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer) {
      return;
    }
    dataTransfer.setData("type", "tab");
    dataTransfer.setData("tab", String(tab.id));
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
    if (type !== "tab") {
      return;
    }
    const sourceId = Number(event.dataTransfer?.getData("tab"));
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
    element.dataset.dragType = "group";
    element.dataset.groupId = group.id;
    element.addEventListener("dragstart", (event) => {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) {
        return;
      }
      dataTransfer.setData("type", "group");
      dataTransfer.setData("group", group.id);
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

  const dragHandle = document.createElement("span");
  dragHandle.className = "group-drag-handle";
  dragHandle.title = "Reorder group";
  dragHandle.textContent = "::";
  dragHandle.addEventListener("click", (event) => event.stopPropagation());
  dragHandle.addEventListener("mousedown", (event) => event.stopPropagation());
  header.insertBefore(dragHandle, titleSpan);

  bindGroupDragSource(header);
  bindGroupDragSource(dragHandle);

  header.addEventListener("dragover", (event) => {
    const type = getDragType(event);
    if (type !== "tab" && !isGroupDragging && type !== "group") {
      return;
    }
    event.preventDefault();
    if (!isGroupDragging && type === "group") {
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
    if (type === "tab") {
      const tabId = Number(event.dataTransfer?.getData("tab"));
      if (tabId) {
        moveTabToGroup(tabId, group.id);
        rerenderAndNotify();
      }
    } else if (type === "group") {
      const sourceGroupId = event.dataTransfer?.getData("group");
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
      group.title = value;
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
    if (type !== "tab") {
      return;
    }
    const tabId = Number(event.dataTransfer?.getData("tab"));
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
    const sourceGroupId = event.dataTransfer?.getData("group");
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
    if (type !== "tab") {
      return;
    }
    const tabId = Number(event.dataTransfer?.getData("tab"));
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
  if (groups.length) {
    container.appendChild(createGroupDropZone(0));
    groups.forEach((group, index) => {
      container.appendChild(createGroupSection(group));
      container.appendChild(createGroupDropZone(index + 1));
    });
  }
  setupContainerDrop(container);
  ensureContextMenuListeners();
}
