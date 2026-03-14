import { TRANSLATIONS } from './translations.js';

// Constants
const BUNDLE_SIZE = 100;
const BLOCK_SIZE = 30;
const ROLL_SIZE = 20;
const COIN_BLOCK_SIZE = 10;
const INFINITY = 1000000000;

// Currency denominations (banknotes)
const CURRENCIES = {
    'USD': [100, 50, 20, 10],
    'EUR': [100, 50, 20],
    'JPY': [10000, 5000, 1000],
    'GBP': [50, 20, 10, 5]
};

// Coin denominations per currency
const COIN_CURRENCIES = {
    'USD': [1, 0.50, 0.25, 0.10],
    'EUR': [2, 1, 0.50, 0.20],
    'JPY': [500, 100, 50, 10],
    'GBP': [2, 1, 0.50, 0.20]
};

// Scaling factors for integer math (cents) per currency
const COIN_SCALE = {
    'USD': 100,
    'EUR': 100,
    'JPY': 1,
    'GBP': 100
};

// Currency symbols
const CURRENCY_SYMBOLS = {
    'USD': '$',
    'EUR': '€',
    'JPY': '¥',
    'GBP': '£'
};

// Denomination colors (per currency, banknotes)
const DENOM_COLORS = {
    'USD': { 100: '#fbbf24', 50: '#f97316', 20: '#3b82f6', 10: '#10b981' },
    'EUR': { 100: '#fbbf24', 50: '#f97316', 20: '#3b82f6' },
    'JPY': { 10000: '#fbbf24', 5000: '#f97316', 1000: '#10b981' },
    'GBP': { 50: '#ef4444', 20: '#3b82f6', 10: '#10b981', 5: '#8b5cf6' }
};

// Denomination colors (per currency, coins)
const COIN_DENOM_COLORS = {
    'USD': { 1: '#fbbf24', 0.50: '#f97316', 0.25: '#3b82f6', 0.10: '#10b981' },
    'EUR': { 2: '#fbbf24', 1: '#f97316', 0.50: '#3b82f6', 0.20: '#10b981' },
    'JPY': { 500: '#fbbf24', 100: '#f97316', 50: '#3b82f6', 10: '#10b981' },
    'GBP': { 2: '#fbbf24', 1: '#f97316', 0.50: '#3b82f6', 0.20: '#10b981' }
};

function getDenomColor(denom, currency) {
    const cur = currency || currentCurrency;
    if (assetType === 'coins') {
        const colors = COIN_DENOM_COLORS[cur];
        return (colors && colors[denom]) || '#64748b';
    }
    const colors = DENOM_COLORS[cur];
    return (colors && colors[denom]) || '#64748b';
}

// Helper functions for asset-type-aware sizes
function getCurrentBundleSize() {
    return assetType === 'coins' ? ROLL_SIZE : BUNDLE_SIZE;
}

function getCurrentBlockSize() {
    return assetType === 'coins' ? COIN_BLOCK_SIZE : BLOCK_SIZE;
}

function getCurrentDenominations(currency) {
    const cur = currency || currentCurrency;
    return assetType === 'coins' ? COIN_CURRENCIES[cur] : CURRENCIES[cur];
}

// Format coin denomination for display (e.g. 0.50 -> "0.50", not "0.5")
function formatDenom(denom, currency) {
    const cur = currency || currentCurrency;
    const symbol = CURRENCY_SYMBOLS[cur] || cur;
    if (assetType === 'coins' && cur !== 'JPY') {
        // Format with 2 decimal places for fractional coins
        if (denom < 1) {
            return `${symbol}${denom.toFixed(2)}`;
        }
    }
    return `${symbol}${denom}`;
}

// Format large currency amounts compactly: 1500000 -> "1.5M", 75000 -> "75K"
function formatCompactAmount(value, currency) {
    const symbol = CURRENCY_SYMBOLS[currency] || '';
    if (value === 0) return '';
    const abs = Math.abs(value);
    let formatted;
    if (abs >= 1e9) {
        formatted = (value / 1e9).toFixed(abs >= 10e9 ? 0 : 1).replace(/\.0$/, '') + 'B';
    } else if (abs >= 1e6) {
        formatted = (value / 1e6).toFixed(abs >= 10e6 ? 0 : 1).replace(/\.0$/, '') + 'M';
    } else if (abs >= 1e4) {
        formatted = (value / 1e3).toFixed(abs >= 100e3 ? 0 : 1).replace(/\.0$/, '') + 'K';
    } else {
        formatted = value.toLocaleString();
    }
    return symbol + formatted;
}

// Recalculate and display stock subtotals per denomination and currency total
function updateStockSubtotals() {
    const bundleSize = getCurrentBundleSize();
    const currencies = ['USD', 'EUR', 'JPY', 'GBP'];

    currencies.forEach(currency => {
        let currencyTotal = 0;
        let hasAnyValue = false;

        document.querySelectorAll(`#stockMultiCurrency input[type="number"][data-currency="${currency}"]`).forEach(input => {
            const denom = parseFloat(input.dataset.denom);
            const rawValue = input.value;
            const subtotalCell = document.querySelector(`.stock-subtotal[data-denom="${input.dataset.denom}"][data-currency="${currency}"]`);
            if (!subtotalCell) return;

            if (rawValue === '' || rawValue === null) {
                // Unlimited — don't show subtotal
                subtotalCell.textContent = '∞';
                subtotalCell.classList.add('infinite');
            } else {
                const count = parseInt(rawValue) || 0;
                const bills = stockMode === 'bundles' ? count * bundleSize : count;
                const amount = bills * denom;
                currencyTotal += amount;
                hasAnyValue = true;
                subtotalCell.textContent = formatCompactAmount(amount, currency);
                subtotalCell.classList.remove('infinite');
            }
        });

        const totalCell = document.querySelector(`.stock-total-value[data-currency="${currency}"]`);
        if (totalCell) {
            if (hasAnyValue) {
                const symbol = CURRENCY_SYMBOLS[currency] || '';
                totalCell.textContent = symbol + currencyTotal.toLocaleString();
            } else {
                totalCell.textContent = '';
            }
        }
    });
}

// Internationalization

// Current language
let currentLang = 'en';

// Store last results to re-render on language change
let lastResults = null;

// Current settings
let currentCurrency = 'USD';
let displayOrder = 'denomination-first'; // 'denomination-first' or 'quantity-first'
let stockMode = 'bills'; // 'bundles' or 'bills'
let denominationOrder = 'high-to-low'; // 'high-to-low' or 'low-to-high'
let assetType = 'bills'; // 'bills' or 'coins'

// Calculation control
let stopCalculationRequested = false;
let isCalculating = false;

// Detect browser language
function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('en')) return 'en';
    if (browserLang.startsWith('ru')) return 'ru';
    return 'en'; // Default to English
}

// Initialize language
function initLanguage() {
    // Load all settings first
    loadSettings();
    applyLanguage(currentLang);
}

// Apply language
function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('cash-cleaner-lang', lang);
    
    // Update language buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Update all translatable elements
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (TRANSLATIONS[lang][key]) {
            element.textContent = TRANSLATIONS[lang][key];
        }
    });

    // Update tooltips
    document.querySelectorAll('[data-tooltip-i18n]').forEach(element => {
        const key = element.getAttribute('data-tooltip-i18n');
        if (TRANSLATIONS[lang][key]) {
            element.setAttribute('data-tooltip', TRANSLATIONS[lang][key]);
        }
    });

    // Update page title
    document.title = TRANSLATIONS[lang].title;
    
    // Re-render last results if they exist
    if (lastResults) {
        displayResults(lastResults);
    }
}

// Get translation
function t(key, params = {}) {
    let text = TRANSLATIONS[currentLang][key] || key;
    Object.keys(params).forEach(param => {
        text = text.replace(`{${param}}`, params[param]);
    });
    return text;
}

// Save settings to localStorage
function saveSettings() {
    const settings = {
        currency: currentCurrency,
        displayOrder: displayOrder,
        stockMode: stockMode,
        denominationOrder: denominationOrder,
        language: currentLang,
        assetType: assetType
    };
    localStorage.setItem('cash-cleaner-settings', JSON.stringify(settings));
}

// Load settings from localStorage
function loadSettings() {
    try {
        const saved = localStorage.getItem('cash-cleaner-settings');
        if (saved) {
            const settings = JSON.parse(saved);
            currentCurrency = settings.currency || 'USD';
            displayOrder = settings.displayOrder || 'denomination-first';
            stockMode = settings.stockMode || 'bills';
            denominationOrder = settings.denominationOrder || 'high-to-low';
            assetType = settings.assetType || 'bills';
            if (settings.language) {
                currentLang = settings.language;
            }
        } else {
            // First time user - detect browser language
            currentLang = detectBrowserLanguage();
        }
    } catch (e) {
        console.warn('Failed to load settings:', e);
        currentLang = detectBrowserLanguage();
    }
}

// Helper function to get currency from checkbox element
function getCurrencyFromCheckbox(checkbox) {
    try {
        const tableWrapper = checkbox.closest('.stock-table-wrapper');
        if (!tableWrapper) {
            console.warn('No table wrapper found for checkbox', checkbox);
            return 'USD';
        }
        
        const currencyHeader = tableWrapper.querySelector('.currency-header');
        if (!currencyHeader) {
            console.warn('No currency header found in table wrapper', tableWrapper);
            return 'USD';
        }
        
        const currencyText = currencyHeader.textContent;
        
        if (currencyText.includes('EUR')) return 'EUR';
        if (currencyText.includes('JPY')) return 'JPY';
        if (currencyText.includes('GBP')) return 'GBP';
        return 'USD'; // default
    } catch (e) {
        console.error('Error in getCurrencyFromCheckbox:', e);
        return 'USD';
    }
}

