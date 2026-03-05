import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadWorkerFunctions } from './extract-worker.js';

let w;
let postMessageMock;

beforeEach(() => {
    postMessageMock = vi.fn();
    w = loadWorkerFunctions(postMessageMock);
    w.setStopRequested(false);
});

// ============================================================
// normalizeStock
// ============================================================
describe('normalizeStock', () => {
    it('returns INFINITY for missing denominations', () => {
        const stock = w.normalizeStock([100, 50, 20], undefined);
        expect(stock[100]).toBe(w.INFINITY);
        expect(stock[50]).toBe(w.INFINITY);
        expect(stock[20]).toBe(w.INFINITY);
    });

    it('returns INFINITY for denominations not in bundlesStock', () => {
        const stock = w.normalizeStock([100, 50, 20], { 100: 5 });
        expect(stock[100]).toBe(5);
        expect(stock[50]).toBe(w.INFINITY);
        expect(stock[20]).toBe(w.INFINITY);
    });

    it('returns exact values for specified stock', () => {
        const stock = w.normalizeStock([100, 50, 20], { 100: 10, 50: 5, 20: 3 });
        expect(stock[100]).toBe(10);
        expect(stock[50]).toBe(5);
        expect(stock[20]).toBe(3);
    });

    it('handles zero stock', () => {
        const stock = w.normalizeStock([100, 50], { 100: 0, 50: 0 });
        expect(stock[100]).toBe(0);
        expect(stock[50]).toBe(0);
    });
});

// ============================================================
// compareScores
// ============================================================
describe('compareScores', () => {
    it('returns 0 for equal scores', () => {
        expect(w.compareScores([1, 2, 3], [1, 2, 3])).toBe(0);
    });

    it('compares by first element', () => {
        expect(w.compareScores([1, 2, 3], [2, 2, 3])).toBeLessThan(0);
        expect(w.compareScores([3, 2, 3], [1, 2, 3])).toBeGreaterThan(0);
    });

    it('compares by second element when first is equal', () => {
        expect(w.compareScores([1, 1, 3], [1, 2, 3])).toBeLessThan(0);
        expect(w.compareScores([1, 3, 3], [1, 2, 3])).toBeGreaterThan(0);
    });

    it('compares by third element when first two are equal', () => {
        expect(w.compareScores([1, 2, 1], [1, 2, 3])).toBeLessThan(0);
        expect(w.compareScores([1, 2, 5], [1, 2, 3])).toBeGreaterThan(0);
    });

    it('lexicographic ordering with negative values', () => {
        expect(w.compareScores([1, 1, -100], [1, 1, -50])).toBeLessThan(0);
    });
});

// ============================================================
// scoreIdeal / scoreLoose / scorePartial
// ============================================================
describe('scoreIdeal', () => {
    it('single denomination: kinds=1', () => {
        const denoms = [100, 50, 20];
        const score = w.scoreIdeal(1, [30, 0, 0], denoms);
        expect(score[0]).toBe(1);  // blocks
        expect(score[1]).toBe(1);  // kinds
        expect(score[2]).toBe(-100); // -avg
    });

    it('multiple denominations: correct kinds count', () => {
        const denoms = [100, 50, 20];
        const score = w.scoreIdeal(2, [15, 10, 5], denoms);
        expect(score[0]).toBe(2);  // blocks
        expect(score[1]).toBe(3);  // kinds
    });

    it('correct average calculation', () => {
        const denoms = [100, 50];
        // 10 bundles of 100, 20 bundles of 50 → avg = (100*10 + 50*20)/30 = 2000/30
        const score = w.scoreIdeal(1, [10, 20], denoms);
        expect(score[2]).toBeCloseTo(-2000 / 30, 5);
    });

    it('empty counts (all zeros)', () => {
        const denoms = [100, 50, 20];
        const score = w.scoreIdeal(0, [0, 0, 0], denoms);
        expect(score[0]).toBe(0);
        expect(score[1]).toBe(0);
        expect(score[2]).toEqual(-0); // avg=0 → -0
    });
});

describe('scoreLoose', () => {
    it('single denomination', () => {
        const denoms = [100, 50, 20];
        const score = w.scoreLoose([5, 0, 0], denoms);
        expect(score[0]).toBe(5);   // totalBundles
        expect(score[1]).toBe(1);   // kinds
        expect(score[2]).toBe(-100); // -avg
    });

    it('multiple denominations', () => {
        const denoms = [100, 50];
        const score = w.scoreLoose([3, 7], denoms);
        expect(score[0]).toBe(10);  // totalBundles
        expect(score[1]).toBe(2);   // kinds
    });
});

