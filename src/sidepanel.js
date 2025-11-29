// sidepanel.js

async function getCurrentWindowTabs() {
  // 現在のウィンドウに属するタブ一覧を取得
  return await chrome.tabs.query({ currentWindow: true });
}

function renderTabs(tabs) {
  const container = document.getElementById("tabs");
  container.innerHTML = "";

  for (const tab of tabs) {
    const div = document.createElement("div");
    div.className = "tab" + (tab.active ? " active" : "");
    div.dataset.tabId = String(tab.id);

    const span = document.createElement("span");
    span.className = "tab-title";
    span.textContent = tab.title || "(no title)";
    div.appendChild(span);

    // クリックでタブをアクティブに
    div.addEventListener("click", async () => {
      const tabId = Number(div.dataset.tabId);
      try {
        await chrome.tabs.update(tabId, { active: true });
      } catch (e) {
        console.error("[VTab] Failed to activate tab", e);
      }
    });

    container.appendChild(div);
  }
}

async function refreshTabs() {
  const tabs = await getCurrentWindowTabs();
  renderTabs(tabs);
}

// 初期表示
refreshTabs().catch(console.error);

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