// Save stock data to localStorage
function saveStockData() {
    try {
        const storageKey = assetType === 'coins' ? 'cash-cleaner-coin-stock' : 'cash-cleaner-stock';
        // Get existing data or create new structure
        let allStockData = {};
        try {
            const existing = localStorage.getItem(storageKey);
            if (existing) {
                allStockData = JSON.parse(existing);
            }
        } catch (e) {
            console.warn('Failed to parse existing stock data:', e);
        }
        
        // Ensure we have the proper structure
        if (!allStockData.bundles) allStockData.bundles = { data: {}, enabled: {} };
        if (!allStockData.bills) allStockData.bills = { data: {}, enabled: {} };
        
        const currentModeData = allStockData[stockMode];
        
        // Save stock quantities for current mode
        currentModeData.data = {};
        document.querySelectorAll('#stockMultiCurrency input[type="number"]').forEach(input => {
        const denom = input.dataset.denom;
            const currency = input.dataset.currency;
        const value = input.value;
        if (value !== '') {
                const key = `${currency}_${denom}`;
                currentModeData.data[key] = value;
            }
        });
        
        // Save enabled states per currency
        currentModeData.enabled = {};
        document.querySelectorAll('#stockMultiCurrency input[type="checkbox"]').forEach(input => {
            const denom = input.dataset.denom;
            // Find which currency this checkbox belongs to
            const currency = getCurrencyFromCheckbox(input);
            const key = `${currency}_${denom}`;
            currentModeData.enabled[key] = input.checked;
        });
        
        // Also update the other mode's enabled states to keep them in sync
        const otherMode = stockMode === 'bundles' ? 'bills' : 'bundles';
        Object.keys(currentModeData.enabled).forEach(key => {
            allStockData[otherMode].enabled[key] = currentModeData.enabled[key];
        });
        
        localStorage.setItem(storageKey, JSON.stringify(allStockData));
    } catch (e) {
        console.error('Failed to save stock data:', e);
    }
}

// Load stock data from localStorage
function loadStockData() {
    try {
        const storageKey = assetType === 'coins' ? 'cash-cleaner-coin-stock' : 'cash-cleaner-stock';
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const allStockData = JSON.parse(saved);
            let dataToLoad = {};
            let enabledStates = {};
            
            // Handle different data formats
            if (allStockData.bundles && allStockData.bills) {
                // New format with separate modes
                const currentModeData = allStockData[stockMode];
                if (currentModeData) {
                    dataToLoad = currentModeData.data || {};
                    enabledStates = currentModeData.enabled || {};
                }
            } else if (allStockData.mode !== undefined) {
                // Old format with single mode
                if (allStockData.mode === stockMode) {
                    dataToLoad = allStockData.data || {};
                    enabledStates = allStockData.enabled || {};
                }
            } else {
                // Legacy format - try to map old data
                Object.keys(allStockData).forEach(key => {
                    if (key.includes('_')) {
                        // Already has currency prefix
                        dataToLoad[key] = allStockData[key];
                    } else {
                        // No currency prefix - assume it's for current currency
                        dataToLoad[`${currentCurrency}_${key}`] = allStockData[key];
                    }
                });
            }
            
            // Apply to inputs after they're created
            setTimeout(() => {
                // Load stock quantities
                Object.keys(dataToLoad).forEach(key => {
                    let input;
                    if (key.includes('_')) {
                        // Format: currency_denomination
                        const [currency, denom] = key.split('_');
                        input = document.querySelector(`#stockMultiCurrency input[type="number"][data-denom="${denom}"][data-currency="${currency}"]`);
                    } else {
                        // Legacy format: just denomination
                        input = document.querySelector(`#stockMultiCurrency input[type="number"][data-denom="${key}"][data-currency="${currentCurrency}"]`);
                    }
                    if (input) {
                        input.value = dataToLoad[key];
                    }
                });
                
                // Load enabled states
                Object.keys(enabledStates).forEach(key => {
                    if (key.includes('_')) {
                        // New format: currency_denomination
                        const [currency, denom] = key.split('_');
                        const checkboxes = document.querySelectorAll(`#stockMultiCurrency input[type="checkbox"][data-denom="${denom}"]`);
                        checkboxes.forEach(checkbox => {
                            // Verify this checkbox belongs to the correct currency
                            const checkboxCurrency = getCurrencyFromCheckbox(checkbox);
                            
                            if (checkboxCurrency === currency) {
                                checkbox.checked = enabledStates[key];
                                // Apply visual state
                                const row = checkbox.closest('tr');
                                if (row) {
                                    if (enabledStates[key]) {
                                        row.style.opacity = '1';
                                        row.querySelectorAll('input[type="number"]').forEach(input => {
                                            input.disabled = false;
                                        });
                                    } else {
                                        row.style.opacity = '0.5';
                                        row.querySelectorAll('input[type="number"]').forEach(input => {
                                            input.disabled = true;
                                        });
                                    }
                                }
                            }
                        });
                    } else {
                        // Legacy format: just denomination - apply to all currencies
                        const denom = key;
                        const checkboxes = document.querySelectorAll(`#stockMultiCurrency input[type="checkbox"][data-denom="${denom}"]`);
                        checkboxes.forEach(checkbox => {
                            if (checkbox) {
                                checkbox.checked = enabledStates[key];
                                // Apply visual state
                                const row = checkbox.closest('tr');
                                if (row) {
                                    if (enabledStates[key]) {
                                        row.style.opacity = '1';
                                        row.querySelectorAll('input[type="number"]').forEach(input => {
                                            input.disabled = false;
                                        });
                                    } else {
                                        row.style.opacity = '0.5';
                                        row.querySelectorAll('input[type="number"]').forEach(input => {
                                            input.disabled = true;
                                        });
                                    }
                                }
                            }
                        });
                    }
                });
                
                // Set default values for checkboxes that weren't found in saved data
                document.querySelectorAll('#stockMultiCurrency input[type="checkbox"]').forEach(checkbox => {
                    const denom = checkbox.dataset.denom;
                    const currency = getCurrencyFromCheckbox(checkbox);
                    const key = `${currency}_${denom}`;
                    
                    // If this checkbox state wasn't loaded from saved data, set it to default (enabled)
                    if (!(key in enabledStates)) {
                        checkbox.checked = true;
                        // Apply visual state
                        const row = checkbox.closest('tr');
                        if (row) {
                            row.style.opacity = '1';
                            row.querySelectorAll('input[type="number"]').forEach(input => {
                                input.disabled = false;
                            });
                        }
                    }
                });
                updateStockSubtotals();
            }, 100);
        }
    } catch (e) {
        console.warn('Failed to load stock data:', e);
    }
}

// ====================================================================
// WEB WORKER
// ====================================================================

let calculationWorker = null;

function createWorker() {
    return new Worker('js/worker.js');
}

// ====================================================================
// UI LOGIC
// ====================================================================

// Update stock inputs when currency changes
function updateStockInputs() {
    const stockMultiCurrency = document.getElementById('stockMultiCurrency');
    
    // Update title and tooltip based on stock mode
    const stockTitle = document.getElementById('stockTitle');
    const stockTooltip = document.getElementById('stockTooltip');
    
    if (assetType === 'coins') {
        if (stockMode === 'bundles') {
            stockTitle.textContent = t('rollStock');
            stockTooltip.setAttribute('data-tooltip', t('stockTooltip'));
        } else {
            stockTitle.textContent = t('looseCoinStock');
            stockTooltip.setAttribute('data-tooltip', t('stockTooltipBills'));
        }
    } else {
        if (stockMode === 'bundles') {
            stockTitle.textContent = t('stockRemaining');
            stockTooltip.setAttribute('data-tooltip', t('stockTooltip'));
        } else {
            stockTitle.textContent = t('stockRemainingBills');
            stockTooltip.setAttribute('data-tooltip', t('stockTooltipBills'));
        }
    }
    
    // Create multi-currency table
    createMultiCurrencyTable();
    
    // Update stock mode buttons
    updateStockModeButtons();
    updateDenominationOrderButtons();
    
    // Load saved stock data for current mode
    loadStockData();
}