describe('scorePartial', () => {
    it('single denomination', () => {
        const denoms = [100, 50, 20];
        const score = w.scorePartial([10, 0, 0], denoms);
        expect(score[0]).toBe(10);  // totalBills
        expect(score[1]).toBe(1);   // kinds
        expect(score[2]).toBe(-100); // -avg
    });

    it('multiple denominations', () => {
        const denoms = [100, 50];
        const score = w.scorePartial([5, 10], denoms);
        expect(score[0]).toBe(15);  // totalBills
        expect(score[1]).toBe(2);   // kinds
    });

    it('score tuple structure', () => {
        const denoms = [100, 50, 20];
        const score = w.scorePartial([3, 2, 5], denoms);
        expect(score).toHaveLength(3);
        expect(typeof score[0]).toBe('number');
        expect(typeof score[1]).toBe('number');
        expect(typeof score[2]).toBe('number');
    });
});

// ============================================================
// enumerateIdealConfigs
// ============================================================
describe('enumerateIdealConfigs', () => {
    const USD = [100, 50, 20, 10];
    const EUR = [100, 50, 20];
    const JPY = [10000, 5000, 1000];

    function unlimitedStock(denoms) {
        const stock = {};
        denoms.forEach(d => stock[d] = 1e9);
        return stock;
    }

    it('USD $300,000 unlimited stock → finds ideal blocks', () => {
        const stock = unlimitedStock(USD);
        // $300,000 / 100 bills per bundle = 3000 units
        // 3000 units / 30 bundles per block = 1 block minimum with $100 denom
        // bundleValue = denom * BUNDLE_SIZE = 100 * 100 = 10000
        // 1 block = 30 bundles × $100 denom × 100 bills = $300,000
        const results = w.enumerateIdealConfigs(300000, USD, stock);
        expect(results.length).toBeGreaterThan(0);

        // Verify all solutions sum to exact target
        const denomsSorted = [...USD].sort((a, b) => b - a);
        for (const [blocks, bundleCounts] of results) {
            const totalBundles = bundleCounts.reduce((s, c) => s + c, 0);
            expect(totalBundles).toBe(blocks * 30);
            const totalUnits = bundleCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(totalUnits * w.BUNDLE_SIZE).toBe(300000);
        }
    });

    it('USD $3,000,000 unlimited → 10 ideal blocks', () => {
        const stock = unlimitedStock(USD);
        const results = w.enumerateIdealConfigs(3000000, USD, stock);
        expect(results.length).toBeGreaterThan(0);

        // Should include a solution with 10 blocks of pure $100
        const denomsSorted = [...USD].sort((a, b) => b - a);
        const pure100 = results.find(([blocks, counts]) =>
            blocks === 10 && counts[0] === 30 * 10
        );
        // 10 blocks × 30 bundles × $100 × 100 bills = $3,000,000
        expect(pure100).toBeDefined();
    }, 15000);

    it('amount not divisible by BUNDLE_SIZE → returns []', () => {
        const stock = unlimitedStock(USD);
        // $150 → 150/100 = 1.5, not integer
        expect(w.enumerateIdealConfigs(150, USD, stock)).toEqual([]);
    });

    it('amount = 0 → returns trivial zero-block solution', () => {
        const stock = unlimitedStock(USD);
        // blocks=0 with all-zero bundle counts is a valid (trivial) solution
        const results = w.enumerateIdealConfigs(0, USD, stock);
        expect(results.length).toBe(1);
        expect(results[0][0]).toBe(0); // 0 blocks
        expect(results[0][1].every(c => c === 0)).toBe(true);
    });

    it('limited stock: $100 bills, stock=30 bundles → exactly 1 block for $300,000', () => {
        const stock = { 100: 30, 50: 0, 20: 0, 10: 0 };
        const results = w.enumerateIdealConfigs(300000, USD, stock);
        expect(results.length).toBe(1);
        expect(results[0][0]).toBe(1); // 1 block
    });

    it('stock insufficient (need 30 bundles but have 20) → returns []', () => {
        const stock = { 100: 20, 50: 0, 20: 0, 10: 0 };
        // Need 30 bundles of $100 for 1 block, but only have 20
        expect(w.enumerateIdealConfigs(300000, USD, stock)).toEqual([]);
    });

    it('EUR unlimited → finds blocks with multiple denominations', () => {
        const stock = unlimitedStock(EUR);
        // €300,000 with EUR denoms [100, 50, 20]
        const results = w.enumerateIdealConfigs(300000, EUR, stock);
        expect(results.length).toBeGreaterThan(0);

        const denomsSorted = [...EUR].sort((a, b) => b - a);
        for (const [blocks, bundleCounts] of results) {
            const totalUnits = bundleCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(totalUnits * w.BUNDLE_SIZE).toBe(300000);
        }
    });

    it('JPY unlimited → finds blocks with ¥10000/¥5000/¥1000', () => {
        const stock = unlimitedStock(JPY);
        // ¥30,000,000: units = 30000000/100 = 300000
        // With ¥10000 denom: 1 block = 30 bundles × 10000 units = 300000 units → 1 block
        const results = w.enumerateIdealConfigs(30000000, JPY, stock);
        expect(results.length).toBeGreaterThan(0);

        const denomsSorted = [...JPY].sort((a, b) => b - a);
        for (const [blocks, bundleCounts] of results) {
            const totalUnits = bundleCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(totalUnits * w.BUNDLE_SIZE).toBe(30000000);
        }
    });

    it('multiple denominations enable multiple solutions', () => {
        const stock = unlimitedStock(EUR);
        // €300,000 can be made with different splits of 100/50/20
        const results = w.enumerateIdealConfigs(300000, EUR, stock);
        // Should find multiple distinct solutions
        expect(results.length).toBeGreaterThan(1);
    });

    it('respects maxSolutions parameter', () => {
        const stock = unlimitedStock(EUR);
        // With unlimited stock and EUR, €300,000 has many solutions
        const results = w.enumerateIdealConfigs(300000, EUR, stock, 3);
        expect(results.length).toBeLessThanOrEqual(3);
        expect(results.length).toBeGreaterThan(0);
    });

    it('every solution sums to exact target amount', () => {
        const stock = unlimitedStock(USD);
        const amount = 600000;
        const results = w.enumerateIdealConfigs(amount, USD, stock);
        const denomsSorted = [...USD].sort((a, b) => b - a);

        for (const [blocks, bundleCounts] of results) {
            const totalUnits = bundleCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(totalUnits * w.BUNDLE_SIZE).toBe(amount);
            const totalBundles = bundleCounts.reduce((s, c) => s + c, 0);
            expect(totalBundles).toBe(blocks * 30);
        }
    });
});

