// Compare partial search strategies: original vs constrained vs twophase
// Usage: node tests/compare-strategies.cjs

global.self = { postMessage: function() {}, onmessage: null };
const w = require('../js/worker.js');

const BUNDLE_SIZE = w.DEFAULT_BUNDLE_SIZE;

function unlimitedStock(denoms) {
    const stock = {};
    denoms.forEach(d => stock[d] = 1e9);
    return stock;
}

const scenarios = [
    { name: 'JPY ¥12,345,000', amount: 12345000, denoms: [10000, 5000, 1000] },
    { name: 'USD $4,680,050',   amount: 4680050,  denoms: [100, 50, 20, 10] },
    { name: 'EUR €555,550',     amount: 555550,   denoms: [100, 50, 20] },
    { name: 'GBP £123,455',     amount: 123455,   denoms: [50, 20, 10, 5] },
    { name: 'USD $1,234,570',   amount: 1234570,  denoms: [100, 50, 20, 10] },
    { name: 'JPY ¥5,555,000',   amount: 5555000,  denoms: [10000, 5000, 1000] },
];

const strategies = ['original', 'constrained', 'twophase'];

for (const s of scenarios) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${s.name} (amount=${s.amount}, denoms=[${s.denoms}])`);
    console.log('='.repeat(70));

    const stock = unlimitedStock(s.denoms);
    const denomsSorted = [...s.denoms].sort((a, b) => b - a);

    for (const strategy of strategies) {
        w.stopRequested = false;
        const start = Date.now();
        const results = w.enumeratePartialConfigs(s.amount, s.denoms, stock, 15, BUNDLE_SIZE, strategy);
        const elapsed = Date.now() - start;

        // Sort by score
        results.sort((a, b) => w.compareScores(
            w.scorePartial(a, denomsSorted, BUNDLE_SIZE),
            w.scorePartial(b, denomsSorted, BUNDLE_SIZE)
        ));

        console.log(`\n  --- ${strategy.toUpperCase()} --- (${results.length} variants, ${elapsed}ms)`);

        for (let v = 0; v < results.length; v++) {
            const r = results[v];
            const score = w.scorePartial(r, denomsSorted, BUNDLE_SIZE);
            const parts = [];
            r.forEach((count, i) => {
                if (count > 0) {
                    const full = Math.floor(count / BUNDLE_SIZE);
                    const partial = count % BUNDLE_SIZE;
                    let s = `${denomsSorted[i]}×${count}`;
                    if (full > 0 && partial > 0) s += `(${full}b+${partial})`;
                    else if (full > 0) s += `(${full}b)`;
                    else s += `(${partial}p)`;
                    parts.push(s);
                }
            });
            console.log(`    ${v+1}. [pd=${score[0]},bills=${score[1]}] ${parts.join(' + ')}`);
        }
    }
}
