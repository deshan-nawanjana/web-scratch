// pages to avoid from scraping
const exceptions = [
  "about:",
  "chrome://",
  "chrome-extension://",
  "https://chrome.google.com/webstore"
]

// create context menu item
chrome.runtime.onInstalled.addListener(() => {
  // create scratch menu item
  chrome.contextMenus.create({
    id: "scratch-element",
    title: "Scratch this element",
    contexts: ["all"]
  })
})

// context menu item event listener
chrome.contextMenus.onClicked.addListener((info, tab) => {
  // return if tab or url not available
  if (!tab || !tab.url) { return }
  // return if the tab is restricted
  if (exceptions.some(item => tab.url.startsWith(item))) { return }
  // check menu item id
  if (info.menuItemId === "scratch-element") {
    // execute to scratch from content script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window["_scratchElements"]()
    })
  }
})

// message listener to preview scratch content
chrome.runtime.onMessage.addListener(message => {
  // check preview action
  if (message.action === "preview-scratch") {
    // create timestamp id
    const id = Date.now()
    // store scratched content locally
    chrome.storage.local.set({ [id]: message.data }).then(() => {
      // create tab and open
      chrome.windows.create({
        url: chrome.runtime.getURL(`index.html?id=${id}`),
        type: "popup",
        width: 900,
        height: 680
      })
    })
  }
})
