document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const apiKey = 'ypuBeVKgcqUseVYcQM4I4yhq2zY2WPCo'; // <--- IMPORTANT: PASTE YOUR API KEY HERE
    const initialBalance = 5000;
    const majorForexPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'];
    const majorCryptoPairs = ['BTCUSD', 'ETHUSD', 'XRPUSD', 'LTCUSD', 'BCHUSD', 'ADAUSD', 'SOLUSD'];

    // --- DOM ELEMENTS ---
    const balanceEl = document.getElementById('current-balance');
    const pairSelectEl = document.getElementById('pair-select');
    const currentPriceEl = document.getElementById('current-price');
    const currentSpreadEl = document.getElementById('current-spread');
    const riskPercentEl = document.getElementById('risk-percent');
    const stopLossPriceEl = document.getElementById('stop-loss-price');
    const entryPriceEl = document.getElementById('entry-price');
    const riskAmountEl = document.getElementById('risk-amount');
    const lotSizeEl = document.getElementById('lot-size');
    const logTradeBtn = document.getElementById('log-trade-btn');
    const historyTableBody = document.querySelector('#history-table tbody');

    // --- APP STATE ---
    let state = {
        balance: initialBalance,
        trades: [],
        marketData: {},
    };

    // --- INITIALIZATION ---
    function init() {
        if (apiKey === 'YOUR_API_KEY_HERE' || apiKey === '') {
            alert('Please set your API key in script.js');
        }
        loadState();
        populatePairs();
        render();
        addEventListeners();
    }

    // --- STATE MANAGEMENT ---
    function loadState() {
        const savedState = localStorage.getItem('fundingChallengeState');
        if (savedState) {
            state = JSON.parse(savedState);
        }
    }

    function saveState() {
        localStorage.setItem('fundingChallengeState', JSON.stringify(state));
    }

    // --- API & DATA FETCHING ---
    async function fetchMarketData(pairs) {
        try {
            const url = `https://financialmodelingprep.com/api/v3/quote/${pairs.join(',')}?apikey=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();

            data.forEach(item => {
                state.marketData[item.symbol] = {
                    price: item.price,
                    spread: (item.ask - item.bid).toFixed(5)
                };
            });
            updateMarketInfo();
        } catch (error) {
            console.error("Failed to fetch market data:", error);
            currentPriceEl.textContent = 'API Error';
        }
    }

    function populatePairs() {
        const allPairs = [...majorForexPairs, ...majorCryptoPairs];
        pairSelectEl.innerHTML = allPairs.map(p => `<option value="${p}">${p}</option>`).join('');
        fetchMarketData(allPairs);
    }

    // --- UI RENDERING & UPDATES ---
    function render() {
        balanceEl.textContent = formatCurrency(state.balance);
        renderTradeHistory();
        updateCalculations();
    }

    function renderTradeHistory() {
        historyTableBody.innerHTML = state.trades.map(trade => `
            <tr>
                <td>${trade.pair}</td>
                <td>${trade.type}</td>
                <td>${trade.entryPrice}</td>
                <td>${trade.exitPrice || 'N/A'}</td>
                <td>${trade.lotSize}</td>
                <td class="${trade.pl > 0 ? 'profit' : trade.pl < 0 ? 'loss' : ''}">
                    ${trade.pl !== null ? formatCurrency(trade.pl) : 'N/A'}
                </td>
                <td>${trade.status}</td>
                <td>
                    ${trade.status === 'open' ? `<button class="btn-close" data-id="${trade.id}">Close</button>` : ''}
                    <button class="btn-delete" data-id="${trade.id}">Del</button>
                </td>
            </tr>
        `).join('');
    }
    
    function updateMarketInfo() {
        const selectedPair = pairSelectEl.value;
        const data = state.marketData[selectedPair];
        if (data) {
            currentPriceEl.textContent = data.price.toFixed(5);
            currentSpreadEl.textContent = data.spread;
            if (!entryPriceEl.value) {
                entryPriceEl.value = data.price.toFixed(5);
            }
        } else {
            currentPriceEl.textContent = 'N/A';
            currentSpreadEl.textContent = 'N/A';
        }
        updateCalculations();
    }

    // --- CALCULATIONS ---
    function updateCalculations() {
        const balance = state.balance;
        const riskPercent = parseFloat(riskPercentEl.value) || 0;
        const entryPrice = parseFloat(entryPriceEl.value) || 0;
        const stopLossPrice = parseFloat(stopLossPriceEl.value) || 0;
        const selectedPair = pairSelectEl.value;
        
        if (riskPercent <= 0 || entryPrice <= 0 || stopLossPrice <= 0) {
            riskAmountEl.textContent = formatCurrency(0);
            lotSizeEl.textContent = '0.00';
            return;
        }

        const riskAmount = balance * (riskPercent / 100);
        riskAmountEl.textContent = formatCurrency(riskAmount);

        const stopLossPips = Math.abs(entryPrice - stopLossPrice);
        const isCrypto = majorCryptoPairs.includes(selectedPair);
        
        let pipValuePerLot = 10; // Standard for most USD-based forex pairs
        if (selectedPair.includes('JPY')) {
            pipValuePerLot = 1000 / state.marketData[selectedPair]?.price || 130;
        } else if (isCrypto) {
            pipValuePerLot = 1; // For crypto, 1 unit change = $1
        }
        
        const riskPerLot = stopLossPips * (isCrypto ? 1 : (selectedPair.includes('JPY') ? 1000 : 100000)) * (isCrypto ? 1 : (1/pipValuePerLot * 0.0001));
        
        // Simplified calculation
        // riskPerLot = pips * pipValue * 10 (1 standard lot = 10$/pip)
        const moneyRiskPerLot = stopLossPips * (isCrypto ? 1 : getPipValue(selectedPair));
        
        const lotSize = (moneyRiskPerLot > 0) ? (riskAmount / moneyRiskPerLot) : 0;
        
        lotSizeEl.textContent = lotSize.toFixed(2);
    }
    
    function getPipValue(pair) {
        // This is a simplification. Real pip value depends on the quote currency.
        // Assuming a standard account where 1 lot = 100,000 units.
        if(pair.endsWith('USD')) return 10;
        if(pair.startsWith('USD')) {
            const quote = pair.substring(3);
            // This would need another API call for USD/quote price. We'll approximate.
            return 10 / (state.marketData[pair]?.price || 1);
        }
        return 10; // Default approximation
    }


    // --- EVENT HANDLERS & ACTIONS ---
    function addEventListeners() {
        pairSelectEl.addEventListener('change', updateMarketInfo);
        riskPercentEl.addEventListener('input', updateCalculations);
        stopLossPriceEl.addEventListener('input', updateCalculations);
        entryPriceEl.addEventListener('input', updateCalculations);
        logTradeBtn.addEventListener('click', logNewTrade);
        historyTableBody.addEventListener('click', handleTableClick);
    }

    function logNewTrade() {
        const lotSize = parseFloat(lotSizeEl.textContent);
        if (lotSize <= 0) {
            alert('Cannot log trade. Check risk parameters and ensure lot size is greater than 0.');
            return;
        }

        const trade = {
            id: Date.now(),
            pair: pairSelectEl.value,
            type: parseFloat(entryPriceEl.value) > parseFloat(stopLossPriceEl.value) ? 'BUY' : 'SELL',
            entryPrice: parseFloat(entryPriceEl.value),
            stopLoss: parseFloat(stopLossPriceEl.value),
            lotSize: lotSize.toFixed(2),
            status: 'open',
            exitPrice: null,
            pl: null,
        };

        state.trades.unshift(trade);
        saveAndRender();
    }

    function handleTableClick(e) {
        const target = e.target;
        const id = parseInt(target.dataset.id);

        if (target.classList.contains('btn-close')) {
            closeTrade(id);
        } else if (target.classList.contains('btn-delete')) {
            deleteTrade(id);
        }
    }

    function closeTrade(id) {
        const exitPriceStr = prompt('Enter the closing price for this trade:');
        const exitPrice = parseFloat(exitPriceStr);

        if (!exitPrice || isNaN(exitPrice)) {
            alert('Invalid closing price.');
            return;
        }

        const trade = state.trades.find(t => t.id === id);
        if (!trade) return;
        
        const pips = (exitPrice - trade.entryPrice) * (trade.type === 'BUY' ? 1 : -1);
        const isCrypto = majorCryptoPairs.includes(trade.pair);
        const contractSize = isCrypto ? 1 : 100000;
        
        const profitLoss = pips * contractSize * trade.lotSize;

        trade.status = 'closed';
        trade.exitPrice = exitPrice;
        trade.pl = profitLoss;
        state.balance += profitLoss;

        saveAndRender();
    }

    function deleteTrade(id) {
        if (confirm('Are you sure you want to delete this trade? This cannot be undone.')) {
            const tradeIndex = state.trades.findIndex(t => t.id === id);
            const trade = state.trades[tradeIndex];
            
            // If the trade was closed, revert the balance change
            if(trade.status === 'closed' && trade.pl !== null){
                state.balance -= trade.pl;
            }

            state.trades.splice(tradeIndex, 1);
            saveAndRender();
        }
    }
    
    function saveAndRender() {
        saveState();
        render();
    }

    // --- UTILITY FUNCTIONS ---
    function formatCurrency(value) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }
    
    // --- START THE APP ---
    init();
});