// ============================================================
// enumerateLooseConfigs
// ============================================================
describe('enumerateLooseConfigs', () => {
    const USD = [100, 50, 20, 10];

    function unlimitedStock(denoms) {
        const stock = {};
        denoms.forEach(d => stock[d] = 1e9);
        return stock;
    }

    it('USD $10,000 unlimited → finds bundle combos', () => {
        const stock = unlimitedStock(USD);
        // $10,000 / 100 = 100 units
        // 1 bundle of $100 denom: 100 units × 100 = 10000 → works
        const results = w.enumerateLooseConfigs(10000, USD, stock);
        expect(results.length).toBeGreaterThan(0);
    });

    it('amount not divisible by BUNDLE_SIZE → returns []', () => {
        const stock = unlimitedStock(USD);
        // $550 → 550/100 = 5.5, not integer
        expect(w.enumerateLooseConfigs(550, USD, stock)).toEqual([]);
    });

    it('limited stock constrains solutions', () => {
        const stock = { 100: 1, 50: 0, 20: 0, 10: 0 };
        // $10,000: need 1 bundle of $100 (100 units × $100 = $10,000)
        const results = w.enumerateLooseConfigs(10000, USD, stock);
        expect(results.length).toBe(1);
    });

    it('amount that cannot be fulfilled with stock → returns []', () => {
        const stock = { 100: 0, 50: 0, 20: 0, 10: 0 };
        expect(w.enumerateLooseConfigs(10000, USD, stock)).toEqual([]);
    });

    it('small: USD $10,000 = 1 bundle of $100 denom', () => {
        const stock = unlimitedStock(USD);
        const results = w.enumerateLooseConfigs(10000, USD, stock);
        const denomsSorted = [...USD].sort((a, b) => b - a);
        // Find the solution with just 1 bundle of $100
        const pure100 = results.find(counts =>
            counts[0] === 1 && counts.slice(1).every(c => c === 0)
        );
        expect(pure100).toBeDefined();
    });

    it('verify each solution: sum(bundleCounts[i] * denoms[i]) === units', () => {
        const stock = unlimitedStock(USD);
        const amount = 50000;
        const units = amount / w.BUNDLE_SIZE; // 500
        const results = w.enumerateLooseConfigs(amount, USD, stock);
        const denomsSorted = [...USD].sort((a, b) => b - a);

        for (const bundleCounts of results) {
            const total = bundleCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(total).toBe(units);
        }
    });
});