// Create multi-currency stock table
function createMultiCurrencyTable() {
    const stockMultiCurrency = document.getElementById('stockMultiCurrency');
    
    // Create container for three separate tables
    const tablesContainer = document.createElement('div');
    tablesContainer.className = 'stock-tables-container';
    
    // Create tables for each currency
    ['USD', 'EUR', 'JPY', 'GBP'].forEach(currency => {
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'stock-table-wrapper';
        tableWrapper.dataset.currency = currency;
        
        // Currency header
        const currencyHeader = document.createElement('div');
        currencyHeader.className = 'currency-header';
        const flagMap = { 'USD': '🇺🇸', 'EUR': '🇪🇺', 'JPY': '🇯🇵', 'GBP': '🇬🇧' };
        const flag = flagMap[currency] || '🏳️';
        currencyHeader.innerHTML = `${flag} ${CURRENCY_SYMBOLS[currency]} ${currency}`;
        
        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.className = 'table-container';
        
        // Create table
        const table = document.createElement('table');
        table.className = 'stock-table-single';
        
        // Create header
        // const headerRow = document.createElement('tr');
        // headerRow.innerHTML = `
        //     <th style="width: 40px;"></th>
        //     <th style="width: 120px;">${t('denominationValue')}</th>
        //     <th>${stockMode === 'bundles' ? t('bundles') : t('bills')}</th>
        // `;
        // table.appendChild(headerRow);
        
        // Get denominations for this currency based on asset type and sort them
        const denomSource = assetType === 'coins' ? COIN_CURRENCIES : CURRENCIES;
        const denominations = [...denomSource[currency]].sort((a, b) =>
            denominationOrder === 'high-to-low' ? b - a : a - b
        );

        // Create rows for each denomination
        denominations.forEach(denom => {
            const row = document.createElement('tr');

            // Enabled checkbox cell
            const enabledCell = document.createElement('td');
            enabledCell.className = 'enabled-cell';
            enabledCell.innerHTML = `
                <div class="enabled-checkbox">
                    <input type="checkbox" id="enabled_${denom}_${currency}"
                           data-denom="${denom}"
                           data-type="enabled"
                           checked>
                    <label for="enabled_${denom}_${currency}" class="checkbox-label">
                        <i class="fas fa-check" aria-hidden="true"></i>
                    </label>
                </div>
            `;
            row.appendChild(enabledCell);

            // Denomination cell with badge
            const denomCell = document.createElement('td');
            denomCell.innerHTML = `
                <div class="denom-label" style="background-color: ${getDenomColor(denom, currency)};">
                    ${formatDenom(denom, currency)}
            </div>
        `;
            row.appendChild(denomCell);

            // Stock input cell
            const stockCell = document.createElement('td');
            stockCell.className = 'stock-cell';
            stockCell.innerHTML = `
                <input type="number" min="0" placeholder="∞"
                       data-denom="${denom}"
                       data-currency="${currency}"
                       data-mode="${stockMode}">
                <div class="stock-cell-spinner">
                    <button type="button" class="stock-cell-spinner-btn"
                            data-action="up" data-denom="${denom}" data-currency="${currency}">▲</button>
                    <button type="button" class="stock-cell-spinner-btn"
                            data-action="down" data-denom="${denom}" data-currency="${currency}">▼</button>
                </div>
            `;
            row.appendChild(stockCell);

            // Denomination subtotal cell
            const subtotalCell = document.createElement('td');
            subtotalCell.className = 'stock-subtotal';
            subtotalCell.dataset.denom = denom;
            subtotalCell.dataset.currency = currency;
            row.appendChild(subtotalCell);

            row.dataset.denom = denom;
            table.appendChild(row);
        });

        // Currency total footer
        const totalRow = document.createElement('tr');
        totalRow.className = 'stock-total-row';
        totalRow.innerHTML = `
            <td colspan="3" class="stock-total-label">${CURRENCY_SYMBOLS[currency]}</td>
            <td class="stock-total-value" data-currency="${currency}"></td>
        `;
        table.appendChild(totalRow);

        tableContainer.appendChild(table);
        tableWrapper.appendChild(currencyHeader);
        tableWrapper.appendChild(tableContainer);
        tablesContainer.appendChild(tableWrapper);
    });
    
    stockMultiCurrency.innerHTML = '';
    stockMultiCurrency.appendChild(tablesContainer);
}

// Update stock mode buttons display
function updateStockModeButtons() {
    document.querySelectorAll('#stockModeSwitch .order-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === stockMode);
    });
}

// Update denomination order buttons display
function updateDenominationOrderButtons() {
    document.querySelectorAll('#denominationOrderSwitch .order-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.order === denominationOrder);
    });
}

// Update asset type buttons display
function updateAssetTypeButtons() {
    document.querySelectorAll('#assetTypeSwitch .order-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.asset === assetType);
    });
}

// Create currency buttons
function createCurrencyButtons() {
    const container = document.getElementById('currencyButtons');
    container.innerHTML = '';
    
    const currencies = [
        { code: 'USD', flag: '🇺🇸' },
        { code: 'EUR', flag: '🇪🇺' },
        { code: 'JPY', flag: '🇯🇵' },
        { code: 'GBP', flag: '🇬🇧' }
    ];
    
    currencies.forEach(currency => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'currency-btn';
        button.dataset.currency = currency.code;
        button.innerHTML = `
            <span class="currency-flag">${currency.flag}</span>
            <span class="currency-code">${CURRENCY_SYMBOLS[currency.code]} ${currency.code}</span>
        `;
        container.appendChild(button);
        
        // Add event listener
        button.addEventListener('click', () => {
            currentCurrency = currency.code;
            updateCurrencyButtons();
            updateCurrencyBackground();
            saveSettings();
        });
    });
}

// Update currency buttons display
function updateCurrencyButtons() {
    document.querySelectorAll('.currency-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.currency === currentCurrency);
    });

    // Highlight active stock table
    document.querySelectorAll('.stock-table-wrapper').forEach(wrapper => {
        wrapper.classList.toggle('active', wrapper.dataset.currency === currentCurrency);
    });

    // Update currency indicator in amount field
    const currencyIndicator = document.getElementById('currencyIndicator');
    if (currencyIndicator) {
        currencyIndicator.textContent = CURRENCY_SYMBOLS[currentCurrency];
    }
    
    // Update amount field placeholder with currency-specific example
    const amountField = document.getElementById('amount');
    if (amountField) {
        if (assetType === 'coins') {
            const coinExamples = {
                'USD': '50',
                'EUR': '100',
                'JPY': '50000',
                'GBP': '50'
            };
            amountField.placeholder = coinExamples[currentCurrency] || '50';
            amountField.step = currentCurrency === 'JPY' ? '1' : '0.01';
        } else {
            const examples = {
                'USD': '85000',
                'EUR': '75000',
                'JPY': '8500000',
                'GBP': '50000'
            };
            amountField.placeholder = examples[currentCurrency] || '85000';
            amountField.step = '1';
        }
    }
}

// Update background based on currency and asset type
function updateCurrencyBackground() {
    // Remove all currency classes
    document.body.classList.remove('currency-usd', 'currency-eur', 'currency-jpy', 'currency-gbp');

    // Add current currency class
    document.body.classList.add(`currency-${currentCurrency.toLowerCase()}`);

    // Toggle asset-coins class for coin backgrounds
    document.body.classList.toggle('asset-coins', assetType === 'coins');
}

// Update display order buttons
function updateDisplayOrderButtons() {
    document.querySelectorAll('#displayOrderSwitch .order-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.order === displayOrder);
    });
}

// Format number with thousands separator
function formatNumber(num) {
    return num.toLocaleString();
}

// Format currency with symbol
function formatCurrency(amount, currency) {
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return `${symbol}${formatNumber(amount)}`;
}

// Get denomination color class
const COLOR_TO_NAME = {
    '#fbbf24': 'yellow',
    '#f97316': 'orange',
    '#3b82f6': 'blue',
    '#10b981': 'green',
    '#ef4444': 'red',
    '#8b5cf6': 'purple'
};

function getDenomClass(denom, currency) {
    const hex = getDenomColor(denom, currency);
    const name = COLOR_TO_NAME[hex];
    return name ? `denom-${name}` : '';
}

// Render a single variant (for progressive display)
function renderVariant(container, variant, currency) {
    const isIdeal = variant.type === 'ideal';
    const variantClass = isIdeal ? 'ideal' : 'loose';
    const isCoins = assetType === 'coins';
    const bundleLabel = isCoins ? t('rollsText') : t('bundlesText');
    const itemLabel = isCoins ? t('coinsText') : 'bills';

    let variantTypeText = isIdeal ? t('idealBlocks', {count: variant.blocks}) : t('partialBlocks', {count: variant.blocks});

    const variantDiv = document.createElement('div');
    variantDiv.className = `variant ${variantClass}`;
    variantDiv.style.cursor = 'pointer';
    variantDiv.style.animation = 'fadeIn 0.3s ease-out';
    variantDiv.title = 'Click to visualize structure';
    variantDiv.onclick = () => showBlockVisualization(variant);

    let breakdownHTML = '';
    variant.breakdown.forEach(item => {
        let denomDisplay = '';
        let typeIcon = '';
        const denomLabel = formatDenom(item.denomination, currency);

        if (item.type === 'partial') {
            typeIcon = '<i class="fas fa-asterisk" style="color: orange; margin-right: 4px;" title="Partial pack"></i>';
            if (displayOrder === 'denomination-first') {
                denomDisplay = `
                    ${typeIcon}
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${denomLabel}
                    </span>
                    × ${item.bills}/${getCurrentBundleSize()} ${itemLabel} (partial pack)
                `;
            } else {
                denomDisplay = `
                    ${typeIcon}${item.bills}/${getCurrentBundleSize()} ${itemLabel} ×
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${denomLabel}
                    </span>
                    (partial pack)
                `;
            }
        } else {
            if (displayOrder === 'denomination-first') {
                denomDisplay = `
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${denomLabel}
                    </span>
                    × ${item.bundles} ${bundleLabel}
                `;
            } else {
                denomDisplay = `
                    ${item.bundles} ${bundleLabel} ×
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${denomLabel}
                    </span>
                `;
            }
        }
        
        breakdownHTML += `
            <div class="breakdown-item" style="border-left-color: ${getDenomColor(item.denomination)};">
                <div class="denom">
                    ${denomDisplay}
                </div>
                <div class="value">
                    ${formatCurrency(item.value, currency)}
                </div>
            </div>
        `;
    });
    
    variantDiv.innerHTML = `
        <div class="variant-header">
            <div class="variant-type">
                <i class="fas fa-${isIdeal ? 'cubes' : 'layer-group'}"></i>
                ${variantTypeText}
                <i class="fas fa-eye" style="margin-left: 8px; opacity: 0.7; font-size: 0.8em;"></i>
            </div>
            <div class="variant-total">
                ${formatCurrency(variant.total_value, currency)}
            </div>
        </div>
        <div class="breakdown">
            ${breakdownHTML}
        </div>
    `;
    
    container.appendChild(variantDiv);
}

