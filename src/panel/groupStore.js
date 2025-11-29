// groupStore.js
// Owns in-memory group state, tab-to-group membership helpers, and persistence.

const groups = [];
let groupCounter = 1;
let tabCache = new Map();

const STORAGE_KEY = "vtab-group-state";

export async function initializeGroupStore() {
  await loadPersistedState();
}

function deserializeGroup(raw) {
  if (!raw?.id) {
    return null;
  }
  const members = Array.isArray(raw.members)
    ? raw.members
        .map((member) => {
          const tabId =
            typeof member.tabId === "number" ? member.tabId : null;
          const url = typeof member.url === "string" ? member.url : null;
          if (tabId === null && !url) {
            return null;
          }
          return { tabId, url };
        })
        .filter(Boolean)
    : [];
  return {
    id: raw.id,
    title: raw.title || "Group",
    members,
    tabIds: new Set(),
  };
}

async function loadPersistedState() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const saved = result?.[STORAGE_KEY];
    if (!saved?.groups) {
      return;
    }
    const restoredGroups = saved.groups
      .map(deserializeGroup)
      .filter(Boolean);
    if (restoredGroups.length) {
      groups.splice(0, groups.length, ...restoredGroups);
    }
    groupCounter = Math.max(saved.groupCounter ?? 1, restoredGroups.length + 1);
  } catch (error) {
    console.error("[VTab] Failed to load group state", error);
  }
}

function serializeGroup(group) {
  return {
    id: group.id,
    title: group.title,
    members: group.members.map((member) => ({
      tabId: member.tabId ?? null,
      url: member.url ?? null,
    })),
  };
}

async function persistGroups() {
  try {
    const payload = {
      groupCounter,
      groups: groups.map(serializeGroup),
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: payload });
  } catch (error) {
    console.error("[VTab] Failed to persist group state", error);
  }
}

function queuePersist() {
  void persistGroups();
}

export function getGroups() {
  return groups;
}

export function createGroup(name) {
  const title = name?.trim();
  const id = `group-${Date.now()}-${groupCounter}`;
  const group = {
    id,
    title: title || `Group ${groupCounter}`,
    tabIds: new Set(),
    members: [],
  };
  groupCounter += 1;
  groups.push(group);
  queuePersist();
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

function removeTabFromGroup(group, tabId) {
  if (!group) {
    return false;
  }
  const originalLength = group.members.length;
  group.members = group.members.filter((member) => member.tabId !== tabId);
  const deleted = group.tabIds.delete(tabId);
  return deleted || originalLength !== group.members.length;
}

export function moveTabToGroup(tabId, groupId) {
  const current = findGroupContaining(tabId);
  if (current?.id === groupId) {
    return;
  }

  let changed = false;
  if (current) {
    changed = removeTabFromGroup(current, tabId) || changed;
  }

  const target = findGroupById(groupId);
  if (target) {
    const url = tabCache.get(tabId)?.url ?? null;
    const alreadyMember = target.members.some(
      (member) => member.tabId === tabId
    );
    if (!alreadyMember) {
      target.members.push({ tabId, url });
      target.tabIds.add(tabId);
      changed = true;
    }
  }

  if (changed) {
    queuePersist();
  }
}

export function moveTabToUngrouped(tabId) {
  const current = findGroupContaining(tabId);
  if (removeTabFromGroup(current, tabId)) {
    queuePersist();
  }
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
  queuePersist();
}

export function moveGroupBefore(groupId, targetGroupId) {
  const targetIndex = groups.findIndex((group) => group.id === targetGroupId);
  if (targetIndex === -1) {
    return;
  }
  moveGroupToIndex(groupId, targetIndex);
}

export function renameGroup(groupId, title) {
  const group = findGroupById(groupId);
  if (!group) {
    return;
  }
  const nextTitle = title?.trim();
  if (!nextTitle || nextTitle === group.title) {
    return;
  }
  group.title = nextTitle;
  queuePersist();
}

export function syncGroupsWithTabs(tabs) {
  tabCache = new Map(tabs.map((tab) => [tab.id, tab]));
  let changed = false;

  for (const group of groups) {
    const matchedMembers = [];
    const usedTabIds = new Set();

    for (const member of group.members) {
      const tab = tabCache.get(member.tabId);
      if (tab && !usedTabIds.has(tab.id)) {
        matchedMembers.push({ tabId: tab.id, url: tab.url });
        usedTabIds.add(tab.id);
        if (member.url !== tab.url) {
          changed = true;
        }
      }
    }

    for (const member of group.members) {
      if (usedTabIds.has(member.tabId) || !member?.url) {
        continue;
      }
      const tab = tabs.find(
        (candidate) =>
          !usedTabIds.has(candidate.id) && candidate.url === member.url
      );
      if (tab) {
        matchedMembers.push({ tabId: tab.id, url: tab.url });
        usedTabIds.add(tab.id);
        if (member.tabId !== tab.id) {
          changed = true;
        }
      }
    }

    if (matchedMembers.length !== group.members.length) {
      changed = true;
    }

    const newTabIds = new Set(matchedMembers.map((member) => member.tabId));
    if (
      group.tabIds.size !== newTabIds.size ||
      [...newTabIds].some((id) => !group.tabIds.has(id))
    ) {
      changed = true;
    }

    group.members = matchedMembers;
    group.tabIds = newTabIds;
  }

  if (changed) {
    queuePersist();
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
