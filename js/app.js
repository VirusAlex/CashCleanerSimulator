import { TRANSLATIONS } from './translations.js';

// Constants
const BUNDLE_SIZE = 100;
const BLOCK_SIZE = 30;
const INFINITY = 1000000000;

// Currency denominations
const CURRENCIES = {
    'USD': [100, 50, 20, 10],
    'EUR': [100, 50, 20],
    'JPY': [10000, 5000, 1000],
    'GBP': [50, 20, 10, 5]
};

// Currency symbols
const CURRENCY_SYMBOLS = {
    'USD': '$',
    'EUR': '€',
    'JPY': '¥',
    'GBP': '£'
};

// Denomination colors (per currency)
const DENOM_COLORS = {
    'USD': { 100: '#fbbf24', 50: '#f97316', 20: '#3b82f6', 10: '#10b981' },
    'EUR': { 100: '#fbbf24', 50: '#f97316', 20: '#3b82f6' },
    'JPY': { 10000: '#fbbf24', 5000: '#f97316', 1000: '#10b981' },
    'GBP': { 50: '#fbbf24', 20: '#f97316', 10: '#3b82f6', 5: '#10b981' }
};

function getDenomColor(denom, currency) {
    const colors = DENOM_COLORS[currency || currentCurrency];
    return (colors && colors[denom]) || '#64748b';
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
        language: currentLang
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
        return 'USD'; // default
    } catch (e) {
        console.error('Error in getCurrencyFromCheckbox:', e);
        return 'USD';
    }
}

