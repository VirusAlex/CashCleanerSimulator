import { describe, it, expect } from 'vitest';

/**
 * Pure version of getAllBundlesFlat grouped layout logic,
 * extracted from app.js for testing. Takes explicit parameters
 * instead of relying on globals.
 */
function findBestDenomOrder(startPos, remaining, slotsLeft, stackSize, blockSize) {
    if (remaining.length <= 1) return remaining;
    const layerSize = stackSize * 3;
    blockSize = blockSize || layerSize * 2;
    function getPerms(arr) {
        if (arr.length <= 1) return [arr];
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
            for (const p of getPerms(rest)) result.push([arr[i], ...p]);
        }
        return result;
    }
    function scorePerm(perm) {
        const seq = [];
        for (const item of perm) {
            const n = Math.min(item.count, slotsLeft - seq.length);
            for (let i = 0; i < n; i++) seq.push(item.denom);
            if (seq.length >= slotsLeft) break;
        }
        let switches = 0;
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] !== seq[i - 1]) switches++;
        }
        let mixedLayers = 0, mixedStacks = 0, maxIntraStack = 0, mixedSpread = 0;
        const totalLen = startPos + seq.length;
        for (let absPos = startPos; absPos < totalLen; ) {
            const blockIdx = Math.floor(absPos / blockSize);
            const blockStart = blockIdx * blockSize;
            const blockEnd = blockStart + blockSize;
            for (let layer = 0; layer < 2; layer++) {
                const lStart = blockStart + layer * layerSize;
                const lEnd = lStart + layerSize;
                if (lStart >= totalLen || lEnd <= startPos) continue;
                const ds = new Set();
                if (lStart < startPos) ds.add(-1);
                for (let p = Math.max(lStart, startPos); p < Math.min(lEnd, totalLen); p++) {
                    ds.add(seq[p - startPos]);
                }
                if (ds.size > 1) mixedLayers++;
            }
            let firstMixed = -1, lastMixed = -1;
            for (let s = 0; s < 6; s++) {
                const sStart = blockStart + s * stackSize;
                const sEnd = sStart + stackSize;
                if (sStart >= totalLen || sEnd <= startPos) continue;
                const ds = new Set();
                let intra = 0, prevD = (sStart < startPos) ? -1 : null;
                if (sStart < startPos) ds.add(-1);
                for (let p = Math.max(sStart, startPos); p < Math.min(sEnd, totalLen); p++) {
                    const d = seq[p - startPos];
                    ds.add(d);
                    if (prevD !== null && d !== prevD) intra++;
                    prevD = d;
                }
                if (ds.size > 1) {
                    mixedStacks++;
                    if (firstMixed === -1) firstMixed = s;
                    lastMixed = s;
                }
                if (intra > maxIntraStack) maxIntraStack = intra;
            }
            if (firstMixed !== -1) mixedSpread += lastMixed - firstMixed;
            absPos = blockEnd;
        }
        return switches * 1000000 + mixedLayers * 100000
             + mixedStacks * 1000 + maxIntraStack * 100 + mixedSpread;
    }
    const perms = getPerms(remaining);
    let best = remaining, bestScore = Infinity;
    for (const perm of perms) {
        const score = scorePerm(perm);
        if (score < bestScore) { bestScore = score; best = perm; }
    }
    return best;
}

