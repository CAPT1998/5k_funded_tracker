document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const apiKey = 'b420fde249404b1781820e99092ccfdd'; // <--- IMPORTANT: PASTE YOUR NEW TWELVE DATA API KEY HERE
    const initialBalance = 5000;
    // Updated pair format for Twelve Data API (e.g., EUR/USD)
    const majorForexPairs = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'];
    const majorCryptoPairs = ['BTC/USD', 'ETH/USD', 'XRP/USD', 'LTC/USD', 'BCH/USD', 'ADA/USD', 'SOL/USD'];

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
            alert('Please set your Twelve Data API key in script.js');
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

    // --- API & DATA FETCHING (using Twelve Data) ---
    async function fetchMarketData(pairs) {
        try {
            // Use the Twelve Data endpoint for real-time price
            const url = `https://api.twelvedata.com/price?symbol=${pairs.join(',')}&apikey=${apiKey}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const data = await response.json();

            // Twelve Data returns an object with symbols as keys
            for (const symbol in data) {
                state.marketData[symbol] = {
                    price: parseFloat(data[symbol].price),
                    spread: 'N/A' // Spread is not provided in this endpoint
                };
            }
            updateMarketInfo();
        } catch (error) {
            console.error("Failed to fetch market data:", error);
            currentPriceEl.textContent = 'API Error';
            // Handle cases where some symbols might fail
             for (const pair of pairs) {
                if (!state.marketData[pair]) {
                   state.marketData[pair] = { price: 0, spread: 'N/A' };
                }
            }
            updateMarketInfo();
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
        if (data && data.price > 0) {
            const price = data.price;
            currentPriceEl.textContent = price.toFixed(5);
            currentSpreadEl.textContent = data.spread;
            if (!entryPriceEl.value || entryPriceEl.value === "0.00000") {
                entryPriceEl.value = price.toFixed(5);
            }
        } else {
            currentPriceEl.textContent = 'Loading...';
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

        if (riskPercent <= 0 || entryPrice <= 0 || stopLossPrice <= 0 || !selectedPair) {
            riskAmountEl.textContent = formatCurrency(0);
            lotSizeEl.textContent = '0.00';
            return;
        }

        const riskAmount = balance * (riskPercent / 100);
        riskAmountEl.textContent = formatCurrency(riskAmount);

        // This calculation is for points/pips
        const priceDifference = Math.abs(entryPrice - stopLossPrice);

        // Pip value logic
        const isCrypto = majorCryptoPairs.includes(selectedPair);
        const isJpyPair = selectedPair.includes('JPY');
        const pointValue = isJpyPair ? 0.01 : 0.0001;
        
        let valuePerLot = 0;
        if(isCrypto) {
            // For crypto like BTC/USD, 1 point movement = $1. A lot size of 1 means 1 coin.
            // Risk per lot = price difference * 1
            valuePerLot = priceDifference;
        } else {
            // For forex, 1 standard lot (100,000 units)
            // Pip value is approx $10 for XXX/USD pairs
            const pips = priceDifference / pointValue;
            valuePerLot = pips * 10; // Simplified: Assumes ~$10 per pip which is standard for XXX/USD pairs
        }

        const lotSize = (valuePerLot > 0) ? (riskAmount / valuePerLot) : 0;
        lotSizeEl.textContent = lotSize.toFixed(2);
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

        if (exitPriceStr === null || isNaN(exitPrice)) {
            return; // User cancelled or entered invalid input
        }

        const trade = state.trades.find(t => t.id === id);
        if (!trade) return;

        const priceDifference = (exitPrice - trade.entryPrice) * (trade.type === 'BUY' ? 1 : -1);
        const isCrypto = majorCryptoPairs.includes(trade.pair);
        const isJpyPair = trade.pair.includes('JPY');
        const pointValue = isJpyPair ? 0.01 : 0.0001;

        let profitLoss = 0;
        if (isCrypto) {
            // For crypto, P/L = price difference * lot size (number of coins)
            profitLoss = priceDifference * trade.lotSize;
        } else {
            // For forex, P/L = pips * pip value * lot size
            const pips = priceDifference / pointValue;
            const pipValue = 10; // Simplified pip value
            profitLoss = pips * pipValue * trade.lotSize;
        }
        
        trade.status = 'closed';
        trade.exitPrice = exitPrice;
        trade.pl = profitLoss;
        state.balance += profitLoss;

        saveAndRender();
    }



    function deleteTrade(id) {
        if (confirm('Are you sure you want to delete this trade? This cannot be undone.')) {
            const tradeIndex = state.trades.findIndex(t => t.id === id);
            if (tradeIndex === -1) return;
            
            const trade = state.trades[tradeIndex];
            
            // If the trade was closed, revert the balance change before deleting
            if (trade.status === 'closed' && trade.pl !== null) {
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
