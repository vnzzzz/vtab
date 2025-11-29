// groupStore.js
// Owns in-memory group state and tab-to-group membership helpers.

const groups = [];
let groupCounter = 1;

export function getGroups() {
  return groups;
}

export function createGroup(name) {
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

export function findGroupById(id) {
  return groups.find((group) => group.id === id);
}

export function findGroupContaining(tabId) {
  return groups.find((group) => group.tabIds.has(tabId));
}

export function isTabGrouped(tabId) {
  return Boolean(findGroupContaining(tabId));
}

export function moveTabToGroup(tabId, groupId) {
  const current = findGroupContaining(tabId);
  if (current?.id === groupId) {
    return;
  }
  current?.tabIds.delete(tabId);
  const target = findGroupById(groupId);
  if (target) {
    target.tabIds.add(tabId);
  }
}

export function moveTabToUngrouped(tabId) {
  const current = findGroupContaining(tabId);
  current?.tabIds.delete(tabId);
}

export function moveGroupToIndex(groupId, targetIndex) {
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

export function moveGroupBefore(groupId, targetGroupId) {
  const targetIndex = groups.findIndex((group) => group.id === targetGroupId);
  if (targetIndex === -1) {
    return;
  }
  moveGroupToIndex(groupId, targetIndex);
}

export function syncGroupsWithTabs(tabs) {
  const validIds = new Set(tabs.map((tab) => tab.id));
  for (const group of groups) {
    group.tabIds = new Set([...group.tabIds].filter((id) => validIds.has(id)));
  }
}

export function buildGroupLayout(tabs) {
  const layout = [
    {
      id: null,
      title: null,
      tabIds: tabs
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