// ============================================================
// enumeratePartialConfigs
// ============================================================
describe('enumeratePartialConfigs', () => {
    const USD = [100, 50, 20, 10];

    function unlimitedStock(denoms) {
        const stock = {};
        denoms.forEach(d => stock[d] = 1e9);
        return stock;
    }

    it('amount not divisible by 100 → finds partial solutions', () => {
        const stock = unlimitedStock(USD);
        // $550 = 5×$100 + 1×$50, or 11×$50, etc.
        const results = w.enumeratePartialConfigs(550, USD, stock);
        expect(results.length).toBeGreaterThan(0);
    });

    it('amount $1,000: multiple solutions', () => {
        const stock = unlimitedStock(USD);
        const results = w.enumeratePartialConfigs(1000, USD, stock);
        expect(results.length).toBeGreaterThan(1);

        const denomsSorted = [...USD].sort((a, b) => b - a);
        for (const billCounts of results) {
            const total = billCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(total).toBe(1000);
        }
    });

    it('very limited stock', () => {
        // Only 1 bundle of $100 = 100 bills max
        const stock = { 100: 1, 50: 1, 20: 1, 10: 1 };
        const results = w.enumeratePartialConfigs(550, USD, stock);
        // Should find solutions within stock limits
        const denomsSorted = [...USD].sort((a, b) => b - a);
        for (const billCounts of results) {
            const total = billCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(total).toBe(550);
            // Verify stock constraint: bills used <= stock * BUNDLE_SIZE
            denomsSorted.forEach((d, i) => {
                expect(billCounts[i]).toBeLessThanOrEqual(stock[d] * w.BUNDLE_SIZE);
            });
        }
    });

    it('amount that cannot be fulfilled → returns []', () => {
        const stock = { 100: 0, 50: 0, 20: 0, 10: 0 };
        expect(w.enumeratePartialConfigs(550, USD, stock)).toEqual([]);
    });

    it('verify each solution: sum(billCounts[i] * denoms[i]) === amount', () => {
        const stock = unlimitedStock(USD);
        const amount = 1230;
        const results = w.enumeratePartialConfigs(amount, USD, stock);
        const denomsSorted = [...USD].sort((a, b) => b - a);

        for (const billCounts of results) {
            const total = billCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(total).toBe(amount);
        }
    });
});

// ============================================================
// searchBlocks / searchBundles / searchWithTimeout (DFS internals)
// ============================================================
describe('searchBlocks (DFS)', () => {
    it('produces valid solutions that sum to target', () => {
        const denoms = [100, 50, 20, 10];
        const stock = { 100: 1e9, 50: 1e9, 20: 1e9, 10: 1e9 };
        const solutions = [];
        const cur = [0, 0, 0, 0];
        const context = { startTime: Date.now(), maxTime: 5000, maxSolutions: 100, solutionCount: 0 };

        // 1 block = 30 bundles, value target = 3000 units (300000/100)
        w.searchBlocks(denoms, 1, 0, 30, 3000, cur, solutions, stock, context);
        expect(solutions.length).toBeGreaterThan(0);

        for (const [blocks, bundleCounts] of solutions) {
            expect(blocks).toBe(1);
            const totalBundles = bundleCounts.reduce((s, c) => s + c, 0);
            expect(totalBundles).toBe(30);
            const totalValue = bundleCounts.reduce((s, c, i) => s + denoms[i] * c, 0);
            expect(totalValue).toBe(3000);
        }
    });

    it('respects stock constraints', () => {
        const denoms = [100, 50];
        const stock = { 100: 5, 50: 5 };
        const solutions = [];
        const cur = [0, 0];
        const context = { startTime: Date.now(), maxTime: 5000, maxSolutions: 100, solutionCount: 0 };

        // Need 30 bundles but only have 5+5=10 → no solutions
        w.searchBlocks(denoms, 1, 0, 30, 3000, cur, solutions, stock, context);
        expect(solutions.length).toBe(0);
    });

    it('smart sampling: step > 1 for range > 1000', () => {
        // With INFINITY stock and many possible bundle counts,
        // the range will exceed 1000 and sampling kicks in
        const denoms = [1]; // 1-unit denom means maxForD can be very large
        const stock = { 1: 1e9 };
        const solutions = [];
        const cur = [0];
        const context = { startTime: Date.now(), maxTime: 5000, maxSolutions: 10, solutionCount: 0 };

        // 1 block = 30 bundles, value = 30 (30 bundles × 1 unit denom)
        w.searchBlocks(denoms, 1, 0, 30, 30, cur, solutions, stock, context);
        expect(solutions.length).toBeGreaterThan(0);
    });

    it('stopRequested halts search', () => {
        const denoms = [100, 50, 20, 10];
        const stock = { 100: 1e9, 50: 1e9, 20: 1e9, 10: 1e9 };
        const solutions = [];
        const cur = [0, 0, 0, 0];
        const context = { startTime: Date.now(), maxTime: 5000, maxSolutions: 1000, solutionCount: 0 };

        w.setStopRequested(true);
        w.searchBlocks(denoms, 1, 0, 30, 3000, cur, solutions, stock, context);
        expect(solutions.length).toBe(0);
    });
});