// Display results
function displayResults(data) {
    const resultsDiv = document.getElementById('results');
    const displayOrderSwitch = document.getElementById('displayOrderSwitch');
    
    // Store results for language switching
    lastResults = data;
    
    if (data.error) {
        displayOrderSwitch.style.display = 'none';
        resultsDiv.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>${t('error')}</strong> ${data.error}
            </div>
        `;
        return;
    }

    // Show display order switch
    displayOrderSwitch.style.display = 'flex';
    
    let html = '';
    
    const isCoins = data.asset_type === 'coins';
    const idealDescKey = isCoins ? 'idealBlocksDescCoins' : 'idealBlocksDesc';
    const looseDescKey = isCoins ? 'looseBundlesDescCoins' : 'looseBundlesDesc';
    const partialFoundKey = isCoins ? 'partialRollsFound' : 'partialBundlesFound';
    const partialDescKey = isCoins ? 'partialRollsDesc' : 'partialBundlesDesc';
    const bundleLabel = isCoins ? t('rollsText') : t('bundlesText');
    const itemLabel = isCoins ? t('coinsText') : 'bills';

    if (data.has_ideal) {
        html += `
            <div class="success">
                <i class="fas fa-check-circle"></i>
                <strong>${t('idealBlocksFound')}</strong>
                ${t(idealDescKey, {blockSize: data.block_size, bundleSize: data.bundle_size})}
            </div>
        `;
    } else if (data.has_loose) {
        html += `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>${t('idealBlocksNotAvailable')}</strong>
                ${t(looseDescKey)}
            </div>
        `;
    } else if (data.has_partial) {
        html += `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>${t(partialFoundKey)}</strong>
                ${t(partialDescKey)}
            </div>
        `;
    }

    data.variants.forEach((variant, index) => {
        const isIdeal = variant.type === 'ideal';
        const variantClass = isIdeal ? 'ideal' : 'loose';

        let variantTypeText = isIdeal ? t('idealBlocks', {count: variant.blocks}) : t('partialBlocks', {count: variant.blocks});

        html += `
            <div class="variant ${variantClass}" style="cursor: pointer;" data-variant-index="${index}" title="Click to visualize structure">
                <div class="variant-header">
                    <div class="variant-type">
                        <i class="fas fa-${isIdeal ? 'cubes' : 'layer-group'}"></i>
                        ${variantTypeText}
                        <i class="fas fa-eye" style="margin-left: 8px; opacity: 0.7; font-size: 0.8em;"></i>
                    </div>
                    <div class="variant-total">
                        ${formatCurrency(variant.total_value, data.currency)}
                    </div>
                </div>
                <div class="breakdown">
        `;

        variant.breakdown.forEach(item => {
            let denomDisplay = '';
            let typeIcon = '';
            const denomLbl = formatDenom(item.denomination, data.currency);

            if (item.type === 'partial') {
                typeIcon = '<i class="fas fa-asterisk" style="color: orange; margin-right: 4px;" title="Partial pack"></i>';
                if (displayOrder === 'denomination-first') {
                    denomDisplay = `
                        ${typeIcon}
                        <span class="denom-badge ${getDenomClass(item.denomination)}">
                            ${denomLbl}
                        </span>
                        × ${item.bills}/${getCurrentBundleSize()} ${itemLabel} (partial pack)
                    `;
                } else {
                    denomDisplay = `
                        ${typeIcon}${item.bills}/${getCurrentBundleSize()} ${itemLabel} ×
                        <span class="denom-badge ${getDenomClass(item.denomination)}">
                            ${denomLbl}
                        </span>
                        (partial pack)
                    `;
                }
            } else {
            if (displayOrder === 'denomination-first') {
                denomDisplay = `
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${denomLbl}
                    </span>
                    × ${item.bundles} ${bundleLabel}
                `;
            } else {
                denomDisplay = `
                    ${item.bundles} ${bundleLabel} ×
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${denomLbl}
                    </span>
                `;
                }
            }
            
            html += `
                <div class="breakdown-item" style="border-left-color: ${getDenomColor(item.denomination)};">
                    <div class="denom">
                        ${denomDisplay}
                    </div>
                    <div class="value">
                        ${formatCurrency(item.value, data.currency)}
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });

    resultsDiv.innerHTML = html;

    // Bind click handlers for variant visualization
    resultsDiv.querySelectorAll('.variant[data-variant-index]').forEach(el => {
        const idx = parseInt(el.dataset.variantIndex);
        el.onclick = () => showBlockVisualization(data.variants[idx]);
    });

    // Update display order buttons
    updateDisplayOrderButtons();
}