function layoutBlocks(variant, { bundleSize = 100, blockSize = 30 } = {}) {
    const layerSize = Math.floor(blockSize / 2); // 15
    const stackSize = 5;

    const denomCounts = {};
    const partials = [];

    (variant.breakdown || []).forEach(item => {
        if (variant.type === 'partial' && item.type === 'partial') {
            partials.push({
                denomination: item.denomination,
                value: item.value,
                type: 'partial',
                bills: item.bills
            });
        } else {
            const count = item.bundles || 0;
            if (count > 0) {
                if (!denomCounts[item.denomination]) denomCounts[item.denomination] = [];
                for (let i = 0; i < count; i++) {
                    denomCounts[item.denomination].push({
                        denomination: item.denomination,
                        value: item.denomination * bundleSize,
                        type: 'full'
                    });
                }
            }
        }
    });

    const denoms = Object.keys(denomCounts).map(Number).sort((a, b) => b - a);

    const remainByDenom = {};
    denoms.forEach(d => {
        if (denomCounts[d] && denomCounts[d].length > 0) {
            remainByDenom[d] = denomCounts[d];
        }
    });

    const fullSeq = [];
    const totalBundles = denoms.reduce((s, d) => s + (remainByDenom[d] ? remainByDenom[d].length : 0), 0);

    let startDenom = null;
    const available = denoms.filter(d => remainByDenom[d] && remainByDenom[d].length > 0);
    if (available.length > 0) {
        available.sort((a, b) => remainByDenom[b].length - remainByDenom[a].length || b - a);
        startDenom = available[0];
    }
    if (startDenom && remainByDenom[startDenom] && remainByDenom[startDenom].length > 0) {
        while (remainByDenom[startDenom] && remainByDenom[startDenom].length > 0) {
            fullSeq.push(remainByDenom[startDenom].shift());
        }
    }

    const remaining = denoms
        .filter(d => remainByDenom[d] && remainByDenom[d].length > 0)
        .map(d => ({ denom: d, count: remainByDenom[d].length }));
    if (remaining.length > 0) {
        const bestOrder = findBestDenomOrder(fullSeq.length, remaining, totalBundles - fullSeq.length, stackSize, blockSize);
        for (const item of bestOrder) {
            while (remainByDenom[item.denom] && remainByDenom[item.denom].length > 0) {
                fullSeq.push(remainByDenom[item.denom].shift());
            }
        }
    }
    while (partials.length > 0) {
        fullSeq.push(partials.shift());
    }

    const mixedBlocks = [];
    for (let i = 0; i < fullSeq.length; i += blockSize) {
        mixedBlocks.push(fullSeq.slice(i, i + blockSize));
    }

    const result = [];
    mixedBlocks.forEach(b => result.push(...b));
    return result;
}

// Helper: count denomination switches in a bundle sequence
function countSwitches(bundles) {
    let switches = 0;
    for (let i = 1; i < bundles.length; i++) {
        if (bundles[i].denomination !== bundles[i - 1].denomination) switches++;
    }
    return switches;
}

// Helper: get sequence of denominations per block (blockSize chunks)
function getBlockDenomSequence(bundles, blockSize = 30) {
    const blocks = [];
    for (let i = 0; i < bundles.length; i += blockSize) {
        blocks.push(bundles.slice(i, i + blockSize).map(b => b.denomination));
    }
    return blocks;
}

// ============================================================
// €250,000 EUR: 8×€100 + 22×€50 + 30×€20
// Block 1: 30×€20 (homogeneous)
// Block 2: 22×€50 + 8×€100 (mixed, 1 switch expected)
// ============================================================
describe('EUR €250,000 — mixed block with €50 and €100', () => {
    const variant = {
        type: 'ideal',
        total_value: 250000,
        breakdown: [
            { denomination: 100, bundles: 8 },
            { denomination: 50, bundles: 22 },
            { denomination: 20, bundles: 30 },
        ]
    };

    it('should produce 60 total bundles', () => {
        const result = layoutBlocks(variant);
        expect(result.length).toBe(60);
    });

    it('should have block 1 as homogeneous €20', () => {
        const result = layoutBlocks(variant);
        const block1 = result.slice(0, 30);
        expect(block1.every(b => b.denomination === 20)).toBe(true);
    });

    it('should have only 1 denomination switch in the mixed block', () => {
        const result = layoutBlocks(variant);
        const block2 = result.slice(30, 60);
        const switches = countSwitches(block2);
        expect(switches).toBe(1);
    });

    it('mixed block should have exactly 1 denomination switch', () => {
        const result = layoutBlocks(variant);
        const block2 = result.slice(30, 60);
        expect(countSwitches(block2)).toBe(1);
    });

    it('mixed block should have exactly 2 denomination groups', () => {
        const result = layoutBlocks(variant);
        const block2 = result.slice(30, 60);
        const denoms = block2.map(b => b.denomination);
        const groups = [];
        let current = denoms[0], count = 1;
        for (let i = 1; i < denoms.length; i++) {
            if (denoms[i] === current) { count++; }
            else { groups.push({ denom: current, count }); current = denoms[i]; count = 1; }
        }
        groups.push({ denom: current, count });
        expect(groups.length).toBe(2);
        // One group of 22, one of 8 (order may vary)
        const counts = groups.map(g => g.count).sort((a, b) => a - b);
        expect(counts).toEqual([8, 22]);
    });
});

