
let blockedItems = [];
let blockedKeywords = [];
let isExtensionActive = true;

const dataReady = new Promise((resolve) => {
  chrome.storage.sync.get(['blockedItems', 'blockedKeywords', 'isExtensionActive'], (result) => {
    blockedItems = result.blockedItems || [];
    blockedKeywords = result.blockedKeywords || [];
    isExtensionActive = result.isExtensionActive !== undefined ? result.isExtensionActive : true;
    

    blockedItems.forEach(item => {
      if (item.active === undefined) {
        item.active = true;
      }
    });
    
    blockedKeywords.forEach(keyword => {
      if (keyword.active === undefined) {
        keyword.active = true;
      }
    });
    
    resolve();
  });
});

const CLEANUP_ALARM_NAME = 'cleanupExpiredItems';
chrome.alarms.get(CLEANUP_ALARM_NAME, (alarm) => {
  if (!alarm) {
    chrome.alarms.create(CLEANUP_ALARM_NAME, {
      delayInMinutes: 1,
      periodInMinutes: 60
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CLEANUP_ALARM_NAME) {
    performCleanup();
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await dataReady; 
    if (!isExtensionActive) return;
    checkUrlAndTakeAction(tab, 'history');
  }
});

chrome.downloads.onCreated.addListener(async (downloadItem) => {
  await dataReady;
  if (!isExtensionActive) return;

  const fakeTabForDownload = { url: downloadItem.url, title: '' };
  checkUrlAndTakeAction(fakeTabForDownload, 'download', downloadItem.id);
  
  if (downloadItem.referrer) {
    const fakeTabForReferrer = { url: downloadItem.referrer, title: '' };
    checkUrlAndTakeAction(fakeTabForReferrer, 'download', downloadItem.id);
  }
});

function checkUrlAndTakeAction(tab, actionType, downloadId = null) {
  try {
    const url = tab.url;
    const title = tab.title || '';
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');

    for (const item of blockedItems) {
      if (item.expirationTimestamp && item.expirationTimestamp < Date.now()) {
        continue;
      }
      if (item.active === false) {
        continue;
      }
      if (isMatch(url, domain, item)) {
        if (actionType === 'history') {
          deleteHistoryForUrl(url);
          if (item.deleteCookies) deleteCookiesForDomain(domain);
          if (item.deleteStorage) deleteStorageForDomain(domain);
        } else if (actionType === 'download' && item.deleteDownloads) {
          eraseDownload(downloadId);
        }
        return;
      }
    }

    const lowerCaseUrl = url.toLowerCase();
    const lowerCaseTitle = title.toLowerCase();

    for (const keywordObj of blockedKeywords) {
      if (keywordObj.expirationTimestamp && keywordObj.expirationTimestamp < Date.now()) {
        continue;
      }
      if (keywordObj.active === false) {
        continue;
      }
      const keyword = keywordObj.text.toLowerCase();
      let matchFound = false;

      if (keywordObj.inTitle && lowerCaseTitle.includes(keyword)) {
        matchFound = true;
      }
      if (!matchFound && keywordObj.inUrl && lowerCaseUrl.includes(keyword)) {
        matchFound = true;
      }

      if (matchFound) {
        if (actionType === 'history') {
          deleteHistoryForUrl(url);
          if (keywordObj.deleteCookies) deleteCookiesForDomain(domain);
          if (keywordObj.deleteStorage) deleteStorageForDomain(domain);
        } else if (actionType === 'download') {
          if (keywordObj.deleteDownloads) eraseDownload(downloadId);
        }
        return;
      }
    }
  } catch (e) { }
}

function isMatch(url, domain, item) {
  switch (item.scope) {
    case 'exact':
      const formattedUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return formattedUrl === item.url;
    case 'domain':
      return domain === item.url;
    case 'subdomain':
      return domain === item.url || domain.endsWith('.' + item.url);
    default:
      return false;
  }
}

function eraseDownload(downloadId) {
  if (downloadId) {
    chrome.downloads.erase({ id: downloadId });
  }
}

function deleteHistoryForUrl(url) {
  chrome.history.deleteUrl({ url: url }, () => {
    chrome.history.search({ text: url, maxResults: 100 }, (historyItems) => {
      for (const item of historyItems) {
        if (item.url) {
          chrome.history.deleteUrl({ url: item.url });
        }
      }
    });
  });
}

function deleteCookiesForDomain(domain) {
  chrome.cookies.getAll({ domain: domain }, (cookies) => {
    for (const cookie of cookies) {
      const url = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain + cookie.path;
      chrome.cookies.remove({ url: url, name: cookie.name });
    }
  });

  chrome.cookies.getAll({}, (allCookies) => {
    for (const cookie of allCookies) {
      if (cookie.domain.endsWith('.' + domain)) {
        const url = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain + cookie.path;
        chrome.cookies.remove({ url: url, name: cookie.name });
      }
    }
  });
}

function deleteStorageForDomain(domain) {
  const origin = `https://${domain}`;
  chrome.browsingData.remove({
    origins: [origin]
  }, {
    "localStorage": true,
    "sessionStorage": true
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Error deleting storage for ${domain}: ${chrome.runtime.lastError.message}`);
    }
  });
  
  chrome.browsingData.remove({
    origins: [`https://*.${domain}`]
  }, {
    "localStorage": true,
    "sessionStorage": true
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Error deleting subdomain storage for ${domain}: ${chrome.runtime.lastError.message}`);
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleRequest = async () => {
    await dataReady; 

    if (request.action === 'getExtensionStatus') {
      sendResponse({ isActive: isExtensionActive });
      return;
    }

    if (request.action === 'toggleExtensionStatus') {
      isExtensionActive = !isExtensionActive;
      chrome.storage.sync.set({ isExtensionActive }, () => {
        sendResponse({ success: true, isActive: isExtensionActive });
      });
      return;
    }
    
    if (request.action === 'getItems') {
      sendResponse({ items: blockedItems });
      return;
    }

    if (!isExtensionActive) {
      sendResponse({ success: false, message: 'Extension is disabled.' });
      return;
    }

    if (request.action === 'addItem') {
      const existing = blockedItems.find(item => item.url === request.item.url);
      if (!existing) {
        blockedItems.push(request.item);
        saveBlockedItems(() => {
          if (request.item.clearExistingHistory) {
            clearExistingHistoryForUrl(request.item);
          }
          sendResponse({success: true});
        });
      } else {
        sendResponse({success: false, message: 'URL already exists'});
      }
      return;
    }
    
    if (request.action === 'removeItem') {
      blockedItems = blockedItems.filter(item => item.url !== request.url);
      saveBlockedItems(() => sendResponse({success: true}));
      return;
    }
  
    if (request.action === 'updateItem') {
      const itemIndex = blockedItems.findIndex(item => item.url === request.item.url);
      if (itemIndex > -1) {
        const oldItem = blockedItems[itemIndex];
        const wasClearHistoryActive = oldItem.clearExistingHistory;
        const isClearHistoryActive = request.item.clearExistingHistory;
        
        if (!wasClearHistoryActive && isClearHistoryActive) {
          clearExistingHistoryForUrl(request.item);
        }
        
        blockedItems[itemIndex] = request.item;
        saveBlockedItems(() => sendResponse({success: true}));
      } else {
        sendResponse({success: false, message: 'Item not found'});
      }
      return;
    }
    
    if (request.action === 'clearAllItems') {
      const originalItems = blockedItems.length;
      const originalKeywords = blockedKeywords.length;
      if (originalItems > 0) blockedItems = [];
      if (originalKeywords > 0) blockedKeywords = [];
      
      const savePromises = [];
      if (originalItems > 0) savePromises.push(new Promise(resolve => saveBlockedItems(resolve)));
      if (originalKeywords > 0) savePromises.push(new Promise(resolve => saveKeywords(resolve)));

      Promise.all(savePromises).then(() => sendResponse({success: true}));
      return;
    }
    
    if (request.action === 'exportItems') {
      sendResponse({ success: true, data: { blockedItems, blockedKeywords } });
      return;
    }

    if (request.action === 'importItems') {
      const data = request.data || {};
      const itemsToImport = Array.isArray(data.blockedItems) ? data.blockedItems : [];
      const keywordsToImport = Array.isArray(data.blockedKeywords) ? data.blockedKeywords : [];
      let importedCount = 0;

      const newItems = itemsToImport.filter(newItem => 
        newItem && typeof newItem.url === 'string' &&
        !blockedItems.some(existingItem => existingItem.url === newItem.url)
      );
      if (newItems.length > 0) {
        blockedItems.push(...newItems);
        importedCount += newItems.length;
        saveBlockedItems();
      }
      
      const newKeywords = keywordsToImport.filter(newKeyword => 
        newKeyword && typeof newKeyword.text === 'string' &&
        !blockedKeywords.some(existingKeyword => existingKeyword.text === newKeyword.text)
      );
      if (newKeywords.length > 0) {
        blockedKeywords.push(...newKeywords);
        importedCount += newKeywords.length;
        saveKeywords();
      }

      sendResponse({success: true, importedCount});
      return;
    }

    if (request.action === 'addKeyword') {
      const keywordObj = request.keyword;
      const existing = blockedKeywords.find(k => k.text === keywordObj.text);
      if (!existing) {
        blockedKeywords.push(keywordObj);
        saveKeywords(() => {
          if (keywordObj.clearExistingHistory) {
            clearExistingHistoryForKeyword(keywordObj);
          }
          sendResponse({success: true});
        });
      } else {
        sendResponse({success: false, message: 'Keyword already exists'});
      }
      return;
    }

    if (request.action === 'removeKeyword') {
      blockedKeywords = blockedKeywords.filter(k => k.text !== request.keyword);
      saveKeywords(() => sendResponse({success: true}));
      return;
    }

    if (request.action === 'updateKeyword') {
      const keywordToUpdate = request.keyword;
      const keywordIndex = blockedKeywords.findIndex(k => k.text === keywordToUpdate.text);
      if (keywordIndex > -1) {
        const oldKeyword = blockedKeywords[keywordIndex];
        const wasClearHistoryActive = oldKeyword.clearExistingHistory;
        const isClearHistoryActive = keywordToUpdate.clearExistingHistory;
        
        if (!wasClearHistoryActive && isClearHistoryActive) {
          clearExistingHistoryForKeyword(keywordToUpdate);
        }
        
        blockedKeywords[keywordIndex] = keywordToUpdate;
        saveKeywords(() => sendResponse({success: true}));
      } else {
        sendResponse({success: false});
      }
      return;
    }

    if (request.action === 'getKeywords') {
      sendResponse({keywords: blockedKeywords});
      return;
    }
  };

  handleRequest();
  return true;
});

function saveBlockedItems(callback) {
  chrome.storage.sync.set({
    blockedItems: blockedItems
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Error saving items: ${chrome.runtime.lastError.message}`);
    }
    if (callback) {
      callback();
    }
  });
}