describe('searchBundles (DFS)', () => {
    it('produces valid solutions that sum to target', () => {
        const denoms = [100, 50, 20, 10];
        const stock = { 100: 1e9, 50: 1e9, 20: 1e9, 10: 1e9 };
        const solutions = [];
        const cur = [0, 0, 0, 0];
        const context = { startTime: Date.now(), maxTime: 5000, maxSolutions: 100, solutionCount: 0 };

        // target: 500 units (e.g., $50,000 / 100)
        w.searchBundles(denoms, 0, 500, cur, solutions, stock, context);
        expect(solutions.length).toBeGreaterThan(0);

        for (const bundleCounts of solutions) {
            const total = bundleCounts.reduce((s, c, i) => s + denoms[i] * c, 0);
            expect(total).toBe(500);
        }
    });
});

describe('searchWithTimeout (DFS)', () => {
    it('produces valid partial solutions', () => {
        const denoms = [100, 50, 20, 10];
        const stock = { 100: 1e9, 50: 1e9, 20: 1e9, 10: 1e9 };
        const solutions = [];
        const cur = [0, 0, 0, 0];

        // target: 550 bills worth (i.e., amount=$550)
        w.searchWithTimeout(denoms, 0, 550, cur, solutions, stock, Date.now(), 5000, 100);
        expect(solutions.length).toBeGreaterThan(0);

        for (const billCounts of solutions) {
            const total = billCounts.reduce((s, c, i) => s + denoms[i] * c, 0);
            expect(total).toBe(550);
        }
    });
});