// ============================================================
// Simple case: all same denomination → 0 switches
// ============================================================
describe('Homogeneous order — all same denomination', () => {
    const variant = {
        type: 'ideal',
        total_value: 300000,
        breakdown: [
            { denomination: 100, bundles: 30 },
        ]
    };

    it('should have 0 switches', () => {
        const result = layoutBlocks(variant);
        expect(countSwitches(result)).toBe(0);
    });
});

// ============================================================
// Two full homogeneous blocks
// ============================================================
describe('Two homogeneous blocks — 30×€100 + 30×€50', () => {
    const variant = {
        type: 'ideal',
        total_value: 450000,
        breakdown: [
            { denomination: 100, bundles: 30 },
            { denomination: 50, bundles: 30 },
        ]
    };

    it('should have exactly 1 switch (between blocks)', () => {
        const result = layoutBlocks(variant);
        expect(result.length).toBe(60);
        expect(countSwitches(result)).toBe(1);
    });

    it('block 1 should be all €100, block 2 all €50', () => {
        const result = layoutBlocks(variant);
        expect(result.slice(0, 30).every(b => b.denomination === 100)).toBe(true);
        expect(result.slice(30, 60).every(b => b.denomination === 50)).toBe(true);
    });
});

// ============================================================
// Three denominations in one block — minimize switches
// ============================================================
describe('Three denoms in one block — 10×€100 + 10×€50 + 10×€20', () => {
    const variant = {
        type: 'loose',
        total_value: 170000,
        breakdown: [
            { denomination: 100, bundles: 10 },
            { denomination: 50, bundles: 10 },
            { denomination: 20, bundles: 10 },
        ]
    };

    it('should have exactly 2 switches (one per denomination transition)', () => {
        const result = layoutBlocks(variant);
        expect(result.length).toBe(30);
        expect(countSwitches(result)).toBe(2);
    });

    it('should group same denominations together', () => {
        const result = layoutBlocks(variant);
        // All of one denom, then all of next, then all of next
        const denoms = result.map(b => b.denomination);
        const groups = [];
        let current = denoms[0];
        let count = 1;
        for (let i = 1; i < denoms.length; i++) {
            if (denoms[i] === current) {
                count++;
            } else {
                groups.push({ denom: current, count });
                current = denoms[i];
                count = 1;
            }
        }
        groups.push({ denom: current, count });
        expect(groups.length).toBe(3);
        expect(groups[0].count).toBe(10);
        expect(groups[1].count).toBe(10);
        expect(groups[2].count).toBe(10);
    });
});

