// contextMenu.js
// Builds and manages the tab grouping context menu.

let contextMenuInstance = null;

export function createContextMenu({
  getGroups,
  onAssignToGroup,
  onCreateGroup,
}) {
  if (contextMenuInstance) {
    return contextMenuInstance;
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
  const menuItems = contextMenu.querySelector(".menu-items");
  const newGroupInput = contextMenu.querySelector(".menu-new input");
  const newGroupButton = contextMenu.querySelector(".menu-new button");
  let contextMenuTabId = null;

  function hide() {
    contextMenu.classList.remove("visible");
    contextMenuTabId = null;
  }

  function createGroupFromContextMenu() {
    if (!contextMenuTabId) {
      return;
    }
    const name = newGroupInput.value.trim();
    const group = onCreateGroup(name);
    if (!group) {
      hide();
      return;
    }
    onAssignToGroup(contextMenuTabId, group.id);
    hide();
  }

  function bindOnce() {
    document.addEventListener("click", (event) => {
      if (!contextMenu.contains(event.target)) {
        hide();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        hide();
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

  function show(tabId, x, y) {
    contextMenuTabId = tabId;
    menuItems.innerHTML = "";
    const groups = getGroups();
    if (!groups.length) {
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
          onAssignToGroup(contextMenuTabId, group.id);
          hide();
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

  bindOnce();
  contextMenuInstance = { show, hide };
  return contextMenuInstance;
}