// ============================================================
// self.onmessage integration
// ============================================================
describe('self.onmessage integration', () => {
    it('start message → receive solutions + complete', () => {
        postMessageMock.mockClear();

        w.triggerMessage({
            type: 'start',
            data: {
                amount: 300000,
                currencyCode: 'USD',
                maxVariants: 10,
                bundlesStock: undefined,
            },
        });

        // Should have received solution messages and a complete message
        const messages = postMessageMock.mock.calls.map(c => c[0]);
        const solutions = messages.filter(m => m.type === 'solution');
        const complete = messages.filter(m => m.type === 'complete');

        expect(solutions.length).toBeGreaterThan(0);
        expect(complete.length).toBe(1);
        expect(complete[0].data.hasIdeal).toBe(true);
    });

    it('invalid currency → receive error', () => {
        postMessageMock.mockClear();

        w.triggerMessage({
            type: 'start',
            data: {
                amount: 1000,
                currencyCode: 'XYZ',
                maxVariants: 10,
                bundlesStock: undefined,
            },
        });

        const messages = postMessageMock.mock.calls.map(c => c[0]);
        const errors = messages.filter(m => m.type === 'error');
        expect(errors.length).toBe(1);
        expect(errors[0].data.message).toContain('XYZ');
    });

    it('ideal found → no loose/partial attempted', () => {
        postMessageMock.mockClear();

        w.triggerMessage({
            type: 'start',
            data: {
                amount: 300000,
                currencyCode: 'USD',
                maxVariants: 10,
                bundlesStock: undefined,
            },
        });

        const complete = postMessageMock.mock.calls.map(c => c[0]).find(m => m.type === 'complete');
        expect(complete.data.hasIdeal).toBe(true);
        expect(complete.data.hasLoose).toBe(false);
        expect(complete.data.hasPartial).toBe(false);
    });

    it('amount not divisible by 100 → falls through to partial', () => {
        postMessageMock.mockClear();

        w.triggerMessage({
            type: 'start',
            data: {
                amount: 550,
                currencyCode: 'USD',
                maxVariants: 10,
                bundlesStock: undefined,
            },
        });

        const complete = postMessageMock.mock.calls.map(c => c[0]).find(m => m.type === 'complete');
        expect(complete.data.hasIdeal).toBe(false);
        expect(complete.data.hasLoose).toBe(false);
        expect(complete.data.hasPartial).toBe(true);
    });

    it('stop message → sets stopRequested', () => {
        w.triggerMessage({ type: 'stop' });
        expect(w.getStopRequested()).toBe(true);
    });

    it('GBP start message → receive solutions + complete', () => {
        postMessageMock.mockClear();

        w.triggerMessage({
            type: 'start',
            data: {
                amount: 150000,
                currencyCode: 'GBP',
                maxVariants: 10,
                bundlesStock: undefined,
            },
        });

        const messages = postMessageMock.mock.calls.map(c => c[0]);
        const solutions = messages.filter(m => m.type === 'solution');
        const complete = messages.filter(m => m.type === 'complete');

        expect(solutions.length).toBeGreaterThan(0);
        expect(complete.length).toBe(1);
    });

    it('maxVariants limits number of solutions from worker', () => {
        postMessageMock.mockClear();

        w.triggerMessage({
            type: 'start',
            data: {
                amount: 300000,
                currencyCode: 'EUR',
                maxVariants: 2,
                bundlesStock: undefined,
            },
        });

        const solutions = postMessageMock.mock.calls.map(c => c[0]).filter(m => m.type === 'solution');
        expect(solutions.length).toBeLessThanOrEqual(2);
        expect(solutions.length).toBeGreaterThan(0);
    });
});

// ============================================================
// Regression tests (from git history)
// ============================================================
describe('regression tests', () => {
    it('stock should become 0, not infinite, after being fully used (ad34461)', () => {
        // This tests that when stock is exactly 0, normalizeStock returns 0
        // (not INFINITY), which is the fix from commit ad34461
        const stock = w.normalizeStock([100, 50, 20], { 100: 0, 50: 5, 20: 0 });
        expect(stock[100]).toBe(0);
        expect(stock[20]).toBe(0);
        expect(stock[50]).toBe(5);
    });

    it('bundle loose algorithm correctness (0195698)', () => {
        // Verify loose bundles produce correct results for a non-trivial case
        const USD = [100, 50, 20, 10];
        const stock = { 100: 1e9, 50: 1e9, 20: 1e9, 10: 1e9 };
        const amount = 50000;
        const results = w.enumerateLooseConfigs(amount, USD, stock);
        const denomsSorted = [...USD].sort((a, b) => b - a);

        expect(results.length).toBeGreaterThan(0);

        // Every solution must sum to exact units
        const units = amount / w.BUNDLE_SIZE;
        for (const bundleCounts of results) {
            const total = bundleCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(total).toBe(units);
        }
    });
});