// ============================================================
// €300,000 EUR: 6×€100 + 44×€50 + 10×€20
// Block 1: 30×€50 (homogeneous)
// Block 2: mixed — should continue €50 from block 1, then €100, then €20
// Total: 2 switches across blocks (not 3)
// ============================================================
describe('EUR €300,000 — mixed block should continue denomination from previous block', () => {
    const variant = {
        type: 'ideal',
        total_value: 300000,
        breakdown: [
            { denomination: 100, bundles: 6 },
            { denomination: 50, bundles: 44 },
            { denomination: 20, bundles: 10 },
        ]
    };

    it('should produce 60 total bundles', () => {
        const result = layoutBlocks(variant);
        expect(result.length).toBe(60);
    });

    it('block 1 should be all €50 (homogeneous)', () => {
        const result = layoutBlocks(variant);
        const block1 = result.slice(0, 30);
        expect(block1.every(b => b.denomination === 50)).toBe(true);
    });

    it('mixed block should start with €50 (continue from previous block)', () => {
        const result = layoutBlocks(variant);
        const block2 = result.slice(30, 60);
        expect(block2[0].denomination).toBe(50);
    });

    it('should have only 2 switches across all bundles (€50→€100→€20)', () => {
        const result = layoutBlocks(variant);
        // Block 1 is all €50, block 2 should be: €50(14)→€100(6)→€20(10)
        expect(countSwitches(result)).toBe(2);
    });

    it('mixed block should be: 14×€50, 6×€100, 10×€20', () => {
        const result = layoutBlocks(variant);
        const block2 = result.slice(30, 60);
        const denoms = block2.map(b => b.denomination);

        // Count groups
        const groups = [];
        let current = denoms[0], count = 1;
        for (let i = 1; i < denoms.length; i++) {
            if (denoms[i] === current) { count++; }
            else { groups.push({ denom: current, count }); current = denoms[i]; count = 1; }
        }
        groups.push({ denom: current, count });

        // 2 switches total — order of €100 vs €20 may vary
        expect(groups.length).toBe(3);
        expect(groups[0]).toEqual({ denom: 50, count: 14 });
    });
});

// ============================================================
// €300,000 EUR: 12×€100 + 28×€50 + 20×€20
// No homogeneous blocks possible.
// Block 1: should continue €50 as long as possible, then start €100
// Block 2: continue €100, then €20
// Total: 2 switches (€50→€100→€20)
// ============================================================
describe('EUR €300,000 — three denoms, no homo blocks, minimize switches across blocks', () => {
    const variant = {
        type: 'ideal',
        total_value: 300000,
        breakdown: [
            { denomination: 100, bundles: 12 },
            { denomination: 50, bundles: 28 },
            { denomination: 20, bundles: 20 },
        ]
    };

    it('should produce 60 total bundles', () => {
        const result = layoutBlocks(variant);
        expect(result.length).toBe(60);
    });

    it('should have only 2 switches total (€50→€100→€20)', () => {
        const result = layoutBlocks(variant);
        expect(countSwitches(result)).toBe(2);
    });

    it('block 1 should start with €50 (most bundles)', () => {
        const result = layoutBlocks(variant);
        expect(result[0].denomination).toBe(50);
    });

    it('block 1 should be 28×€50 then 2×€100', () => {
        const result = layoutBlocks(variant);
        const block1 = result.slice(0, 30);
        const denoms = block1.map(b => b.denomination);
        const groups = [];
        let current = denoms[0], count = 1;
        for (let i = 1; i < denoms.length; i++) {
            if (denoms[i] === current) { count++; }
            else { groups.push({ denom: current, count }); current = denoms[i]; count = 1; }
        }
        groups.push({ denom: current, count });

        expect(groups[0]).toEqual({ denom: 50, count: 28 });
        expect(groups.length).toBe(2);
    });

    it('block 2 should be 10×€100 then 20×€20', () => {
        const result = layoutBlocks(variant);
        const block2 = result.slice(30, 60);
        const denoms = block2.map(b => b.denomination);
        const groups = [];
        let current = denoms[0], count = 1;
        for (let i = 1; i < denoms.length; i++) {
            if (denoms[i] === current) { count++; }
            else { groups.push({ denom: current, count }); current = denoms[i]; count = 1; }
        }
        groups.push({ denom: current, count });

        expect(groups.length).toBe(2);
        expect(groups[0].count + groups[1].count).toBe(30);
    });
});

