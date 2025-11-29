// background.js

chrome.runtime.onInstalled.addListener(() => {
  // 拡張アイコンをクリックしたらサイドパネルを開く挙動
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error("[VTab] setPanelBehavior error:", err));
});
