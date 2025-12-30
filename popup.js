document.addEventListener('DOMContentLoaded', function() {
  try {
    const statusToggle = document.getElementById('status-toggle');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const mainContent = document.querySelector('.main-content');
    const notificationContainer = document.getElementById('notificationContainer');
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    const urlInput = document.getElementById('urlInput');
    const addUrlBtn = document.getElementById('addUrlBtn');
    const urlList = document.getElementById('urlList');
    const urlCount = document.getElementById('urlCount');
    
    const keywordInput = document.getElementById('keywordInput');
    const addKeywordBtn = document.getElementById('addKeywordBtn');
    const keywordList = document.getElementById('keywordList');
    const keywordCount = document.getElementById('keywordCount');
    const searchInTitle = document.getElementById('searchInTitle');
    const searchInUrl = document.getElementById('searchInUrl');

    const advancedActionsToggle = document.getElementById('advancedActionsToggle');
    const advancedActionsPanel = document.getElementById('advancedActionsPanel');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const importBtn = document.getElementById('importBtn');
    const exportBtn = document.getElementById('exportBtn');
    const importFile = document.getElementById('importFile');
    
    const helpBtn = document.getElementById('help-btn');
    const helpContent = document.getElementById('help');
    const mainTabs = document.querySelector('.tabs');
    const mainContentPanels = document.querySelectorAll('.tab-content');
    const advancedActionsContainer = document.querySelector('.advanced-actions-container');

    const criticalElements = [
      statusToggle, statusDot, statusText, mainContent,
      urlInput, addUrlBtn, urlList, urlCount,
      keywordInput, addKeywordBtn, keywordList, keywordCount,
      advancedActionsToggle, advancedActionsPanel, clearAllBtn, importBtn, exportBtn, importFile,
      helpBtn, helpContent, mainTabs, advancedActionsContainer
    ];

    const missingElements = criticalElements.filter(el => !el);
    if (missingElements.length > 0) {
      console.error('Critical elements missing:', missingElements);
      showError('Popup yüklenirken hata oluştu. Lütfen eklentiyi yeniden yükleyin.');
      return;
    }
    
    function init() {
      try {
        updateStatusUI();
        loadUrls();
        loadKeywords();
        setupEventListeners();
      } catch (error) {
        console.error('Initialization error:', error);
        showError('Popup başlatılırken hata oluştu.');
      }
    }

    function showError(message) {
      if (mainContent) {
        mainContent.innerHTML = `
          <div style="padding: 20px; text-align: center; color: #ef4444;">
            <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
            <p>${message}</p>
            <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Yeniden Dene
            </button>
          </div>
        `;
      }
    }

    function showNotification(message, type = 'success') {
      if (notificationContainer) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
          <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
          <span class="message">${message}</span>
        `;
        notificationContainer.appendChild(notification);
        
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 3000);
      }
    }

    function setupEventListeners() {
      statusToggle.addEventListener('click', handleToggleStatus);

      tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
      });

      addUrlBtn.addEventListener('click', handleAddUrl);
      urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddUrl();
      });

      addKeywordBtn.addEventListener('click', handleAddKeyword);
      keywordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddKeyword();
      });
      
      advancedActionsToggle.addEventListener('click', () => {
        advancedActionsToggle.classList.toggle('open');
        advancedActionsPanel.classList.toggle('open');
      });

      clearAllBtn.addEventListener('click', handleClearAll);
      importBtn.addEventListener('click', () => importFile.click());
      exportBtn.addEventListener('click', handleExport);
      importFile.addEventListener('change', handleImport);

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.list-item-container')) {
          closeAllOptionsPanels();
        }
        if (!e.target.closest('.confirm-delete')) {
          document.querySelectorAll('.remove-btn.confirm-delete').forEach(btn => {
            btn.classList.remove('confirm-delete');
            btn.innerHTML = '<i class="fas fa-trash"></i>';
            btn.title = 'Delete';
          });
        }
      });

      helpBtn.addEventListener('click', () => {
        if (helpContent.classList.contains('active')) {
          helpContent.classList.remove('active');
          mainTabs.classList.remove('hide-on-help');
          advancedActionsContainer.classList.remove('hide-on-help');
          mainContentPanels.forEach(panel => panel.classList.remove('hide-on-help'));
        } else {
          helpContent.classList.add('active');
          mainTabs.classList.add('hide-on-help');
          advancedActionsContainer.classList.add('hide-on-help');
          mainContentPanels.forEach(panel => panel.classList.add('hide-on-help'));
        }
      });
    }

    function updateStatusUI(isActive = null) {
      const update = (active) => {
        statusText.textContent = active ? 'Active' : 'Disabled';
        statusDot.classList.toggle('inactive', !active);
        mainContent.classList.toggle('disabled', !active);
      };
      if (isActive !== null) {
        update(isActive);
      } else {
        chrome.runtime.sendMessage({ action: 'getExtensionStatus' }, (response) => {
          if (response) update(response.isActive);
        });
      }
    }

    function handleToggleStatus() {
      chrome.runtime.sendMessage({ action: 'toggleExtensionStatus' }, (response) => {
        if (response && response.success) {
          updateStatusUI(response.isActive);
        }
      });
    }

    function switchTab(tabId) {
      tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
      tabContents.forEach(content => content.classList.toggle('active', content.id === tabId));
    }

    function handleAddUrl() {
      const url = urlInput.value.trim();
      if (!url) return;
      const cleanUrl = url.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      const item = { 
        url: cleanUrl, 
        scope: 'domain', 
        deleteCookies: false, 
        deleteDownloads: false,
        deleteStorage: false,
        clearExistingHistory: false,
        active: true
      };
      chrome.runtime.sendMessage({ action: 'addItem', item }, (res) => {
        if (res && res.success) {
          loadUrls();
          urlInput.value = '';
        }
      });
    }

    function loadUrls() {
      chrome.runtime.sendMessage({ action: 'getItems' }, (res) => {
        if (!res || !res.items) return;
        urlList.innerHTML = '';
        urlCount.textContent = res.items.length;
        res.items.forEach(item => urlList.appendChild(createUrlElement(item)));
      });
    }

    function createUrlElement(item) {
      const li = document.createElement('li');
      li.className = 'list-item-container';
      li.dataset.url = item.url;
      li.dataset.expiration = item.expirationTimestamp || '';

      const isActive = item.active !== false;

      li.innerHTML = `
        <div class="list-item-main">
          <div class="item-header">
            <button class="toggle-btn ${isActive ? 'active' : 'inactive'}" title="${isActive ? 'Deactivate' : 'Activate'}">
              <i class="fas fa-${isActive ? 'toggle-on' : 'toggle-off'}"></i>
            </button>
            <span class="url-text">${item.url}</span>
          </div>
          <div class="button-group">
            <button class="list-btn go-btn" title="Go to Site"><i class="fas fa-external-link-alt"></i></button>
            <button class="list-btn options-btn" title="Options"><i class="fas fa-ellipsis-v"></i></button>
            <button class="list-btn remove-btn" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="options-panel">
          <div class="checkbox-options" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 15px; margin-bottom: 12px;">
            <label title="Delete this domain and all subdomains"><input type="checkbox" class="scope-cb" data-scope="subdomain" ${item.scope === 'subdomain' ? 'checked' : ''}> Subdomains</label>
            <label title="Delete only this exact address"><input type="checkbox" class="scope-cb" data-scope="exact" ${item.scope === 'exact' ? 'checked' : ''}> Exact URL</label>
            <label title="Also delete cookies from this site"><input type="checkbox" class="cookie-cb" ${item.deleteCookies ? 'checked' : ''}> Delete Cookies</label>
            <label title="Delete downloads from this site"><input type="checkbox" class="download-cb" ${item.deleteDownloads ? 'checked' : ''}> Delete Downloads</label>
            <label title="Delete Local/Session Storage from this site"><input type="checkbox" class="storage-cb" ${item.deleteStorage ? 'checked' : ''}> Delete Storage</label>
            <label title="Clear existing history for this URL"><input type="checkbox" class="clear-history-cb" ${item.clearExistingHistory ? 'checked' : ''}> Clear Existing History</label>
          </div>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 8px 0;">
          <div class="timer-section" style="font-size: 12px; color: #555;">
            <div style="font-weight: 600; margin-bottom: 8px;">Set Duration</div>
            <div class="timer-input-group" style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
                <input type="number" class="timer-value timer-input" min="1">
                <select class="timer-unit timer-input">
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="permanent">Indefinite</option>
                </select>
            </div>
            <div class="timer-remaining" style="font-weight: 500; min-height: 18px; margin-top: 8px;"></div>
          </div>
        </div>
      `;
      setupUrlElementListeners(li, item);
      return li;
    }

    function setupUrlElementListeners(li, item) {
      const optionsBtn = li.querySelector('.options-btn');
      const optionsPanel = li.querySelector('.options-panel');
      const removeBtn = li.querySelector('.remove-btn');
      const toggleBtn = li.querySelector('.toggle-btn');
      const timerValueInput = li.querySelector('.timer-value');
      const timerUnitSelect = li.querySelector('.timer-unit');

      li.querySelector('.go-btn').addEventListener('click', () => chrome.tabs.create({ url: `https://${item.url}` }));
      
      setupConfirmation(removeBtn, () => {
        chrome.runtime.sendMessage({ action: 'removeItem', url: item.url }, () => loadUrls());
      });

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentActive = item.active !== false;
        item.active = !currentActive;
        toggleBtn.classList.toggle('active', item.active);
        toggleBtn.classList.toggle('inactive', !item.active);
        toggleBtn.innerHTML = `<i class="fas fa-${item.active ? 'toggle-on' : 'toggle-off'}"></i>`;
        toggleBtn.title = item.active ? 'Deactivate' : 'Activate';
        chrome.runtime.sendMessage({ action: 'updateItem', item });
      });

      optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllOptionsPanels(optionsPanel);
        optionsPanel.classList.toggle('open');
        optionsBtn.classList.toggle('active');
      });

      const updateItemListener = () => {
        const scopeCb = li.querySelector('.scope-cb:checked');
        item.scope = scopeCb ? scopeCb.dataset.scope : 'domain';
        item.deleteCookies = li.querySelector('.cookie-cb').checked;
        item.deleteDownloads = li.querySelector('.download-cb').checked;
        item.deleteStorage = li.querySelector('.storage-cb').checked;
        item.clearExistingHistory = li.querySelector('.clear-history-cb').checked;
        chrome.runtime.sendMessage({ action: 'updateItem', item });
      };

      li.querySelectorAll('.scope-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) {
            li.querySelectorAll('.scope-cb').forEach(other => { if (other !== cb) other.checked = false; });
          }
          updateItemListener();
        });
      });
      li.querySelector('.cookie-cb').addEventListener('change', updateItemListener);
      li.querySelector('.download-cb').addEventListener('change', updateItemListener);
      li.querySelector('.storage-cb').addEventListener('change', updateItemListener);
      li.querySelector('.clear-history-cb').addEventListener('change', function() {
        if (this.checked) {
          const confirmed = confirm(`This action will delete ALL history records related to "${item.url}". This action cannot be undone.\n\nDo you want to continue?`);
          if (!confirmed) {
            this.checked = false;
            return;
          }
        }
        updateItemListener();
      });

      const onTimerChange = () => {
        const unit = timerUnitSelect.value;
        if (unit === 'permanent') {
          item.expirationTimestamp = null;
          timerValueInput.disabled = true;
          li.querySelector('.timer-remaining').textContent = "";
        } else {
          timerValueInput.disabled = false;
          const value = parseInt(timerValueInput.value, 10);
          if (isNaN(value) || value < 1) return;
          let multiplier = 3600000; // hours
          if (unit === 'days') multiplier = 86400000;
          if (unit === 'weeks') multiplier = 604800000;
          item.expirationTimestamp = Date.now() + (value * multiplier);
        }
        li.dataset.expiration = item.expirationTimestamp || '';
        updateItemListener();
      };

      timerValueInput.addEventListener('input', onTimerChange);
      timerUnitSelect.addEventListener('change', onTimerChange);
      
      if (item.expirationTimestamp) {
          const remaining = item.expirationTimestamp - Date.now();
          const days = Math.floor(remaining / 86400000);
          if (days > 7) {
              timerUnitSelect.value = 'weeks';
              timerValueInput.value = Math.round(days / 7);
          } else if (days > 0) {
              timerUnitSelect.value = 'days';
              timerValueInput.value = days;
          } else {
              timerUnitSelect.value = 'hours';
              timerValueInput.value = Math.round(remaining / 3600000);
          }
          timerValueInput.disabled = false;
      } else {
          timerUnitSelect.value = 'permanent';
          timerValueInput.value = '';
          timerValueInput.disabled = true;
      }
    }

    function setupConfirmation(button, onConfirm) {
      let confirmTimeout;
    
      button.addEventListener('click', (e) => {
        e.stopPropagation();
    
        if (button.classList.contains('confirm-delete')) {
          clearTimeout(confirmTimeout);
          onConfirm();
        } else {
          document.querySelectorAll('.remove-btn.confirm-delete').forEach(btn => {
            btn.classList.remove('confirm-delete');
            btn.innerHTML = '<i class="fas fa-trash"></i>';
            btn.title = 'Delete';
          });
    
          button.classList.add('confirm-delete');
          button.innerHTML = '<i class="fas fa-check"></i>';
          button.title = 'Confirm';
    
          confirmTimeout = setTimeout(() => {
            button.classList.remove('confirm-delete');
            button.innerHTML = '<i class="fas fa-trash"></i>';
            button.title = 'Delete';
          }, 3000);
        }
      });
    }


    function handleAddKeyword() {
      const keywordText = keywordInput.value.trim().toLowerCase();
      if (!keywordText) return;

      const keywordObj = {
        text: keywordText,
        inTitle: true,
        inUrl: false,
        expirationTimestamp: null,
        deleteCookies: false,
        deleteDownloads: false,
        deleteStorage: false,
        clearExistingHistory: false,
        active: true
      };

      chrome.runtime.sendMessage({ action: 'addKeyword', keyword: keywordObj }, (res) => {
        if (res && res.success) {
          loadKeywords();
          keywordInput.value = '';
        }
      });
    }

    function loadKeywords() {
      chrome.runtime.sendMessage({ action: 'getKeywords' }, (res) => {
        if (!res || !res.keywords) return;
        keywordList.innerHTML = '';
        keywordCount.textContent = res.keywords.length;
        res.keywords.forEach(keywordObj => keywordList.appendChild(createKeywordElement(keywordObj)));
      });
    }

    function createKeywordElement(keywordObj) {
      const li = document.createElement('li');
      li.className = 'list-item-container';
      li.dataset.keyword = keywordObj.text;
      li.dataset.expiration = keywordObj.expirationTimestamp || '';

      const isActive = keywordObj.active !== false;

      li.innerHTML = `
        <div class="list-item-main">
          <div class="item-header">
            <button class="toggle-btn ${isActive ? 'active' : 'inactive'}" title="${isActive ? 'Deactivate' : 'Activate'}">
              <i class="fas fa-${isActive ? 'toggle-on' : 'toggle-off'}"></i>
            </button>
            <span class="url-text">${keywordObj.text}</span>
          </div>
          <div class="button-group">
            <button class="list-btn options-btn" title="Options"><i class="fas fa-ellipsis-v"></i></button>
            <button class="list-btn remove-btn" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="options-panel">
          <div class="checkbox-options" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px 15px; margin-bottom: 12px;">
            <label title="Delete page titles containing this keyword"><input type="checkbox" class="title-cb" ${keywordObj.inTitle ? 'checked' : ''}> Search in Title</label>
            <label title="Delete URLs containing this keyword"><input type="checkbox" class="url-cb" ${keywordObj.inUrl ? 'checked' : ''}> Search in URL</label>
            <label title="Also delete cookies for this keyword"><input type="checkbox" class="cookie-cb" ${keywordObj.deleteCookies ? 'checked' : ''}> Delete Cookies</label>
            <label title="Delete downloads for this keyword"><input type="checkbox" class="download-cb" ${keywordObj.deleteDownloads ? 'checked' : ''}> Delete Downloads</label>
            <label title="Delete Local/Session Storage for this keyword"><input type="checkbox" class="storage-cb" ${keywordObj.deleteStorage ? 'checked' : ''}> Delete Storage</label>
            <label title="Clear existing history for this keyword"><input type="checkbox" class="clear-history-cb" ${keywordObj.clearExistingHistory ? 'checked' : ''}> Clear Existing History</label>
          </div>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 8px 0;">
          <div class="timer-section" style="font-size: 12px; color: #555;">
            <div style="font-weight: 600; margin-bottom: 8px;">Set Duration</div>
            <div class="timer-input-group" style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
                <input type="number" class="timer-value timer-input" min="1">
                <select class="timer-unit timer-input">
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="permanent">Indefinite</option>
                </select>
            </div>
            <div class="timer-remaining" style="font-weight: 500; min-height: 18px; margin-top: 8px;"></div>
          </div>
        </div>
      `;
      setupKeywordElementListeners(li, keywordObj);
      return li;
    }

    function setupKeywordElementListeners(li, item) {
      const optionsBtn = li.querySelector('.options-btn');
      const optionsPanel = li.querySelector('.options-panel');
      const removeBtn = li.querySelector('.remove-btn');
      const toggleBtn = li.querySelector('.toggle-btn');
      const timerValueInput = li.querySelector('.timer-value');
      const timerUnitSelect = li.querySelector('.timer-unit');

      setupConfirmation(removeBtn, () => {
        chrome.runtime.sendMessage({ action: 'removeKeyword', keyword: item.text }, () => loadKeywords());
      });

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentActive = item.active !== false;
        item.active = !currentActive;
        toggleBtn.classList.toggle('active', item.active);
        toggleBtn.classList.toggle('inactive', !item.active);
        toggleBtn.innerHTML = `<i class="fas fa-${item.active ? 'toggle-on' : 'toggle-off'}"></i>`;
        toggleBtn.title = item.active ? 'Deactivate' : 'Activate';
        chrome.runtime.sendMessage({ action: 'updateKeyword', keyword: item });
      });

      optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllOptionsPanels(optionsPanel);
        optionsPanel.classList.toggle('open');
        optionsBtn.classList.toggle('active');
      });

      const updateListener = () => {
        item.inTitle = li.querySelector('.title-cb').checked;
        item.inUrl = li.querySelector('.url-cb').checked;
        item.deleteCookies = li.querySelector('.cookie-cb').checked;
        item.deleteDownloads = li.querySelector('.download-cb').checked;
        item.deleteStorage = li.querySelector('.storage-cb').checked;
        item.clearExistingHistory = li.querySelector('.clear-history-cb').checked;
        chrome.runtime.sendMessage({ action: 'updateKeyword', keyword: item });
      };

      li.querySelector('.title-cb').addEventListener('change', updateListener);
      li.querySelector('.url-cb').addEventListener('change', updateListener);
      li.querySelector('.cookie-cb').addEventListener('change', updateListener);
      li.querySelector('.download-cb').addEventListener('change', updateListener);
      li.querySelector('.storage-cb').addEventListener('change', updateListener);
      li.querySelector('.clear-history-cb').addEventListener('change', function() {
        if (this.checked) {
          const confirmed = confirm(`This action will delete ALL website history containing the keyword "${item.text}". This action cannot be undone.\n\nDo you want to continue?`);
          if (!confirmed) {
            this.checked = false;
            return;
          }
        }
        updateListener();
      });

      const onTimerChange = () => {
        const unit = timerUnitSelect.value;
        if (unit === 'permanent') {
          item.expirationTimestamp = null;
          timerValueInput.disabled = true;
          li.querySelector('.timer-remaining').textContent = "";
        } else {
          timerValueInput.disabled = false;
          const value = parseInt(timerValueInput.value, 10);
          if (isNaN(value) || value < 1) return;
          let multiplier = 3600000; // hours
          if (unit === 'days') multiplier = 86400000;
          if (unit === 'weeks') multiplier = 604800000;
          item.expirationTimestamp = Date.now() + (value * multiplier);
        }
        li.dataset.expiration = item.expirationTimestamp || '';
        updateListener();
      };

      timerValueInput.addEventListener('input', onTimerChange);
      timerUnitSelect.addEventListener('change', onTimerChange);
      
      if (item.expirationTimestamp) {
          const remaining = item.expirationTimestamp - Date.now();
          const days = Math.floor(remaining / 86400000);
          if (days >= 7) {
              timerUnitSelect.value = 'weeks';
              timerValueInput.value = Math.round(days / 7);
          } else if (days > 0) {
              timerUnitSelect.value = 'days';
              timerValueInput.value = days;
          } else {
              timerUnitSelect.value = 'hours';
              timerValueInput.value = Math.max(1, Math.round(remaining / 3600000));
          }
          timerValueInput.disabled = false;
      } else {
          timerUnitSelect.value = 'permanent';
          timerValueInput.value = '';
          timerValueInput.disabled = true;
      }
    }


    function handleClearAll() {
      const confirmation = confirm('Are you sure you want to delete all blocked URLs and keywords? This action cannot be undone.');
      if (confirmation) {
        chrome.runtime.sendMessage({ action: 'clearAllItems' }, (res) => {
          if (res && res.success) {
            loadUrls();
            loadKeywords();
          }
        });
      }
    }

    function handleExport() {
      chrome.runtime.sendMessage({ action: 'exportItems' }, (res) => {
        if (res && res.success) {
          const dataStr = JSON.stringify(res.data, null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `history_guard_backup_${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      });
    }

    function handleImport(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          chrome.runtime.sendMessage({ action: 'importItems', data }, (res) => {
            if (res && res.success) {
              loadUrls();
              loadKeywords();
            }
          });
        } catch (err) {

        }
      };
      reader.readAsText(file);
      event.target.value = '';
    }

    function closeAllOptionsPanels(exceptPanel = null) {
      document.querySelectorAll('.options-panel.open').forEach(panel => {
        if (panel !== exceptPanel) {
          panel.classList.remove('open');
          panel.previousElementSibling.querySelector('.options-btn').classList.remove('active');
        }
      });
    }
    
    function updateAllRemainingTimes() {
      document.querySelectorAll('.list-item-container').forEach(li => {
        const expiration = li.dataset.expiration ? parseInt(li.dataset.expiration, 10) : null;
        const remainingDiv = li.querySelector('.timer-remaining');
        if (!expiration || !remainingDiv) return;

        const now = Date.now();
        const remaining = expiration - now;

        if (remaining <= 0) {
          remainingDiv.textContent = 'Expired';
          remainingDiv.style.color = '#e74c3c';
          setTimeout(() => {
            if (document.body.contains(li)) {
              loadUrls();
              loadKeywords();
            }
          }, 2000);
          return;
        }

        remainingDiv.style.color = '#27ae60';
        const s = Math.floor((remaining / 1000) % 60);
        const m = Math.floor((remaining / 60000) % 60);
        const h = Math.floor((remaining / 3600000) % 24);
        const d = Math.floor(remaining / 86400000);

        if (d > 0) remainingDiv.textContent = `Remaining: ${d} days ${h} hours`;
        else if (h > 0) remainingDiv.textContent = `Remaining: ${h} hours ${m} min`;
        else if (m > 0) remainingDiv.textContent = `Remaining: ${m} min ${s} sec`;
        else remainingDiv.textContent = `Remaining: ${s} sec`;
      });
    }

    setInterval(updateAllRemainingTimes, 1000);
    init();
  } catch (error) {
    console.error('DOMContentLoaded error:', error);
    showError('Popup yüklenirken hata oluştu. Lütfen eklentiyi yeniden yükleyin.');
  }
});