// Save stock data to localStorage
function saveStockData() {
    try {
        // Get existing data or create new structure
        let allStockData = {};
        try {
            const existing = localStorage.getItem('cash-cleaner-stock');
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
        
        localStorage.setItem('cash-cleaner-stock', JSON.stringify(allStockData));
    } catch (e) {
        console.error('Failed to save stock data:', e);
    }
}

// Load stock data from localStorage
function loadStockData() {
    try {
        const saved = localStorage.getItem('cash-cleaner-stock');
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
    
    if (stockMode === 'bundles') {
        stockTitle.textContent = t('stockRemaining');
        stockTooltip.setAttribute('data-tooltip', t('stockTooltip'));
    } else {
        stockTitle.textContent = t('stockRemainingBills');
        stockTooltip.setAttribute('data-tooltip', t('stockTooltipBills'));
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
        
        // Get denominations for this currency and sort them
        const denominations = [...CURRENCIES[currency]].sort((a, b) => 
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
                    ${CURRENCY_SYMBOLS[currency]}${denom}
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
            
            row.dataset.denom = denom;
            table.appendChild(row);
        });
        
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
    
    // Update currency indicator in amount field
    const currencyIndicator = document.getElementById('currencyIndicator');
    if (currencyIndicator) {
        currencyIndicator.textContent = CURRENCY_SYMBOLS[currentCurrency];
    }
    
    // Update amount field placeholder with currency-specific example
    const amountField = document.getElementById('amount');
    if (amountField) {
        const examples = {
            'USD': '85000',
            'EUR': '75000',
            'JPY': '8500000',
            'GBP': '50000'
        };
        amountField.placeholder = examples[currentCurrency] || '85000';
    }
}

// Update background based on currency
function updateCurrencyBackground() {
    // Remove all currency classes
    document.body.classList.remove('currency-usd', 'currency-eur', 'currency-jpy', 'currency-gbp');
    
    // Add current currency class
    document.body.classList.add(`currency-${currentCurrency.toLowerCase()}`);
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
    '#10b981': 'green'
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
        
        if (item.type === 'partial') {
            typeIcon = '<i class="fas fa-asterisk" style="color: orange; margin-right: 4px;" title="Partial pack"></i>';
            if (displayOrder === 'denomination-first') {
                denomDisplay = `
                    ${typeIcon}
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${item.denomination}
                    </span>
                    × ${item.bills} bills (partial pack)
                `;
            } else {
                denomDisplay = `
                    ${typeIcon}${item.bills} bills × 
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${item.denomination}
                    </span>
                    (partial pack)
                `;
            }
        } else {
            if (displayOrder === 'denomination-first') {
                denomDisplay = `
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${item.denomination}
                    </span>
                    × ${item.bundles} ${t('bundlesText')}
                `;
            } else {
                denomDisplay = `
                    ${item.bundles} ${t('bundlesText')} × 
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${item.denomination}
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
    
    if (data.has_ideal) {
        html += `
            <div class="success">
                <i class="fas fa-check-circle"></i>
                <strong>${t('idealBlocksFound')}</strong> 
                ${t('idealBlocksDesc', {blockSize: data.block_size, bundleSize: data.bundle_size})}
            </div>
        `;
    } else if (data.has_loose) {
        html += `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>${t('idealBlocksNotAvailable')}</strong> 
                ${t('looseBundlesDesc')}
            </div>
        `;
    } else if (data.has_partial) {
        html += `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>${t('partialBundlesFound')}</strong> 
                ${t('partialBundlesDesc')}
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
            
            if (item.type === 'partial') {
                typeIcon = '<i class="fas fa-asterisk" style="color: orange; margin-right: 4px;" title="Partial pack"></i>';
                if (displayOrder === 'denomination-first') {
                    denomDisplay = `
                        ${typeIcon}
                        <span class="denom-badge ${getDenomClass(item.denomination)}">
                            ${item.denomination}
                        </span>
                        × ${item.bills} bills (partial pack)
                    `;
                } else {
                    denomDisplay = `
                        ${typeIcon}${item.bills} bills × 
                        <span class="denom-badge ${getDenomClass(item.denomination)}">
                            ${item.denomination}
                        </span>
                        (partial pack)
                    `;
                }
            } else {
            if (displayOrder === 'denomination-first') {
                denomDisplay = `
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${item.denomination}
                    </span>
                    × ${item.bundles} ${t('bundlesText')}
                `;
            } else {
                denomDisplay = `
                    ${item.bundles} ${t('bundlesText')} × 
                    <span class="denom-badge ${getDenomClass(item.denomination)}">
                        ${item.denomination}
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
    
    const amount = parseInt(document.getElementById('amount').value);
    const maxVariants = parseInt(document.getElementById('maxVariants').value);
    
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
            // Convert bills to bundles if in bills mode
            if (stockMode === 'bills') {
                stock[denom] = Math.floor(parseInt(value) / BUNDLE_SIZE);
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
            bundle_size: BUNDLE_SIZE,
            block_size: BLOCK_SIZE,
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
    const denoms = [...CURRENCIES[currentCurrency]].sort((a, b) => b - a);
    
    // Validate inputs
    if (isNaN(amount) || amount <= 0) {
        displayResults({error: 'Amount must be positive'});
        isCalculating = false;
        calculateBtn.classList.remove('stop-btn');
        calculateBtn.innerHTML = `<i class="fas fa-calculator"></i> ${t('calculateBtn')}`;
        return;
    }
    
    if (!CURRENCIES[currentCurrency]) {
        displayResults({error: `Currency ${currentCurrency} not supported`});
        isCalculating = false;
        calculateBtn.classList.remove('stop-btn');
        calculateBtn.innerHTML = `<i class="fas fa-calculator"></i> ${t('calculateBtn')}`;
        return;
    }
    
    // Convert stock data
    const bundlesStock = {};
    if (stock) {
        Object.keys(stock).forEach(denomStr => {
            const denom = parseInt(denomStr);
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
                    total_bundles: blocks * BLOCK_SIZE,
                    breakdown: []
                };
                
                let totalValue = 0;
                bundleCounts.forEach((count, i) => {
                    if (count > 0) {
                        const denom = denoms[i];
                        const value = denom * count * BUNDLE_SIZE;
                        totalValue += value;
                        variant.breakdown.push({
                            denomination: denom,
                            bundles: count,
                                value: value,
                                bills: count * BUNDLE_SIZE
                        });
                    }
                });
                variant.total_value = totalValue;
            } else if (variantType === 'loose') {
                const bundleCounts = solution;
                    const totalBundles = bundleCounts.reduce((sum, c) => sum + c, 0);
                variant = {
                        type: 'loose',
                        blocks: Math.ceil(totalBundles / BLOCK_SIZE),
                        total_bundles: totalBundles,
                        breakdown: []
                    };
                    
                    let totalValue = 0;
                    bundleCounts.forEach((count, i) => {
                        if (count > 0) {
                            const denom = denoms[i];
                            const value = denom * count * BUNDLE_SIZE;
                            totalValue += value;
                            variant.breakdown.push({
                                denomination: denom,
                                bundles: count,
                                    value: value,
                                    bills: count * BUNDLE_SIZE
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
                            
                            const fullBundles = Math.floor(count / BUNDLE_SIZE);
                            const partialBills = count % BUNDLE_SIZE;
                            
                            if (fullBundles > 0) {
                                variant.breakdown.push({
                                    denomination: denom,
                                    bundles: fullBundles,
                                    value: denom * fullBundles * BUNDLE_SIZE,
                                    bills: fullBundles * BUNDLE_SIZE,
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
                    variant.blocks = Math.ceil(totalBundles / BLOCK_SIZE);
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
                        if (result.has_ideal) {
                            statusDiv.innerHTML = `
                                <i class="fas fa-check-circle"></i>
                                <strong>${t('idealBlocksFound')}</strong> 
                                ${t('idealBlocksDesc', {blockSize: result.block_size, bundleSize: result.bundle_size})}
                                <br>
                                ${variantCounter.textContent}
                            `;
                            statusDiv.className = 'success';
                        } else if (result.has_loose) {
                            statusDiv.innerHTML = `
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong>${t('idealBlocksNotAvailable')}</strong> 
                                ${t('looseBundlesDesc')}
                                <br>
                                ${variantCounter.textContent}
                            `;
                            statusDiv.className = 'error';
                        } else if (result.has_partial) {
                            statusDiv.innerHTML = `
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong>${t('partialBundlesFound')}</strong> 
                                ${t('partialBundlesDesc')}
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
                        ${t('idealBlocksDesc', {blockSize: result.block_size, bundleSize: result.bundle_size})}
                        <br>
                        ${variantCounter.textContent}
                    `;
                    statusDiv.className = 'success';
                } else if (result.has_loose) {
                    statusDiv.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>${t('idealBlocksNotAvailable')}</strong> 
                        ${t('looseBundlesDesc')}
                        <br>
                        ${variantCounter.textContent}
                    `;
                    statusDiv.className = 'error';
                } else if (result.has_partial) {
                    statusDiv.innerHTML = `
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>${t('partialBundlesFound')}</strong> 
                        ${t('partialBundlesDesc')}
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
            bundlesStock: Object.keys(bundlesStock).length > 0 ? bundlesStock : null
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
        if (variant.type === 'partial' && item.type === 'partial') {
            // For partial items, we need at least the partial amount in bills
            const requiredBills = item.bills;
            const availableBills = availableStock * (stockMode === 'bundles' ? BUNDLE_SIZE : 1);
            if (availableBills < requiredBills) {
                return false;
            }
        } else {
            // For full bundles
            requiredStock = item.bundles || 0;
            if (stockMode === 'bills') {
                // Convert required bundles to bills
                const requiredBills = requiredStock * BUNDLE_SIZE;
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
            
            if (variant.type === 'partial' && item.type === 'partial') {
                // For partial items, deduct bills
                const requiredBills = item.bills;
                if (stockMode === 'bundles') {
                    // Convert bills to bundles for deduction
                    deduction = Math.ceil(requiredBills / BUNDLE_SIZE);
                } else {
                    // Direct bill deduction
                    deduction = requiredBills;
                }
            } else {
                // For full bundles
                const requiredBundles = item.bundles || 0;
                if (stockMode === 'bills') {
                    // Convert bundles to bills for deduction
                    deduction = requiredBundles * BUNDLE_SIZE;
                } else {
                    // Direct bundle deduction
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
        const modeText = stockMode === 'bundles' ? 'bundles' : 'bills';
        
        html += `
            <div class="stock-change-item">
                <div class="stock-change-denom">
                    <span class="stock-change-denom-badge" style="background-color: ${color};">
                        ${currencySymbol}${change.denomination}
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

// Calculate total value of a specific block
function calculateBlockValue(variant, blockNum) {
    // Создаем плоский массив РОВНО тех пачек, которые посчитал калькулятор
    const allBundles = [];
    
    if (variant.type === 'ideal' || variant.type === 'loose') {
        // Для идеальных и loose блоков - используем bundles
        variant.breakdown.forEach(item => {
            for (let i = 0; i < item.bundles; i++) {
                allBundles.push({ 
                    denomination: item.denomination, 
                    value: item.denomination * 100 
                });
            }
        });
    } else if (variant.type === 'partial') {
        // Для частичных блоков - используем точные значения
        variant.breakdown.forEach(item => {
            if (item.type === 'full') {
                // Полные пачки
                for (let i = 0; i < item.bundles; i++) {
                    allBundles.push({ 
                        denomination: item.denomination,
                        value: item.denomination * 100
                    });
                }
            } else if (item.type === 'partial') {
                // Частичная пачка - точное значение
                allBundles.push({ 
                    denomination: item.denomination,
                    value: item.value
                });
            }
        });
    }
    
    // Вычисляем сумму для конкретного блока
    let blockValue = 0;
    for (let i = 0; i < BLOCK_SIZE; i++) {
        const bundleIndex = blockNum * BLOCK_SIZE + i;
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
    
    // Определяем количество блоков для визуализации
    let numBlocks;
    if (variant.type === 'ideal') {
        numBlocks = variant.blocks;
    } else {
        // Для loose и partial вариантов создаем виртуальные блоки
        const totalItems = variant.breakdown.reduce((sum, item) => {
            if (variant.type === 'loose') {
                return sum + item.bundles;
            } else if (variant.type === 'partial') {
                return sum + (item.type === 'full' ? item.bundles : 1);
            }
            return sum;
        }, 0);
        numBlocks = Math.ceil(totalItems / BLOCK_SIZE); // 30 items per block
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
        blockElement.className = 'block-3d';
        
        // Top layer (stacks 4, 5, 6) - создаем вторым, CSS поднимет его выше
        const topLayer = createBlockLayer(variant, 'top', blockNum);
        blockElement.appendChild(topLayer);
        
        // Bottom layer (stacks 1, 2, 3) - создаем первым для правильной анимации
        const bottomLayer = createBlockLayer(variant, 'bottom', blockNum);
        blockElement.appendChild(bottomLayer);
        
        blockContainer.appendChild(blockElement);
        
        // Add click handler for re-animation to the entire container
        blockContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            animateSingleBlock(blockElement);
        });
        
        block3d.appendChild(blockContainer);
    }
}

// Create a layer of the block (3 stacks)
function createBlockLayer(variant, layerType, blockNum) {
    const layer = document.createElement('div');
    layer.className = `block-layer ${layerType}`;
    
    for (let stackNum = 0; stackNum < 3; stackNum++) {
        const stack = createStack(variant, stackNum, layerType, blockNum);
        layer.appendChild(stack);
    }
    
    return layer;
}

// Create a single stack (5 bundles)
function createStack(variant, stackNum, layerType, blockNum) {
    const stack = document.createElement('div');
    stack.className = 'stack';
    
    // Calculate which denominations to show in this stack
    const bundlesInStack = distributeBundlesInStack(variant, stackNum, layerType, blockNum);
    
    for (let bundleNum = 0; bundleNum < 5; bundleNum++) {
        const bundle = createBundle(bundlesInStack[bundleNum]);
        stack.appendChild(bundle);
    }
    
    // Add stack label
    const label = document.createElement('div');
    label.className = 'stack-label';
    const stackGlobalNum = layerType === 'bottom' ? stackNum + 1 : stackNum + 4;
    // label.textContent = `Stack ${stackGlobalNum}`;
    stack.appendChild(label);
    
    return stack;
}

// Distribute real bundles across stacks according to calculation results
function distributeBundlesInStack(variant, stackNum, layerType, blockNum) {
    // Создаем плоский массив РОВНО тех пачек, которые посчитал калькулятор
    const allBundles = [];
    
    if (variant.type === 'ideal' || variant.type === 'loose') {
        // Для идеальных и loose блоков - используем bundles
        variant.breakdown.forEach(item => {
            for (let i = 0; i < item.bundles; i++) {
                allBundles.push({ 
                    denomination: item.denomination,
                    type: 'full'
                });
            }
        });
    } else if (variant.type === 'partial') {
        // Для частичных блоков - разбираем bills на полные и частичные пачки
        variant.breakdown.forEach(item => {
            if (item.type === 'full') {
                // Полные пачки
                for (let i = 0; i < item.bundles; i++) {
                    allBundles.push({ 
                        denomination: item.denomination,
                        type: 'full'
                    });
                }
            } else if (item.type === 'partial') {
                // Частичная пачка
                allBundles.push({ 
                    denomination: item.denomination,
                    type: 'partial',
                    bills: item.bills
                });
            }
        });
    }
    
    // Константы
    const stacksPerBlock = 6; // 6 стопок в блоке
    const bundlesPerStack = 5; // 5 пачек в стопке
    const bundlesPerBlock = stacksPerBlock * bundlesPerStack; // 30 пачек в блоке
    
    // Глобальный номер стопки в КОНКРЕТНОМ блоке (0-5)
    const globalStackNum = layerType === 'bottom' ? stackNum : stackNum + 3;
    
    // Извлекаем 5 пачек для этой стопки из конкретного блока
    const stackBundles = [];
    for (let i = 0; i < bundlesPerStack; i++) {
        // ВАЖНО: распределяем пачки последовательно по блокам
        const bundleIndex = blockNum * bundlesPerBlock + globalStackNum * bundlesPerStack + i;
        if (bundleIndex < allBundles.length) {
            stackBundles.push(allBundles[bundleIndex]);
        } else {
            // Если пачек не хватает, заполняем пустышкой
            stackBundles.push({ denomination: 100, type: 'empty' });
        }
    }
    
    return stackBundles;
}

// Create a single bundle
function createBundle(bundleInfo) {
    const bundle = document.createElement('div');
    bundle.className = 'bundle';
    
    if (bundleInfo.type === 'empty') {
        // Пустая пачка - показываем прозрачной
        bundle.style.backgroundColor = 'transparent';
        bundle.style.border = '1px dashed rgba(0, 0, 0, 0.2)';
        bundle.textContent = '';
    } else if (bundleInfo.type === 'partial') {
        // Частичная пачка - диагональная заливка
        const color = getDenomColor(bundleInfo.denomination);
        bundle.style.background = `linear-gradient(15deg, ${color} 50%, rgba(255,255,255,0.7) 50%)`;
        bundle.style.border = `2px solid ${color}`;
        bundle.textContent = bundleInfo.denomination;
        bundle.title = `Partial pack: ${bundleInfo.bills} bills`;
    } else {
        // Полная пачка
        bundle.style.backgroundColor = getDenomColor(bundleInfo.denomination);
        bundle.textContent = bundleInfo.denomination;
        bundle.title = `Full pack: ${BUNDLE_SIZE} bills`;
    }
    
    return bundle;
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
    // Для каждого блока анимируем сначала нижний слой, потом верхний
    const bottomBundles = blockElement.querySelectorAll('.block-layer.bottom .bundle');
    const topBundles = blockElement.querySelectorAll('.block-layer.top .bundle');
    
    // Объединяем в правильном порядке для этого блока
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
updateStockInputs();
