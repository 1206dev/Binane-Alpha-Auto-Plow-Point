let pauseFlg = false;
let stopFlg = false;
let amount = 100; // default 100usdt per order
let maxCostFee = 2; // default 2usdt fee, when total fee > maxCostFee, stop order
let maxTotalAmount = 16500; // default order total 16.500 usdt = 16 point (with coint x4 point), when totalAmount > maxTotalAmount, stop order
let customize = 0.01; // Set the slippage between 2 orders. If the price slips too much, the order will be suspended until the price stabilizes and the order will automatically continue. Default 1%.
let oldPrice = 0;
let realBuyPrice = 0;
let realSellPrice = 0;
let startBalance = 0;
let oldBalance = 0;

let totalFee = 0;
let currentTotalAmount = 0;

const setInputValue = (element, value, options = {}) => {
    if (!element) {
        console.error('Set value failed');
        return false;
    }

    const isSlider = element.getAttribute('role') === 'slider';
    const { triggerChange = isSlider, updateAria = isSlider } = options;

    const wasDisabled = element.disabled;
    const wasReadOnly = element.readOnly;
    if (wasDisabled) element.disabled = false;
    if (wasReadOnly) element.readOnly = false;

    try {
        let formattedValue = typeof value === 'number' ? value.toString() : String(value);
        formattedValue = formattedValue.replace('.', ',');

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
        ).set;

        nativeInputValueSetter.call(element, formattedValue);
        element.setAttribute('value', formattedValue);

        if (updateAria) {
            element.setAttribute('aria-valuenow', formattedValue);
            element.setAttribute('aria-valuetext', `${formattedValue} units`);
        }

        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        element.dispatchEvent(inputEvent);

        if (triggerChange) {
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            element.dispatchEvent(changeEvent);
        }

    } catch (error) {
        console.error('Set value failed:', error);
        return false;
    } finally {
        if (wasDisabled) element.disabled = true;
        if (wasReadOnly) element.readOnly = true;
    }

    return true;
};

const simulateClick = (element, type = 'button') => {
    if (!element) {
        console.error(`${type} not found`);
        return false;
    }

    if (element.disabled) {
        console.warn(`${type} is disabled, click ignored`);
        return false;
    }

    const mouseClickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: element.getBoundingClientRect().left + 10,
        clientY: element.getBoundingClientRect().top + 10
    });
    const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
    const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });

    element.focus();
    element.dispatchEvent(mouseDownEvent);
    element.dispatchEvent(mouseClickEvent);
    element.dispatchEvent(mouseUpEvent);
    console.log(`${type} clicked`);
    return true;
};

const randomDelay = (min = 1000, max = 3000) => {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`Waiting for ${ms}ms`);
    return new Promise(resolve => setTimeout(resolve, ms));
};

const clickConfirmButton = () => {
    const button = document.querySelector('.bn-modal-wrap .bn-button.bn-button__primary');
    if (!button) {
        console.error('Confirm button not found');
        return false;
    }
    return simulateClick(button, 'Confirm button');
};

const executeTrade = async (iteration) => {
    try {
        console.log(`Starting trade order ${iteration}`);

        const buyPriceInput = document.querySelector('#limitPrice');
        const [buyInputAmount, sellPriceInput] = document.querySelectorAll('#limitTotal')

        const slider = document.querySelector('input[role="slider"]');

        if (!buyPriceInput || !buyInputAmount || !slider || !sellPriceInput) {
            stopFlg = true;
            throw new Error('Required elements not found');
        }

        const el = Array.from(document.querySelectorAll('div.text-PrimaryText'))
            .find(div => div.textContent.trim().startsWith('$'));

        let currentPrice = 0;
        if (el) {
            currentPrice = parseFloat(el.textContent.trim().replace('$', '').replace(',', '.'));
        } else {
            currentPrice = 0;
            stopFlg = true;
            throw new Error('Not found current price');
        }

        if (oldPrice !== 0 && (currentPrice - oldPrice) / 100 > customize) {
            pauseFlg = true;
            throw new Error('Price slippage too much');
        }


        oldPrice = currentPrice;
        realBuyPrice = parseFloat((currentPrice + (currentPrice * customize)).toFixed(6));
        realSellPrice = parseFloat((currentPrice - (currentPrice * customize)).toFixed(6));

        if (!setInputValue(buyPriceInput, realBuyPrice)) {
            stopFlg = true;
            throw new Error('Failed to set buy price input value');
        }

        await randomDelay(200, 300);

        if (!setInputValue(sellPriceInput, realSellPrice)) {
            stopFlg = true;
            throw new Error('Failed to set sell price input value');
        }

        if (!setInputValue(buyInputAmount, amount)) {
            stopFlg = true;
            throw new Error('Failed to set buy input value');
        }

        await randomDelay(200, 500);

        const button = document.querySelector('.flexlayout__tab .flexlayout__tab_moveable .bn-button.bn-button__buy');

        if (button) {
            button.click();
        }

        await randomDelay(1000, 1500);

        if (!clickConfirmButton()) {
            stopFlg = true;
            throw new Error('Failed to click Confirm button for Buy');
        }
    } catch (error) {
        console.error(`Error during trade iteration ${iteration}:`, error.message);
        throw error;
    }
};

const startTrade = async (maxTotal = maxTotalAmount) => {
    let successfulIterations = 0;
    let failedIterations = 0;

    stopFlg = false;
    pauseFlg = false;

    while (currentTotalAmount < maxTotal && !stopFlg) {
        const i = successfulIterations + failedIterations + 1;

        if (stopFlg) {
            console.log(`Trade loop stopped manually at total ${currentTotalAmount.toFixed(6)} / ${maxTotal}`);
            break;
        }

        try {
            console.log(`=== Starting iteration ${i} ===`);

            const el = Array.from(document.querySelectorAll('.flexlayout__tab_moveable .t-caption1 .bn-flex div.text-PrimaryText'))
                .find(div => div.textContent.trim().includes('USDT'));

            let currentBalance = 0;

            if (el) {
                const text = el.textContent.trim();
                const match = text.match(/([\d.,]+)\s*USDT/);
                if (match && match[1]) {
                    currentBalance = parseFloat(parseFloat(match[1].replace(',', '')).toFixed(6));
                    if (i === 1) {
                        startBalance = currentBalance;
                    }
                    if (currentBalance < startBalance - amount) {
                        pauseFlg = true;
                        throw new Error('Order not done');
                    }
                    if (currentBalance < startBalance - maxCostFee) {
                        stopFlg = true;
                        throw new Error('Max cost fee too high');
                    }
                } else {
                    stopFlg = true;
                    throw new Error('Not found current balance');
                }
            } else {
                stopFlg = true;
                throw new Error('Not found current balance');
            }

            oldBalance = currentBalance;


            await executeTrade(i);
            successfulIterations++;
            currentTotalAmount += amount;
            console.log(`Iteration ${i} succeeded - Total traded: ${currentTotalAmount.toFixed(6)} / ${maxTotal}`);
        } catch (error) {
            failedIterations++;
            console.error(`Iteration ${i} failed: ${error.message}`);
        }

        await randomDelay(4500, 5500);
    }

    console.log(`Trade loop completed: ${successfulIterations} successful, ${failedIterations} failed`);
    console.log(`Total traded amount: ${currentTotalAmount} / ${maxTotal}`);
};

const stopTrade = () => {
    stopFlg = true;
}

startTrade();