function saveKeywords(callback) {
  chrome.storage.sync.set({
    blockedKeywords: blockedKeywords
  }, () => {
    if (chrome.runtime.lastError) {
      console.error(`Error saving keywords: ${chrome.runtime.lastError.message}`);
    }
    if (callback) {
      callback();
    }
  });
}

async function performCleanup() {
  await dataReady;
  const now = Date.now();
  let itemsChanged = false;
  let keywordsChanged = false;

  const activeItems = blockedItems.filter(item => !item.expirationTimestamp || item.expirationTimestamp >= now);
  if (activeItems.length < blockedItems.length) {
    blockedItems = activeItems;
    itemsChanged = true;
  }
  
  const activeKeywords = blockedKeywords.filter(keyword => !keyword.expirationTimestamp || keyword.expirationTimestamp >= now);
  if (activeKeywords.length < blockedKeywords.length) {
    blockedKeywords = activeKeywords;
    keywordsChanged = true;
  }

  if (itemsChanged) saveBlockedItems();
  if (keywordsChanged) saveKeywords();
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "block-current-site",
    title: "Auto-delete history for this site",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "block-link-url",
    title: "Auto-delete history containing this URL",
    contexts: ["link"]
  });
  chrome.contextMenus.create({
    id: "block-selected-text",
    title: "Auto-delete history containing this keyword",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await dataReady;

  switch (info.menuItemId) {
    case "block-current-site":
      if (tab?.url) {
        const url = new URL(tab.url);
        const domain = url.hostname.replace(/^www\./, '');
        const isAlreadyBlocked = blockedItems.some(item => item.url === domain);
        if (!isAlreadyBlocked) {
          blockedItems.push({ url: domain, scope: 'domain', deleteCookies: false, deleteDownloads: false, expirationTimestamp: null });
          saveBlockedItems();
        }
      }
      break;

    case "block-link-url":
      if (info.linkUrl) {
        const urlToAdd = info.linkUrl.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
        const isAlreadyBlocked = blockedItems.some(item => item.url === urlToAdd);
        if (!isAlreadyBlocked) {
          blockedItems.push({ url: urlToAdd, scope: 'exact', deleteCookies: false, deleteDownloads: false, expirationTimestamp: null });
          saveBlockedItems();
        }
      }
      break;

    case "block-selected-text":
      if (info.selectionText) {
        const keyword = info.selectionText.trim();
        if (keyword) {
          const isAlreadyBlocked = blockedKeywords.some(k => k.text === keyword);
          if (!isAlreadyBlocked) {
            blockedKeywords.push({ text: keyword, inTitle: true, inUrl: true, expirationTimestamp: null });
            saveKeywords();
          }
        }
      }
      break;
  }
});