// ============================================================
// Partial packs should come last
// ============================================================
// €300,000 EUR: 3×€100 + 52×€50 + 5×€20
// Block 1: 30×€50 (homogeneous)
// Block 2: continue €50(22), then €100(3) first (fewer), then €20(5) clean stack
// ============================================================
describe('EUR €300,000 — short transition first, clean stack last', () => {
    const variant = {
        type: 'ideal',
        total_value: 300000,
        breakdown: [
            { denomination: 100, bundles: 3 },
            { denomination: 50, bundles: 52 },
            { denomination: 20, bundles: 5 },
        ]
    };

    it('should have 2 switches total', () => {
        const result = layoutBlocks(variant);
        expect(countSwitches(result)).toBe(2);
    });

    it('mixed block should be: €50 then €100 then €20', () => {
        const result = layoutBlocks(variant);
        const block2 = result.slice(30, 60);
        const denoms = block2.map(b => b.denomination);
        const groups = [];
        let current = denoms[0], count = 1;
        for (let i = 1; i < denoms.length; i++) {
            if (denoms[i] === current) { count++; }
            else { groups.push({ denom: current, count }); current = denoms[i]; count = 1; }
        }
        groups.push({ denom: current, count });

        expect(groups).toEqual([
            { denom: 50, count: 22 },
            { denom: 100, count: 3 },
            { denom: 20, count: 5 },
        ]);
    });

    it('last stack of block 2 should be clean €20', () => {
        const result = layoutBlocks(variant);
        const block2 = result.slice(30, 60);
        const lastStack = block2.slice(25, 30);
        expect(lastStack.every(b => b.denomination === 20)).toBe(true);
    });
});

// ============================================================
// $125,000 USD: 3×$100 + 16×$50 + 4×$20 + 7×$10
// Stack 4: [$50, $20×4] (1 transition) — $20 fits exactly in 4 remaining slots
// Stack 5: [$100×3, $10×2] (1 transition) — $100 fits in 5 slots
// Stack 6: [$10×5] (clean)
// ============================================================
describe('USD $125,000 — minimize transitions within stacks', () => {
    const variant = {
        type: 'loose',
        total_value: 125000,
        breakdown: [
            { denomination: 100, bundles: 3 },
            { denomination: 50, bundles: 16 },
            { denomination: 20, bundles: 4 },
            { denomination: 10, bundles: 7 },
        ]
    };

    it('should produce 30 bundles', () => {
        const result = layoutBlocks(variant);
        expect(result.length).toBe(30);
    });

    it('should have at most 2 mixed stacks in the top layer', () => {
        const result = layoutBlocks(variant);
        let mixedCount = 0;
        for (let s = 3; s < 6; s++) {
            const stack = result.slice(s * 5, s * 5 + 5);
            if (countSwitches(stack) > 0) mixedCount++;
        }
        expect(mixedCount).toBeLessThanOrEqual(2);
    });

    it('each mixed stack should have at most 1 denomination transition', () => {
        const result = layoutBlocks(variant);
        for (let s = 0; s < 6; s++) {
            const stack = result.slice(s * 5, s * 5 + 5);
            expect(countSwitches(stack)).toBeLessThanOrEqual(1);
        }
    });
});

// ============================================================
describe('Partial packs come at the end', () => {
    const variant = {
        type: 'partial',
        total_value: 15000,
        breakdown: [
            { denomination: 100, bundles: 1 },
            { denomination: 50, bundles: 0, type: 'partial', value: 2500, bills: 50 },
        ]
    };

    it('should place full bundles before partials', () => {
        const result = layoutBlocks(variant);
        const fullBundles = result.filter(b => b.type === 'full');
        const partialBundles = result.filter(b => b.type === 'partial');
        expect(fullBundles.length).toBe(1);
        expect(partialBundles.length).toBe(1);
        // Full comes first
        expect(result[0].type).toBe('full');
        expect(result[result.length - 1].type).toBe('partial');
    });
});