// ============================================================
// GCD optimization
// ============================================================
describe('GCD optimization', () => {
    const USD = [100, 50, 20, 10];

    function unlimitedStock(denoms) {
        const stock = {};
        denoms.forEach(d => stock[d] = 1e9);
        return stock;
    }

    it('gcd works correctly', () => {
        expect(w.gcd(100, 50)).toBe(50);
        expect(w.gcd(100, 20)).toBe(20);
        expect(w.gcd(10, 20)).toBe(10);
    });

    it('gcdArray works correctly', () => {
        expect(w.gcdArray([100, 50, 20, 10])).toBe(10);
        expect(w.gcdArray([100, 50, 20])).toBe(10);
        expect(w.gcdArray([10000, 5000, 1000])).toBe(1000);
    });

    it('ideal returns [] instantly when units not divisible by GCD ($6,530,500 USD)', () => {
        const stock = unlimitedStock(USD);
        // units = 6530500/100 = 65305, GCD(100,50,20,10)=10, 65305%10=5 → impossible
        const start = Date.now();
        const results = w.enumerateIdealConfigs(6530500, USD, stock);
        const elapsed = Date.now() - start;
        expect(results).toEqual([]);
        expect(elapsed).toBeLessThan(50); // should be instant, not 5 seconds
    });

    it('loose returns [] instantly when units not divisible by GCD ($6,530,500 USD)', () => {
        const stock = unlimitedStock(USD);
        const start = Date.now();
        const results = w.enumerateLooseConfigs(6530500, USD, stock);
        const elapsed = Date.now() - start;
        expect(results).toEqual([]);
        expect(elapsed).toBeLessThan(50);
    });

    it('partial finds solutions for $6,530,500 USD (amount divisible by GCD)', () => {
        const stock = unlimitedStock(USD);
        // 6530500 % 10 = 0 → solutions exist
        const results = w.enumeratePartialConfigs(6530500, USD, stock, 10);
        expect(results.length).toBeGreaterThan(0);
    });

    it('partial returns [] when amount not divisible by GCD', () => {
        const stock = unlimitedStock(USD);
        // $3 is not divisible by GCD(100,50,20,10)=10
        expect(w.enumeratePartialConfigs(3, USD, stock)).toEqual([]);
    });

    // --- EUR GCD edge cases ---
    it('EUR: ideal returns [] when units not divisible by GCD=10', () => {
        const EUR = [100, 50, 20];
        const stock = {};
        EUR.forEach(d => stock[d] = 1e9);
        // €150,500 → units = 150500/100 = 1505, 1505%10=5 → impossible
        const results = w.enumerateIdealConfigs(150500, EUR, stock);
        expect(results).toEqual([]);
    });

    it('EUR: loose returns [] when units not divisible by GCD=10', () => {
        const EUR = [100, 50, 20];
        const stock = {};
        EUR.forEach(d => stock[d] = 1e9);
        const results = w.enumerateLooseConfigs(150500, EUR, stock);
        expect(results).toEqual([]);
    });

    it('EUR: partial returns [] when amount not divisible by GCD=10 (e.g. €7)', () => {
        const EUR = [100, 50, 20];
        const stock = {};
        EUR.forEach(d => stock[d] = 1e9);
        expect(w.enumeratePartialConfigs(7, EUR, stock)).toEqual([]);
    });

    it('EUR: partial finds solutions when amount divisible by GCD=10 (€150,500)', () => {
        const EUR = [100, 50, 20];
        const stock = {};
        EUR.forEach(d => stock[d] = 1e9);
        // 150500 % 10 = 0, so partial should find solutions
        const results = w.enumeratePartialConfigs(150500, EUR, stock, 10);
        expect(results.length).toBeGreaterThan(0);
        const denomsSorted = [...EUR].sort((a, b) => b - a);
        for (const billCounts of results) {
            const total = billCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(total).toBe(150500);
        }
    });

    // --- JPY GCD edge cases ---
    it('JPY: ideal returns [] when units not divisible by GCD=1000', () => {
        const JPY = [10000, 5000, 1000];
        const stock = {};
        JPY.forEach(d => stock[d] = 1e9);
        // ¥5,050,000 → units = 5050000/100 = 50500, 50500%1000=500 → impossible
        const results = w.enumerateIdealConfigs(5050000, JPY, stock);
        expect(results).toEqual([]);
    });

    it('JPY: loose returns [] when units not divisible by GCD=1000', () => {
        const JPY = [10000, 5000, 1000];
        const stock = {};
        JPY.forEach(d => stock[d] = 1e9);
        const results = w.enumerateLooseConfigs(5050000, JPY, stock);
        expect(results).toEqual([]);
    });

    it('JPY: partial returns [] when amount not divisible by GCD=1000 (e.g. ¥500)', () => {
        const JPY = [10000, 5000, 1000];
        const stock = {};
        JPY.forEach(d => stock[d] = 1e9);
        expect(w.enumeratePartialConfigs(500, JPY, stock)).toEqual([]);
    });

    it('JPY: partial finds solutions when amount divisible by GCD=1000 (¥5,050,000)', () => {
        const JPY = [10000, 5000, 1000];
        const stock = {};
        JPY.forEach(d => stock[d] = 1e9);
        const results = w.enumeratePartialConfigs(5050000, JPY, stock, 10);
        expect(results.length).toBeGreaterThan(0);
        const denomsSorted = [...JPY].sort((a, b) => b - a);
        for (const billCounts of results) {
            const total = billCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(total).toBe(5050000);
        }
    });

    it('JPY: ideal/loose return [] instantly for impossible amounts', () => {
        const JPY = [10000, 5000, 1000];
        const stock = {};
        JPY.forEach(d => stock[d] = 1e9);
        const start = Date.now();
        w.enumerateIdealConfigs(5050000, JPY, stock);
        w.enumerateLooseConfigs(5050000, JPY, stock);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(50);
    });

    // --- GBP GCD edge cases ---
    it('GBP: ideal returns [] when units not divisible by GCD=5', () => {
        const GBP = [50, 20, 10, 5];
        const stock = {};
        GBP.forEach(d => stock[d] = 1e9);
        // £30,300 → units = 30300/100 = 303, 303%5=3 → impossible
        const results = w.enumerateIdealConfigs(30300, GBP, stock);
        expect(results).toEqual([]);
    });

    it('GBP: loose returns [] when units not divisible by GCD=5', () => {
        const GBP = [50, 20, 10, 5];
        const stock = {};
        GBP.forEach(d => stock[d] = 1e9);
        const results = w.enumerateLooseConfigs(30300, GBP, stock);
        expect(results).toEqual([]);
    });

    it('GBP: partial returns [] when amount not divisible by GCD=5 (e.g. £3)', () => {
        const GBP = [50, 20, 10, 5];
        const stock = {};
        GBP.forEach(d => stock[d] = 1e9);
        expect(w.enumeratePartialConfigs(3, GBP, stock)).toEqual([]);
    });

    it('GBP: partial finds solutions when amount divisible by GCD=5 (£30,300 is not, use £30,500)', () => {
        const GBP = [50, 20, 10, 5];
        const stock = {};
        GBP.forEach(d => stock[d] = 1e9);
        // 30500 % 5 = 0, so partial should find solutions
        const results = w.enumeratePartialConfigs(30500, GBP, stock, 10);
        expect(results.length).toBeGreaterThan(0);
        const denomsSorted = [...GBP].sort((a, b) => b - a);
        for (const billCounts of results) {
            const total = billCounts.reduce((s, c, i) => s + denomsSorted[i] * c, 0);
            expect(total).toBe(30500);
        }
    });

    it('GBP: ideal/loose return [] instantly for impossible amounts', () => {
        const GBP = [50, 20, 10, 5];
        const stock = {};
        GBP.forEach(d => stock[d] = 1e9);
        const start = Date.now();
        w.enumerateIdealConfigs(30300, GBP, stock);
        w.enumerateLooseConfigs(30300, GBP, stock);
        const elapsed = Date.now() - start;
        expect(elapsed).toBeLessThan(50);
    });

    it('onmessage for $6,530,500 USD completes fast', () => {
        postMessageMock.mockClear();

        const start = Date.now();
        w.triggerMessage({
            type: 'start',
            data: {
                amount: 6530500,
                currencyCode: 'USD',
                maxVariants: 10,
                bundlesStock: undefined,
            },
        });
        const elapsed = Date.now() - start;

        const solutions = postMessageMock.mock.calls.map(c => c[0]).filter(m => m.type === 'solution');
        const complete = postMessageMock.mock.calls.map(c => c[0]).find(m => m.type === 'complete');
        expect(solutions.length).toBeGreaterThan(0);
        expect(complete.data.hasPartial).toBe(true);
        // Should be fast now (not 10+ seconds)
        expect(elapsed).toBeLessThan(2000);
    });
});

// ============================================================
// Constants
// ============================================================
describe('constants', () => {
    it('BUNDLE_SIZE = 100', () => {
        expect(w.BUNDLE_SIZE).toBe(100);
    });

    it('BLOCK_SIZE = 30', () => {
        expect(w.BLOCK_SIZE).toBe(30);
    });

    it('INFINITY = 1e9', () => {
        expect(w.INFINITY).toBe(1000000000);
    });

    it('FULL_BLOCK_VALUE = 3000', () => {
        expect(w.FULL_BLOCK_VALUE).toBe(3000);
    });

    it('CURRENCIES has USD, EUR, JPY, GBP', () => {
        expect(w.CURRENCIES).toHaveProperty('USD');
        expect(w.CURRENCIES).toHaveProperty('EUR');
        expect(w.CURRENCIES).toHaveProperty('JPY');
        expect(w.CURRENCIES).toHaveProperty('GBP');
        expect(w.CURRENCIES.USD).toEqual([100, 50, 20, 10]);
        expect(w.CURRENCIES.EUR).toEqual([100, 50, 20]);
        expect(w.CURRENCIES.JPY).toEqual([10000, 5000, 1000]);
        expect(w.CURRENCIES.GBP).toEqual([50, 20, 10, 5]);
    });
});