// Form submission handler
document.getElementById('calculatorForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Check if we need to stop calculation
    if (isCalculating) {
        // Terminate worker immediately
        if (calculationWorker) {
            calculationWorker.terminate();
            calculationWorker = null;
        }
        
        // Reset state
        isCalculating = false;
        stopCalculationRequested = true;
        
        // Reset button
        const calculateBtn = document.getElementById('calculateBtn');
        calculateBtn.classList.remove('stop-btn');
        calculateBtn.innerHTML = `<i class="fas fa-calculator"></i> ${t('calculateBtn')}`;
        
        // Update results to show stopped state
        const resultsDiv = document.getElementById('results');
        const statusDiv = resultsDiv.querySelector('.success, .error');
        if (statusDiv) {
            const variantCounter = document.getElementById('variantCounter');
            const variantText = variantCounter ? variantCounter.textContent : t('foundVariants', {count: 0});
            
            statusDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <strong>${t('calculationStopped')}</strong> 
                ${variantText}
            `;
            statusDiv.className = 'error';
        }
        
        // Mark results as stopped
        if (lastResults) {
            lastResults.stopped = true;
        }
        
        return;
    }
    
    // Reset flags
    stopCalculationRequested = false;
    isCalculating = true;
    
    const amount = parseFloat(document.getElementById('amount').value);
    const maxVariants = parseInt(document.getElementById('maxVariants').value);
    const currentBundleSize = getCurrentBundleSize();
    const currentBlockSize = getCurrentBlockSize();

    // Collect stock data for current currency only, excluding disabled denominations
    const stock = {};
    document.querySelectorAll(`#stockMultiCurrency input[type="number"][data-currency="${currentCurrency}"]`).forEach(input => {
        const denom = input.dataset.denom;
        const value = input.value;

        // Check if this denomination is enabled for current currency
        const enabledCheckboxes = document.querySelectorAll(`#stockMultiCurrency input[type="checkbox"][data-denom="${denom}"]`);
        let isEnabled = true; // default

        // Find the checkbox for the current currency
        enabledCheckboxes.forEach(checkbox => {
            const checkboxCurrency = getCurrencyFromCheckbox(checkbox);
            if (checkboxCurrency === currentCurrency) {
                isEnabled = checkbox.checked;
            }
        });

        if (isEnabled && value !== '') {
            // Convert individual items to rolls/bundles if in bills/coins mode
            if (stockMode === 'bills') {
                stock[denom] = Math.floor(parseInt(value) / currentBundleSize);
            } else {
                stock[denom] = parseInt(value);
            }
        } else if (!isEnabled) {
            stock[denom] = 0;
        }
    });
    
    // Save stock data
    saveStockData();
    
    // Prepare UI
    const resultsDiv = document.getElementById('results');
    const calculateBtn = document.getElementById('calculateBtn');
    const displayOrderSwitch = document.getElementById('displayOrderSwitch');
    
    // Initialize result structure
        const result = {
            success: true,
            amount: amount,
        currency: currentCurrency,
            bundle_size: currentBundleSize,
            block_size: currentBlockSize,
            asset_type: assetType,
            has_ideal: false,
            has_loose: false,
            has_partial: false,
            variants: []
        };
        
    // Clear last results
    lastResults = null;
    
    // Show initial loading state
    displayOrderSwitch.style.display = 'none';
    resultsDiv.innerHTML = `
        <div class="success">
            <i class="fas fa-search"></i>
            <strong>${t('calculating')}</strong> 
            <span id="variantCounter">${t('foundVariants', {count: 0})}</span>
        </div>
        <div id="progressiveResults"></div>
    `;
    
    // Change button to Stop
    calculateBtn.classList.add('stop-btn');
    calculateBtn.innerHTML = `<i class="fas fa-stop"></i> ${t('stopCalculation')}`;
    
    // Get references
    const progressiveResultsDiv = document.getElementById('progressiveResults');
    const variantCounter = document.getElementById('variantCounter');
    const denomSource = assetType === 'coins' ? COIN_CURRENCIES : CURRENCIES;
    const denoms = [...denomSource[currentCurrency]].sort((a, b) => b - a);
    const scaleFactor = assetType === 'coins' ? (COIN_SCALE[currentCurrency] || 1) : 1;

    // Validate inputs
    if (isNaN(amount) || amount <= 0) {
        displayResults({error: 'Amount must be positive'});
        isCalculating = false;
        calculateBtn.classList.remove('stop-btn');
        calculateBtn.innerHTML = `<i class="fas fa-calculator"></i> ${t('calculateBtn')}`;
        return;
    }

    if (!denomSource[currentCurrency]) {
        displayResults({error: `Currency ${currentCurrency} not supported`});
        isCalculating = false;
        calculateBtn.classList.remove('stop-btn');
        calculateBtn.innerHTML = `<i class="fas fa-calculator"></i> ${t('calculateBtn')}`;
        return;
    }

    // Convert stock data - keep denom keys as original floats for coins
    const bundlesStock = {};
    if (stock) {
        Object.keys(stock).forEach(denomStr => {
            const denom = parseFloat(denomStr);
            const qty = parseInt(stock[denomStr]);
            if (!isNaN(qty)) {
                bundlesStock[denom] = qty;
            }
        });
    }
    
    // Create and configure worker
    calculationWorker = createWorker();
    
    // Handle worker messages
    calculationWorker.onmessage = function(e) {
        const { type, data } = e.data;
        
        if (type === 'solution') {
            // Check if we already have enough variants
            if (result.variants.length >= maxVariants) {
                // Stop worker - we have enough
                if (calculationWorker) {
                    calculationWorker.terminate();
                    calculationWorker = null;
                    isCalculating = false;
                }
                return;
            }
            
            // Process solution and render immediately
            const { solution, variantType } = data;
            
            // Convert raw solution to variant
            let variant;
            if (variantType === 'ideal') {
                const [blocks, bundleCounts] = solution;
                variant = {
                    type: 'ideal',
                    blocks: blocks,
                    total_bundles: blocks * currentBlockSize,
                    breakdown: []
                };

                let totalValue = 0;
                bundleCounts.forEach((count, i) => {
                    if (count > 0) {
                        const denom = denoms[i];
                        const value = denom * count * currentBundleSize;
                        totalValue += value;
                        variant.breakdown.push({
                            denomination: denom,
                            bundles: count,
                                value: value,
                                bills: count * currentBundleSize
                        });
                    }
                });
                variant.total_value = totalValue;
            } else if (variantType === 'loose') {
                const bundleCounts = solution;
                    const totalBundles = bundleCounts.reduce((sum, c) => sum + c, 0);
                variant = {
                        type: 'loose',
                        blocks: Math.ceil(totalBundles / currentBlockSize),
                        total_bundles: totalBundles,
                        breakdown: []
                    };

                    let totalValue = 0;
                    bundleCounts.forEach((count, i) => {
                        if (count > 0) {
                            const denom = denoms[i];
                            const value = denom * count * currentBundleSize;
                            totalValue += value;
                            variant.breakdown.push({
                                denomination: denom,
                                bundles: count,
                                    value: value,
                                    bills: count * currentBundleSize
                            });
                        }
                    });
                    variant.total_value = totalValue;
            } else if (variantType === 'partial') {
                const billCounts = solution;
                variant = {
                        type: 'partial',
                        blocks: 0,
                        total_bundles: 0,
                        breakdown: []
                    };

                    let totalValue = 0;
                    let totalBundles = 0;

                    billCounts.forEach((count, i) => {
                        if (count > 0) {
                            const denom = denoms[i];
                            const value = denom * count;
                            totalValue += value;

                            const fullBundles = Math.floor(count / currentBundleSize);
                            const partialBills = count % currentBundleSize;

                            if (fullBundles > 0) {
                                variant.breakdown.push({
                                    denomination: denom,
                                    bundles: fullBundles,
                                    value: denom * fullBundles * currentBundleSize,
                                    bills: fullBundles * currentBundleSize,
                                    type: 'full'
                                });
                                totalBundles += fullBundles;
                            }

                            if (partialBills > 0) {
                                variant.breakdown.push({
                                    denomination: denom,
                                    bundles: 0,
                                    value: denom * partialBills,
                                    bills: partialBills,
                                    type: 'partial'
                                });
                            }
                        }
                    });

                    variant.total_value = totalValue;
                    variant.total_bundles = totalBundles;
                    variant.blocks = Math.ceil(totalBundles / currentBlockSize);
            }
            
            // Add to results
                    result.variants.push(variant);
            
            // Update counter
            variantCounter.textContent = t('foundVariants', {count: result.variants.length});
            
            // Render immediately (no RAF needed - worker is async!)
            renderVariant(progressiveResultsDiv, variant, result.currency);
            
            // Check if we've reached the limit after adding this variant
            if (result.variants.length >= maxVariants) {
                // Stop worker - we have enough
                if (calculationWorker) {
                    calculationWorker.terminate();
                    calculationWorker = null;
                    isCalculating = false;
                    
                    // Update UI to show we've reached the limit
                    result.has_ideal = result.variants.some(v => v.type === 'ideal');
                    result.has_loose = result.variants.some(v => v.type === 'loose');
                    result.has_partial = result.variants.some(v => v.type === 'partial');
                    
                    // Store results
                    lastResults = result;
                    
                    // Show display order switch
                    displayOrderSwitch.style.display = 'flex';
                    
                    // Update final status message
                    const statusDiv = resultsDiv.querySelector('.success, .error');
                    if (statusDiv) {
                        const _isCoins = result.asset_type === 'coins';
                        const _idealDesc = _isCoins ? 'idealBlocksDescCoins' : 'idealBlocksDesc';
                        const _looseDesc = _isCoins ? 'looseBundlesDescCoins' : 'looseBundlesDesc';
                        const _partialFound = _isCoins ? 'partialRollsFound' : 'partialBundlesFound';
                        const _partialDesc = _isCoins ? 'partialRollsDesc' : 'partialBundlesDesc';
                        if (result.has_ideal) {
                            statusDiv.innerHTML = `
                                <i class="fas fa-check-circle"></i>
                                <strong>${t('idealBlocksFound')}</strong>
                                ${t(_idealDesc, {blockSize: result.block_size, bundleSize: result.bundle_size})}
                                <br>
                                ${variantCounter.textContent}
                            `;
                            statusDiv.className = 'success';
                        } else if (result.has_loose) {
                            statusDiv.innerHTML = `
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong>${t('idealBlocksNotAvailable')}</strong>
                                ${t(_looseDesc)}
                                <br>
                                ${variantCounter.textContent}
                            `;
                            statusDiv.className = 'error';
                        } else if (result.has_partial) {
                            statusDiv.innerHTML = `
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong>${t(_partialFound)}</strong>
                                ${t(_partialDesc)}
                                <br>
                                ${variantCounter.textContent}
                            `;
                            statusDiv.className = 'error';
                        }
                    }

                    // Update display order buttons
                    updateDisplayOrderButtons();

                    // Reset button
                    calculateBtn.classList.remove('stop-btn');
                    calculateBtn.innerHTML = `<i class="fas fa-calculator"></i> ${t('calculateBtn')}`;
                }
            }

        } else if (type === 'complete') {
            // Calculation finished
            const { hasIdeal, hasLoose, hasPartial, stopped } = data;

            // If worker was already terminated (due to maxVariants limit), ignore this message
            if (!calculationWorker && !isCalculating) {
                return;
            }

            result.has_ideal = hasIdeal;
            result.has_loose = hasLoose;
            result.has_partial = hasPartial;
            result.stopped = stopped;

            // Store and display final results
            lastResults = result;

            // Show display order switch
            displayOrderSwitch.style.display = 'flex';

            // Update final status message
            const statusDiv = resultsDiv.querySelector('.success, .error');
            if (statusDiv) {
                const _isCoins = result.asset_type === 'coins';
                const _idealDesc = _isCoins ? 'idealBlocksDescCoins' : 'idealBlocksDesc';
                const _looseDesc = _isCoins ? 'looseBundlesDescCoins' : 'looseBundlesDesc';
                const _partialFound = _isCoins ? 'partialRollsFound' : 'partialBundlesFound';
                const _partialDesc = _isCoins ? 'partialRollsDesc' : 'partialBundlesDesc';
                if (result.stopped) {
                    statusDiv.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>${t('calculationStopped')}</strong>
                        ${variantCounter.textContent}
                    `;
                    statusDiv.className = 'error';
                } else if (result.has_ideal) {
                    statusDiv.innerHTML = `
                        <i class="fas fa-check-circle"></i>
                        <strong>${t('idealBlocksFound')}</strong>
                        ${t(_idealDesc, {blockSize: result.block_size, bundleSize: result.bundle_size})}
                        <br>
                        ${variantCounter.textContent}
                    `;
                    statusDiv.className = 'success';
                } else if (result.has_loose) {
                    statusDiv.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>${t('idealBlocksNotAvailable')}</strong>
                        ${t(_looseDesc)}
                        <br>
                        ${variantCounter.textContent}
                    `;
                    statusDiv.className = 'error';
                } else if (result.has_partial) {
                    statusDiv.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>${t(_partialFound)}</strong>
                        ${t(_partialDesc)}
                        <br>
                        ${variantCounter.textContent}
                    `;
                    statusDiv.className = 'error';
                }
            }
            
            // Update display order buttons
            updateDisplayOrderButtons();
            
            // Reset button
            isCalculating = false;
            stopCalculationRequested = false;
            calculateBtn.classList.remove('stop-btn');
            calculateBtn.innerHTML = `<i class="fas fa-calculator"></i> ${t('calculateBtn')}`;
            
            // Terminate worker
            calculationWorker.terminate();
            calculationWorker = null;
            
        } else if (type === 'error') {
            // Handle error
            displayResults({error: data.message});
            
            // Reset button
            isCalculating = false;
            stopCalculationRequested = false;
            calculateBtn.classList.remove('stop-btn');
            calculateBtn.innerHTML = `<i class="fas fa-calculator"></i> ${t('calculateBtn')}`;
            
            // Terminate worker
            if (calculationWorker) {
                calculationWorker.terminate();
                calculationWorker = null;
            }
        }
    };
    
    // Handle worker errors
    calculationWorker.onerror = function(error) {
        displayResults({error: 'Calculation error: ' + error.message});
        
        // Reset button
        isCalculating = false;
        stopCalculationRequested = false;
        calculateBtn.classList.remove('stop-btn');
            calculateBtn.innerHTML = `<i class="fas fa-calculator"></i> ${t('calculateBtn')}`;
        
        if (calculationWorker) {
            calculationWorker.terminate();
            calculationWorker = null;
        }
    };
    
    // Start calculation in worker
    calculationWorker.postMessage({
        type: 'start',
        data: {
            amount: amount,
            currencyCode: currentCurrency,
            maxVariants: maxVariants,
            bundlesStock: Object.keys(bundlesStock).length > 0 ? bundlesStock : null,
            bundleSize: currentBundleSize,
            blockSize: currentBlockSize,
            assetType: assetType
        }
    });
});

// Language switcher event handlers
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        applyLanguage(lang);
        saveSettings();
        // Re-render stock inputs with new language but preserve stock mode
        updateStockInputs();
        // Re-render results if they exist
        if (lastResults) {
            displayResults(lastResults);
        }
    });
});



// Button event handlers using event delegation
document.addEventListener('click', (e) => {
    // Display order buttons
    if (e.target.closest('#displayOrderSwitch .order-btn')) {
        const btn = e.target.closest('#displayOrderSwitch .order-btn');
        displayOrder = btn.dataset.order;
        updateDisplayOrderButtons();
        saveSettings();
        // Re-render results if they exist
        if (lastResults) {
            displayResults(lastResults);
        }
    }
    // Stock mode buttons
    else if (e.target.closest('#stockModeSwitch .order-btn')) {
        const btn = e.target.closest('#stockModeSwitch .order-btn');
        
        // Save current mode data before switching
        saveStockData();
        
        // Switch mode
        stockMode = btn.dataset.mode;
        updateStockInputs();
        saveSettings();
    }
    // Denomination order buttons
    else if (e.target.closest('#denominationOrderSwitch .order-btn')) {
        const btn = e.target.closest('#denominationOrderSwitch .order-btn');

        // Save current data before switching
        saveStockData();

        // Switch order
        denominationOrder = btn.dataset.order;
        updateDenominationOrderButtons();
        saveSettings();
        createMultiCurrencyTable();
        loadStockData(); // Reload data after recreating table
    }
    // Asset type buttons (Bills/Coins)
    else if (e.target.closest('#assetTypeSwitch .order-btn')) {
        const btn = e.target.closest('#assetTypeSwitch .order-btn');

        // Save current stock data before switching
        saveStockData();

        // Switch asset type
        assetType = btn.dataset.asset;
        updateAssetTypeButtons();
        updateCurrencyButtons(); // Update placeholder and step for amount field
        updateCurrencyBackground(); // Update background for bills/coins
        updateStockInputs();
        saveSettings();

        // Clear results when switching asset type
        lastResults = null;
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `
            <div id="initialMessage">
                <p style="text-align: center; color: var(--text-secondary); padding: 40px;">
                    <i class="fas fa-arrow-left" style="font-size: 2rem; margin-bottom: 10px;"></i><br>
                    <span data-i18n="initialMessage">${t('initialMessage')}</span>
                </p>
            </div>
        `;
        document.getElementById('displayOrderSwitch').style.display = 'none';
    }
});



// Stock inputs keyboard handlers for arrow keys
document.addEventListener('keydown', (e) => {
    if (e.target.matches('#stockMultiCurrency input')) {
        const input = e.target;
        const currentValue = input.value;
        
        if (e.key === 'ArrowUp') {
            // If empty, set to 0
            if (currentValue === '' || currentValue === null) {
                e.preventDefault();
                input.value = '0';
                // Trigger input event to save
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        } else if (e.key === 'ArrowDown') {
            // If 0, clear the field (set to infinity)
            if (currentValue === '0') {
                e.preventDefault();
                input.value = '';
                // Trigger input event to save
                input.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (currentValue === '' || currentValue === null) {
                // If empty, prevent default behavior (don't set to 0)
                e.preventDefault();
            }
        }
    }
});

// Stock inputs change handler for manual input
document.addEventListener('input', (e) => {
    if (e.target.matches('#stockMultiCurrency input')) {
        // Save immediately for better UX
        clearTimeout(window.saveStockTimeout);
        window.saveStockTimeout = setTimeout(saveStockData, 100);
        updateStockSubtotals();
    }
});

// Checkbox change handler
document.addEventListener('change', (e) => {
    if (e.target.matches('#stockMultiCurrency input[type="checkbox"]')) {
        const denom = e.target.dataset.denom;
        const isEnabled = e.target.checked;
        
        // Update visual state of the row
        const row = e.target.closest('tr');
        if (row) {
            if (isEnabled) {
                row.style.opacity = '1';
                row.querySelectorAll('input[type="number"]').forEach(input => {
                    input.disabled = false;
                });
            } else {
                row.style.opacity = '0.5';
                row.querySelectorAll('input[type="number"]').forEach(input => {
                    input.disabled = true;
                });
            }
        }
        
        // Save changes
        saveStockData();
    }
});

// Auto-repeat functionality for spinner buttons
let spinnerRepeatTimer = null;
let spinnerInitialTimer = null;

// Function to perform spinner action
function performSpinnerAction(button) {
    const action = button.dataset.action;
    const input = button.closest('.stock-cell').querySelector('input');
    const currentValue = input.value.trim();
    
    if (action === 'up') {
        if (currentValue === '' || currentValue === null) {
            // Empty field -> 0 (exclude denomination)
            input.value = '0';
        } else {
            // Normal increment
            const num = parseInt(currentValue) || 0;
            input.value = num + 1;
        }
    } else if (action === 'down') {
        if (currentValue === '0') {
            // 0 -> empty field (unlimited)
            input.value = '';
        } else {
            // Normal decrement (but don't go below 0)
            const num = parseInt(currentValue) || 0;
            if (num > 0) {
                input.value = num - 1;
            }
        }
    }
    
    // Trigger input event to save
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Function to start auto-repeat
function startSpinnerRepeat(button) {
    // Clear any existing timers
    clearTimeout(spinnerInitialTimer);
    clearInterval(spinnerRepeatTimer);
    
    // Initial delay before starting repeat
    spinnerInitialTimer = setTimeout(() => {
        // Start repeating
        spinnerRepeatTimer = setInterval(() => {
            performSpinnerAction(button);
        }, 100); // Repeat every 100ms
    }, 500); // Initial delay 500ms
}

// Function to stop auto-repeat
function stopSpinnerRepeat() {
    clearTimeout(spinnerInitialTimer);
    clearInterval(spinnerRepeatTimer);
    spinnerRepeatTimer = null;
    spinnerInitialTimer = null;
}

// Mouse down handler for spinner buttons
document.addEventListener('mousedown', (e) => {
    if (e.target.matches('.stock-spinner-btn, .stock-cell-spinner-btn')) {
        const button = e.target;
        
        // Prevent text selection
        e.preventDefault();
        
        // Immediate action
        performSpinnerAction(button);
        
        // Start auto-repeat
        startSpinnerRepeat(button);
        
        // Add visual feedback
        button.style.transform = 'scale(0.9)';
    }
});

// Mouse leave handler for spinner buttons (stop repeat if mouse leaves button)
// Using mouseout instead of mouseleave because mouseleave does not bubble
document.addEventListener('mouseout', (e) => {
    if (e.target.matches('.stock-spinner-btn, .stock-cell-spinner-btn')) {
        stopSpinnerRepeat();
        e.target.style.transform = '';
    }
});

// Global mouse up handler (stop repeat wherever mouse is released)
document.addEventListener('mouseup', () => {
    stopSpinnerRepeat();
    document.querySelectorAll('.stock-spinner-btn, .stock-cell-spinner-btn').forEach(btn => {
        btn.style.transform = '';
    });
});

// ====================================================================
// CUSTOM DIALOG SYSTEM
// ====================================================================

// Show custom alert dialog
function showAlert(title, message, type = 'info', htmlContent = null) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customDialog');
        const titleEl = document.getElementById('dialogTitle');
        const messageEl = document.getElementById('dialogMessage');
        const cancelBtn = document.getElementById('dialogCancelBtn');
        const confirmBtn = document.getElementById('dialogConfirmBtn');
        
        titleEl.textContent = title;
        
        if (htmlContent) {
            messageEl.innerHTML = message + htmlContent;
        } else {
            messageEl.textContent = message;
        }
        
        // Hide cancel button for alerts
        cancelBtn.style.display = 'none';
        confirmBtn.textContent = t('ok');
        confirmBtn.className = 'dialog-btn dialog-btn-primary';
        
        // Apply type-specific styling
        if (type === 'error') {
            confirmBtn.classList.add('danger');
        }
        
        modal.classList.add('show');
        
        const handleConfirm = () => {
            modal.classList.remove('show');
            confirmBtn.removeEventListener('click', handleConfirm);
            resolve(true);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        
        // Close on background click
        const handleBackgroundClick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                modal.removeEventListener('click', handleBackgroundClick);
                resolve(true);
            }
        };
        modal.addEventListener('click', handleBackgroundClick);
    });
}

// Show custom confirm dialog
function showConfirm(title, message, type = 'info', htmlContent = null) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customDialog');
        const titleEl = document.getElementById('dialogTitle');
        const messageEl = document.getElementById('dialogMessage');
        const cancelBtn = document.getElementById('dialogCancelBtn');
        const confirmBtn = document.getElementById('dialogConfirmBtn');
        
        titleEl.textContent = title;
        
        if (htmlContent) {
            messageEl.innerHTML = message + htmlContent;
        } else {
            messageEl.textContent = message;
        }
        
        // Show both buttons for confirm
        cancelBtn.style.display = 'block';
        cancelBtn.textContent = t('cancel');
        confirmBtn.textContent = t('confirm');
        confirmBtn.className = 'dialog-btn dialog-btn-primary';
        
        // Apply type-specific styling
        if (type === 'danger') {
            confirmBtn.classList.add('danger');
        }
        
        modal.classList.add('show');
        
        const handleConfirm = () => {
            modal.classList.remove('show');
            cleanup();
            resolve(true);
        };
        
        const handleCancel = () => {
            modal.classList.remove('show');
            cleanup();
            resolve(false);
        };
        
        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.removeEventListener('click', handleBackgroundClick);
        };
        
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        
        // Close on background click (acts as cancel)
        const handleBackgroundClick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
                cleanup();
                resolve(false);
            }
        };
        modal.addEventListener('click', handleBackgroundClick);
    });
}

// ====================================================================
// ORDER EXECUTION
// ====================================================================

// Check if order can be executed with current stock
function checkOrderExecutable(variant) {
    const currentStock = getCurrentStock();
    
    for (const item of variant.breakdown) {
        const denom = item.denomination;
        const availableStock = currentStock[denom] || 0;
        
        // If stock is infinite (INFINITY), we can always fulfill the order
        if (availableStock === INFINITY) {
            continue;
        }
        
        let requiredStock;
        const bSize = getCurrentBundleSize();
        if (variant.type === 'partial' && item.type === 'partial') {
            // For partial items, we need at least the partial amount in bills/coins
            const requiredBills = item.bills;
            const availableBills = availableStock * (stockMode === 'bundles' ? bSize : 1);
            if (availableBills < requiredBills) {
                return false;
            }
        } else {
            // For full bundles
            requiredStock = item.bundles || 0;
            if (stockMode === 'bills') {
                // Convert required bundles/rolls to bills/coins
                const requiredBills = requiredStock * bSize;
                const availableBills = availableStock;
                if (availableBills < requiredBills) {
                    return false;
                }
            } else {
                // Direct bundle comparison
                if (availableStock < requiredStock) {
                    return false;
                }
            }
        }
    }
    
    return true;
}

// Get current stock for the selected currency
function getCurrentStock() {
    const stock = {};
    document.querySelectorAll(`#stockMultiCurrency input[type="number"][data-currency="${currentCurrency}"]`).forEach(input => {
        const denom = input.dataset.denom;
        const value = input.value;
        
        // Check if denomination is enabled for current currency
        const enabledCheckboxes = document.querySelectorAll(`#stockMultiCurrency input[type="checkbox"][data-denom="${denom}"]`);
        let isEnabled = true; // default
        
        // Find the checkbox for the current currency
        enabledCheckboxes.forEach(checkbox => {
            const checkboxCurrency = getCurrencyFromCheckbox(checkbox);
            if (checkboxCurrency === currentCurrency) {
                isEnabled = checkbox.checked;
            }
        });
        
        if (!isEnabled) {
            // Disabled denomination
            stock[denom] = 0;
        } else if (value === '' || value === null) {
            // Empty field means unlimited stock
            stock[denom] = INFINITY;
        } else {
            // Specific value
            stock[denom] = parseInt(value);
        }
    });
    return stock;
}

// Calculate what stock changes would be without actually changing anything
function calculateStockChanges(variant) {
    const stockChanges = [];
    
    for (const item of variant.breakdown) {
        const denom = item.denomination;
        const input = document.querySelector(`#stockMultiCurrency input[type="number"][data-currency="${currentCurrency}"][data-denom="${denom}"]`);
        
        if (input) {
            const inputValue = input.value;
            const isInfinite = inputValue === '' || inputValue === null;
            const currentValue = isInfinite ? INFINITY : parseInt(inputValue) || 0;
            const beforeValue = isInfinite ? null : currentValue;
            let deduction;
            
            const bSize = getCurrentBundleSize();
            if (variant.type === 'partial' && item.type === 'partial') {
                // For partial items, deduct bills/coins
                const requiredBills = item.bills;
                if (stockMode === 'bundles') {
                    // Convert bills/coins to bundles/rolls for deduction
                    deduction = Math.ceil(requiredBills / bSize);
                } else {
                    // Direct bill/coin deduction
                    deduction = requiredBills;
                }
            } else {
                // For full bundles/rolls
                const requiredBundles = item.bundles || 0;
                if (stockMode === 'bills') {
                    // Convert bundles/rolls to bills/coins for deduction
                    deduction = requiredBundles * bSize;
                } else {
                    // Direct bundle/roll deduction
                    deduction = requiredBundles;
                }
            }
            
            let afterValue;
            if (isInfinite) {
                // Infinite stock remains infinite after deduction
                afterValue = null;
            } else {
                const newValue = Math.max(0, currentValue - deduction);
                afterValue = newValue;
            }
            
            // Record the change
            if (deduction > 0) {
                stockChanges.push({
                    denomination: denom,
                    before: beforeValue,
                    after: afterValue,
                    deduction: deduction,
                    isInfinite: isInfinite
                });
            }
        }
    }
    
    return stockChanges;
}

// Generate stock changes HTML
function generateStockChangesHTML(stockChanges, currency = currentCurrency) {
    if (stockChanges.length === 0) {
        return '';
    }
    
    const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;
    
    let html = `
        <div class="stock-changes">
            <div class="stock-changes-title">${t('stockChanges')}</div>
    `;
    
    stockChanges.forEach(change => {
        const color = getDenomColor(change.denomination);
        const modeText = stockMode === 'bundles'
            ? (assetType === 'coins' ? 'rollsText' : 'bundles')
            : (assetType === 'coins' ? 'coinsText' : 'bills');

        html += `
            <div class="stock-change-item">
                <div class="stock-change-denom">
                    <span class="stock-change-denom-badge" style="background-color: ${color};">
                        ${formatDenom(change.denomination, currency)}
                    </span>
                    <span class="stock-change-deduction">
                        -${change.deduction} ${t(modeText)}
                    </span>
                </div>
                <div class="stock-change-values">
                    <span class="stock-change-before">${change.before === null ? '∞' : change.before}</span>
                    <span class="stock-change-arrow">→</span>
                    <span class="stock-change-after">${change.isInfinite ? '∞' : (change.after === null ? '0' : change.after)}</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Execute order and deduct from stock
async function executeOrder(variant) {
    if (!checkOrderExecutable(variant)) {
        await showAlert(t('executionError'), t('insufficientStock'), 'error');
        return false;
    }
    
    // Calculate stock changes preview
    const previewStockChanges = calculateStockChanges(variant);
    const previewStockChangesHTML = generateStockChangesHTML(previewStockChanges, currentCurrency);
    
    const confirmed = await showConfirm(
        t('confirmExecution'), 
        t('orderExecutionConfirm'), 
        'danger',
        previewStockChangesHTML
    );
    
    if (!confirmed) {
        return false;
    }
    
    // Apply the stock changes (we already calculated them for preview)
    previewStockChanges.forEach(change => {
        const input = document.querySelector(`#stockMultiCurrency input[type="number"][data-currency="${currentCurrency}"][data-denom="${change.denomination}"]`);
        if (input) {
            if (change.isInfinite) {
                // Keep infinite stock as empty field
                input.value = '';
            } else {
                const newValue = change.after;
                input.value = newValue === null ? '' : newValue.toString();
            }
        }
    });
    
    // Save updated stock
    saveStockData();
    updateStockSubtotals();

    // Show success message with stock changes
    const stockChangesHTML = generateStockChangesHTML(previewStockChanges, currentCurrency);
    await showAlert(t('executionSuccess'), t('orderExecuted'), 'success', stockChangesHTML);
    
    // Close modal
    document.getElementById('blockModal').classList.remove('show');
    
    return true;
}

// ====================================================================
// BLOCK VISUALIZATION
// ====================================================================

let rotationInterval = null;
let currentVariantForExecution = null;

// Show block visualization modal
function showBlockVisualization(variant) {
    const modal = document.getElementById('blockModal');
    const title = document.getElementById('blockModalTitle');
    const executeBtn = document.getElementById('executeOrderBtn');
    
    // Store current variant for execution
    currentVariantForExecution = variant;
    
    let titleText = `${formatCurrency(variant.total_value, lastResults.currency)}`;
    title.textContent = titleText;
    
    // Check if order can be executed (sufficient stock)
    const canExecute = checkOrderExecutable(variant);
    executeBtn.disabled = !canExecute;
    executeBtn.title = canExecute ? t('orderExecutionConfirm') : t('insufficientStock');
    
    buildBlockVisualization(variant);
    modal.classList.add('show');

    animateBlockBuild();
}

// Get flat array of all bundles/rolls from variant breakdown
function getAllBundlesFlat(variant) {
    const allBundles = [];
    const bSize = getCurrentBundleSize();

    if (variant.type === 'ideal' || variant.type === 'loose') {
        variant.breakdown.forEach(item => {
            for (let i = 0; i < item.bundles; i++) {
                allBundles.push({
                    denomination: item.denomination,
                    value: item.denomination * bSize,
                    type: 'full'
                });
            }
        });
    } else if (variant.type === 'partial') {
        variant.breakdown.forEach(item => {
            if (item.type === 'full') {
                for (let i = 0; i < item.bundles; i++) {
                    allBundles.push({
                        denomination: item.denomination,
                        value: item.denomination * bSize,
                        type: 'full'
                    });
                }
            } else if (item.type === 'partial') {
                allBundles.push({
                    denomination: item.denomination,
                    value: item.value,
                    type: 'partial',
                    bills: item.bills
                });
            }
        });
    }
    return allBundles;
}

// Calculate total value of a specific block
function calculateBlockValue(variant, blockNum) {
    const allBundles = getAllBundlesFlat(variant);
    const blockSize = getCurrentBlockSize();

    let blockValue = 0;
    for (let i = 0; i < blockSize; i++) {
        const bundleIndex = blockNum * blockSize + i;
        if (bundleIndex < allBundles.length) {
            blockValue += allBundles[bundleIndex].value;
        }
    }

    return blockValue;
}

// Build 3D block visualization
function buildBlockVisualization(variant) {
    const block3d = document.getElementById('block3d');
    block3d.innerHTML = '';

    const blockSize = getCurrentBlockSize();
    const isCoins = assetType === 'coins';

    // Determine number of blocks
    let numBlocks;
    if (variant.type === 'ideal') {
        numBlocks = variant.blocks;
    } else {
        const totalItems = variant.breakdown.reduce((sum, item) => {
            if (variant.type === 'loose') {
                return sum + item.bundles;
            } else if (variant.type === 'partial') {
                return sum + (item.type === 'full' ? item.bundles : 1);
            }
            return sum;
        }, 0);
        numBlocks = Math.ceil(totalItems / blockSize);
    }

    // Create block structure for each block
    for (let blockNum = 0; blockNum < numBlocks; blockNum++) {
        const blockContainer = document.createElement('div');
        blockContainer.className = 'block-container';

        if (numBlocks > 1) {
            const blockLabel = document.createElement('div');
            blockLabel.className = 'block-item-title';
            const blockValue = calculateBlockValue(variant, blockNum);
            blockLabel.textContent = `${blockNum + 1}. ${formatCurrency(blockValue, lastResults.currency)}`;
            blockContainer.appendChild(blockLabel);
        }

        const blockElement = document.createElement('div');

        if (isCoins) {
            // Coin block: 2 rows × 5 rolls
            blockElement.className = 'block-3d coin-block-3d';
            const allBundles = getAllBundlesFlat(variant);

            // Top row (rolls 6-10)
            const topRow = document.createElement('div');
            topRow.className = 'coin-block-layer top';
            for (let i = 5; i < 10; i++) {
                const idx = blockNum * blockSize + i;
                const rollInfo = idx < allBundles.length ? allBundles[idx] : { denomination: 0, type: 'empty' };
                topRow.appendChild(createRoll(rollInfo));
            }
            blockElement.appendChild(topRow);

            // Bottom row (rolls 1-5)
            const bottomRow = document.createElement('div');
            bottomRow.className = 'coin-block-layer bottom';
            for (let i = 0; i < 5; i++) {
                const idx = blockNum * blockSize + i;
                const rollInfo = idx < allBundles.length ? allBundles[idx] : { denomination: 0, type: 'empty' };
                bottomRow.appendChild(createRoll(rollInfo));
            }
            blockElement.appendChild(bottomRow);
        } else {
            // Bill block: 2 layers × 3 stacks × 5 bundles
            blockElement.className = 'block-3d';

            const topLayer = createBlockLayer(variant, 'top', blockNum);
            blockElement.appendChild(topLayer);

            const bottomLayer = createBlockLayer(variant, 'bottom', blockNum);
            blockElement.appendChild(bottomLayer);
        }

        blockContainer.appendChild(blockElement);

        // Add click handler for re-animation
        blockContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            animateSingleBlock(blockElement);
        });

        block3d.appendChild(blockContainer);
    }

    // Build partial packs legend
    buildPartialPacksLegend(variant);
}