function clearExistingHistoryForUrl(item) {
  chrome.history.search({ text: '', maxResults: 10000 }, (historyItems) => {
    const itemsToDelete = [];
    
    for (const historyItem of historyItems) {
      if (!historyItem.url) continue;
      
      try {
        const url = historyItem.url;
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace(/^www\./, '');
        
        let shouldDelete = false;
        
        switch (item.scope) {
          case 'exact':
            const formattedUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
            shouldDelete = formattedUrl === item.url;
            break;
          case 'domain':
            shouldDelete = domain === item.url;
            break;
          case 'subdomain':
            shouldDelete = domain === item.url || domain.endsWith('.' + item.url);
            break;
        }
        
        if (shouldDelete) {
          itemsToDelete.push(historyItem.url);
        }
      } catch (e) {
      }
    }
    
    itemsToDelete.forEach(url => {
      chrome.history.deleteUrl({ url: url });
    });
    
    if (item.deleteCookies || item.deleteStorage) {
      if (item.scope === 'subdomain') {
        const mainDomain = item.url;
        deleteCookiesForDomain(mainDomain);
        deleteStorageForDomain(mainDomain);
        
        chrome.cookies.getAll({}, (cookies) => {
          cookies.forEach(cookie => {
            if (cookie.domain.endsWith('.' + mainDomain) || cookie.domain === mainDomain) {
              const url = "http" + (cookie.secure ? "s" : "") + "://" + cookie.domain + cookie.path;
              chrome.cookies.remove({ url: url, name: cookie.name });
            }
          });
        });
      } else {
        const domain = item.url;
        if (item.deleteCookies) deleteCookiesForDomain(domain);
        if (item.deleteStorage) deleteStorageForDomain(domain);
      }
    }
  });
}

function clearExistingHistoryForKeyword(keywordObj) {
  chrome.history.search({ text: '', maxResults: 10000 }, (historyItems) => {
    const itemsToDelete = [];
    const keyword = keywordObj.text.toLowerCase();
    
    for (const historyItem of historyItems) {
      if (!historyItem.url) continue;
      
      let shouldDelete = false;
      
      if (keywordObj.inTitle && historyItem.title) {
        shouldDelete = historyItem.title.toLowerCase().includes(keyword);
      }
      
      if (!shouldDelete && keywordObj.inUrl) {
        shouldDelete = historyItem.url.toLowerCase().includes(keyword);
      }
      
      if (shouldDelete) {
        itemsToDelete.push(historyItem.url);
      }
    }
    
    itemsToDelete.forEach(url => {
      chrome.history.deleteUrl({ url: url });
    });
    
    if (keywordObj.deleteCookies || keywordObj.deleteStorage) {
    }
  });
}