// Build legend showing partial pack details
function buildPartialPacksLegend(variant) {
    const legend = document.getElementById('partialPacksLegend');
    if (!legend) return;

    const partialItems = variant.breakdown.filter(item => item.type === 'partial');
    if (partialItems.length === 0) {
        legend.style.display = 'none';
        return;
    }

    const isCoins = assetType === 'coins';
    const bSize = getCurrentBundleSize();
    const bundleWord = isCoins ? t('rollsText') : t('bundlesText');
    const itemWord = isCoins ? t('coinsText') : 'bills';

    let html = `<div class="partial-legend-title">
        <i class="fas fa-asterisk"></i>
        ${isCoins ? t('partialRollsFound') : t('partialBundlesFound')}
    </div>`;

    partialItems.forEach(item => {
        const color = getDenomColor(item.denomination);
        const denomLabel = formatDenom(item.denomination, lastResults.currency);
        html += `
            <div class="partial-legend-item">
                <div class="partial-swatch" style="background: linear-gradient(15deg, ${color} 50%, rgba(255,255,255,0.7) 50%); border-color: ${color};"></div>
                <span class="denom-badge ${getDenomClass(item.denomination)}">${denomLabel}</span>
                <span>${item.bills}/${bSize} ${itemWord}</span>
                <span style="color: var(--text-secondary);">= ${formatCurrency(item.value, lastResults.currency)}</span>
            </div>
        `;
    });

    legend.innerHTML = html;
    legend.style.display = 'block';
}

// Create a layer of the block (3 stacks) - bills only
function createBlockLayer(variant, layerType, blockNum) {
    const layer = document.createElement('div');
    layer.className = `block-layer ${layerType}`;

    for (let stackNum = 0; stackNum < 3; stackNum++) {
        const stack = createStack(variant, stackNum, layerType, blockNum);
        layer.appendChild(stack);
    }

    return layer;
}

// Create a single stack (5 bundles) - bills only
function createStack(variant, stackNum, layerType, blockNum) {
    const stack = document.createElement('div');
    stack.className = 'stack';

    const bundlesInStack = distributeBundlesInStack(variant, stackNum, layerType, blockNum);

    for (let bundleNum = 0; bundleNum < 5; bundleNum++) {
        const bundle = createBundle(bundlesInStack[bundleNum]);
        stack.appendChild(bundle);
    }

    const label = document.createElement('div');
    label.className = 'stack-label';
    stack.appendChild(label);

    return stack;
}

// Distribute bundles in stack - bills only
function distributeBundlesInStack(variant, stackNum, layerType, blockNum) {
    const allBundles = getAllBundlesFlat(variant);

    const stacksPerBlock = 6;
    const bundlesPerStack = 5;
    const bundlesPerBlock = stacksPerBlock * bundlesPerStack; // 30

    const globalStackNum = layerType === 'bottom' ? stackNum : stackNum + 3;

    const stackBundles = [];
    for (let i = 0; i < bundlesPerStack; i++) {
        const bundleIndex = blockNum * bundlesPerBlock + globalStackNum * bundlesPerStack + i;
        if (bundleIndex < allBundles.length) {
            stackBundles.push(allBundles[bundleIndex]);
        } else {
            stackBundles.push({ denomination: 100, type: 'empty' });
        }
    }

    return stackBundles;
}

// Create a single bundle element (for bill blocks)
function createBundle(bundleInfo) {
    const bundle = document.createElement('div');
    bundle.className = 'bundle';
    const bSize = getCurrentBundleSize();
    const itemLabel = assetType === 'coins' ? 'coins' : 'bills';

    if (bundleInfo.type === 'empty') {
        bundle.style.backgroundColor = 'transparent';
        bundle.style.border = '1px dashed rgba(0, 0, 0, 0.2)';
        bundle.textContent = '';
    } else if (bundleInfo.type === 'partial') {
        const color = getDenomColor(bundleInfo.denomination);
        bundle.style.background = `linear-gradient(15deg, ${color} 50%, rgba(255,255,255,0.7) 50%)`;
        bundle.style.border = `2px solid ${color}`;
        bundle.textContent = formatDenom(bundleInfo.denomination);
        bundle.title = `Partial: ${bundleInfo.bills} ${itemLabel}`;
    } else {
        bundle.style.backgroundColor = getDenomColor(bundleInfo.denomination);
        bundle.textContent = formatDenom(bundleInfo.denomination);
        bundle.title = `Full: ${bSize} ${itemLabel}`;
    }

    return bundle;
}

// Create a single roll element (for coin blocks)
function createRoll(rollInfo) {
    const roll = document.createElement('div');
    roll.className = 'coin-roll bundle'; // bundle class for animation compatibility

    if (rollInfo.type === 'empty') {
        roll.style.backgroundColor = 'transparent';
        roll.style.border = '2px dashed rgba(0, 0, 0, 0.2)';
        roll.textContent = '';
    } else if (rollInfo.type === 'partial') {
        const color = getDenomColor(rollInfo.denomination);
        roll.style.background = `linear-gradient(0deg, ${color} 50%, rgba(255,255,255,0.7) 50%)`;
        roll.style.border = `2px solid ${color}`;
        roll.textContent = formatDenom(rollInfo.denomination);
        roll.title = `Partial roll: ${rollInfo.bills} coins`;
    } else {
        roll.style.backgroundColor = getDenomColor(rollInfo.denomination);
        roll.textContent = formatDenom(rollInfo.denomination);
        roll.title = `Full roll: ${ROLL_SIZE} coins`;
    }

    return roll;
}

// Animation functions
function animateBlockBuild() {
    // Анимируем каждый блок параллельно
    const blockElements = document.querySelectorAll('#block3d .block-3d');
    blockElements.forEach((blockElement, blockIndex) => {
        animateSingleBlock(blockElement);
    });
}

// Animate a single block
function animateSingleBlock(blockElement) {
    // For coin blocks, use coin-block-layer; for bill blocks, use block-layer
    const bottomBundles = blockElement.querySelectorAll('.block-layer.bottom .bundle, .coin-block-layer.bottom .bundle');
    const topBundles = blockElement.querySelectorAll('.block-layer.top .bundle, .coin-block-layer.top .bundle');

    const blockBundles = [...bottomBundles, ...topBundles];
    
    blockBundles.forEach((bundle, bundleIndex) => {
        bundle.classList.remove('animate');
        bundle.style.opacity = '0';
        bundle.style.transform = 'translateY(-20px)';
        
        // Анимируем внутри блока последовательно
        setTimeout(() => {
            bundle.classList.add('animate');
        }, bundleIndex * 25);
    });
}

// Event handlers for block visualization
document.getElementById('closeBlockModal').addEventListener('click', () => {
    document.getElementById('blockModal').classList.remove('show');
    currentVariantForExecution = null;
    if (rotationInterval) {
        clearInterval(rotationInterval);
        rotationInterval = null;
    }
});

// Execute order button handler
document.getElementById('executeOrderBtn').addEventListener('click', async () => {
    if (currentVariantForExecution) {
        await executeOrder(currentVariantForExecution);
    }
});

// Close modal on background click
document.getElementById('blockModal').addEventListener('click', (e) => {
    if (e.target.id === 'blockModal') {
        document.getElementById('blockModal').classList.remove('show');
        currentVariantForExecution = null;
        if (rotationInterval) {
            clearInterval(rotationInterval);
            rotationInterval = null;
        }
    }
});

// Initialize
initLanguage();
createCurrencyButtons();
updateCurrencyButtons();
updateCurrencyBackground();
updateDisplayOrderButtons();
updateStockModeButtons();
updateDenominationOrderButtons();
updateAssetTypeButtons();
updateStockInputs();
updateCurrencyButtons();
