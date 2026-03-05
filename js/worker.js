// Worker: Cash Cleaner Calculator computation engine

            // Constants
            const DEFAULT_BUNDLE_SIZE = 100;
            const DEFAULT_BLOCK_SIZE = 30;
            const INFINITY = 1000000000;

            const CURRENCIES = {
                'USD': [100, 50, 20, 10],
                'EUR': [100, 50, 20],
                'JPY': [10000, 5000, 1000],
                'GBP': [50, 20, 10, 5]
            };

            const COIN_CURRENCIES = {
                'USD': [1, 0.50, 0.25, 0.10],
                'EUR': [2, 1, 0.50, 0.20],
                'JPY': [500, 100, 50, 10],
                'GBP': [2, 1, 0.50, 0.20]
            };

            const COIN_SCALE = {
                'USD': 100,
                'EUR': 100,
                'JPY': 1,
                'GBP': 100
            };

            // Stop flag
            let stopRequested = false;

            // GCD of two numbers
            function gcd(a, b) {
                while (b) { const t = b; b = a % b; a = t; }
                return a;
            }

            // GCD of an array of numbers
            function gcdArray(arr) {
                return arr.reduce((g, v) => gcd(g, v));
            }

        // Depth-first search for ideal blocks
            function searchBlocks(denoms, blocks, i, bundlesLeft, valueLeft, cur, solutions, stock, context) {
                // Check stop request, timeout and solution limit
                if (stopRequested ||
                    Date.now() - context.startTime > context.maxTime ||
                    solutions.length >= context.maxSolutions) {
                    return;
                }

            if (i === denoms.length - 1) {
                const d = denoms[i];
                const neededBundles = d ? Math.floor(valueLeft / d) : 0;
                if (valueLeft === d * neededBundles &&
                    neededBundles === bundlesLeft &&
                    neededBundles <= stock[d]) {
                    cur[i] = neededBundles;
                        const solution = [blocks, [...cur]];
                        solutions.push(solution);
                        context.solutionCount++;
                        // Send solution to main thread
                        self.postMessage({
                            type: 'solution',
                            data: {
                                solution: solution,
                                variantType: 'ideal'
                            }
                        });
                }
                return;
            }

            const d = denoms[i];
            const maxForD = Math.min(bundlesLeft, stock[d], Math.floor(valueLeft / d));

                // Smart sampling
                const SMART_SAMPLE_THRESHOLD = 1000;
                let step = 1;
                if (maxForD > SMART_SAMPLE_THRESHOLD) {
                    step = Math.max(1, Math.floor(maxForD / 100));
                }

                for (let b = 0; b <= maxForD; b += step) {
                    if (stopRequested ||
                        Date.now() - context.startTime > context.maxTime ||
                        solutions.length >= context.maxSolutions) {
                        break;
                    }
                cur[i] = b;
                    searchBlocks(denoms, blocks, i + 1, bundlesLeft - b, valueLeft - d * b, cur, solutions, stock, context);
                }

                // Always try the maximum value (boundary condition)
                if (step > 1 && maxForD % step !== 0) {
                    cur[i] = maxForD;
                    searchBlocks(denoms, blocks, i + 1, bundlesLeft - maxForD, valueLeft - d * maxForD, cur, solutions, stock, context);
                }

            cur[i] = 0;
        }

        // Enumerate ideal block configurations
        function enumerateIdealConfigs(amount, denoms, stock, maxSolutions, bundleSize, blockSize) {
                if (amount % bundleSize !== 0) {
                    return [];
                }

            const units = Math.floor(amount / bundleSize);
            const denomsSorted = [...denoms].sort((a, b) => b - a);

                // Quick GCD check: units must be divisible by GCD of denominations
                if (units > 0 && units % gcdArray(denomsSorted) !== 0) {
                    return [];
                }

                const largestBundleValue = Math.max(...denomsSorted) * bundleSize;
            const smallestBundleValue = Math.min(...denomsSorted) * bundleSize;

                const theoreticalMinBlocks = Math.ceil(amount / (largestBundleValue * blockSize));
            const theoreticalMaxBlocks = Math.floor(amount / (smallestBundleValue * blockSize));

            const totalStockBundles = denomsSorted.reduce((sum, d) => sum + stock[d], 0);
            const maxBlocks = Math.min(theoreticalMaxBlocks, Math.floor(totalStockBundles / blockSize));
                const minBlocks = theoreticalMinBlocks;

            const solutions = [];
            const cur = new Array(denomsSorted.length).fill(0);

                const context = {
                    startTime: Date.now(),
                    maxTime: 5000,
                    maxSolutions: maxSolutions || 1000,
                    solutionCount: 0
                };

                for (let blocks = minBlocks; blocks <= maxBlocks; blocks++) {
                    if (stopRequested ||
                        Date.now() - context.startTime > context.maxTime ||
                        solutions.length >= context.maxSolutions) {
                        break;
                    }

                const bundlesTotal = blocks * blockSize;
                    if (bundlesTotal > totalStockBundles) {
                        break;
                    }

                    searchBlocks(denomsSorted, blocks, 0, bundlesTotal, units, cur, solutions, stock, context);
            }

            return solutions;
        }

        // Depth-first search for loose bundles
            function searchBundles(denoms, i, valueLeft, cur, solutions, stock, context) {
                if (stopRequested ||
                    Date.now() - context.startTime > context.maxTime ||
                    solutions.length >= context.maxSolutions) {
                    return;
                }

            if (i === denoms.length - 1) {
                const d = denoms[i];
                const needed = d ? Math.floor(valueLeft / d) : 0;
                if (valueLeft === d * needed && needed <= stock[d]) {
                    cur[i] = needed;
                        const solution = [...cur];
                        solutions.push(solution);
                        context.solutionCount++;
                        // Send solution to main thread
                        self.postMessage({
                            type: 'solution',
                            data: {
                                solution: solution,
                                variantType: 'loose'
                            }
                        });
                }
                return;
            }

            const d = denoms[i];
            const maxForD = Math.min(stock[d], Math.floor(valueLeft / d));

                // Smart sampling
                const SMART_SAMPLE_THRESHOLD = 1000;
                let step = 1;
                if (maxForD > SMART_SAMPLE_THRESHOLD) {
                    step = Math.max(1, Math.floor(maxForD / 100));
                }

                // Start from maximum and go down to prioritize larger denominations
                for (let b = maxForD; b >= 0; b -= step) {
                    if (stopRequested ||
                        Date.now() - context.startTime > context.maxTime ||
                        solutions.length >= context.maxSolutions) {
                        break;
                    }
                cur[i] = b;
                    searchBundles(denoms, i + 1, valueLeft - d * b, cur, solutions, stock, context);
                }

                // Always try the minimum value (0)
                if (step > 1 && maxForD % step !== 0) {
                    cur[i] = 0;
                    searchBundles(denoms, i + 1, valueLeft, cur, solutions, stock, context);
                }

            cur[i] = 0;
        }

        // Enumerate loose bundle configurations
        function enumerateLooseConfigs(amount, denoms, stock, maxSolutions, bundleSize) {
                if (amount % bundleSize !== 0) {
                    return [];
                }

            const units = Math.floor(amount / bundleSize);
            const denomsSorted = [...denoms].sort((a, b) => b - a);

                // Quick GCD check: units must be divisible by GCD of denominations
                if (units > 0 && units % gcdArray(denomsSorted) !== 0) {
                    return [];
                }

            const cur = new Array(denomsSorted.length).fill(0);
            const solutions = [];

                const context = {
                    startTime: Date.now(),
                    maxTime: 5000,
                    maxSolutions: maxSolutions || 1000,
                    solutionCount: 0
                };

                searchBundles(denomsSorted, 0, units, cur, solutions, stock, context);

            return solutions;
        }

            // Search with timeout for partial bundles
            function searchWithTimeout(denoms, i, billsLeft, cur, solutions, stock, startTime, maxTime, maxSolutions, bundleSize) {
                if (stopRequested ||
                    Date.now() - startTime > maxTime ||
                    solutions.length >= maxSolutions) {
                    return;
                }

                if (i === denoms.length - 1) {
                    const d = denoms[i];
                    const needed = d ? Math.floor(billsLeft / d) : 0;
                    const stockBills = stock[d] === INFINITY ? INFINITY : stock[d] * bundleSize;
                    if (billsLeft === d * needed && needed <= stockBills) {
                        cur[i] = needed;
                        const solution = [...cur];
                        solutions.push(solution);
                        // Send solution to main thread
                        self.postMessage({
                            type: 'solution',
                            data: {
                                solution: solution,
                                variantType: 'partial'
                            }
                        });
                    }
                    return;
                }

                const d = denoms[i];
                const theoreticalMax = Math.floor(billsLeft / d);
                const stockMax = stock[d] === INFINITY ? theoreticalMax : stock[d] * bundleSize;
                const maxForD = Math.min(stockMax, theoreticalMax);

                // Smart sampling
                const SMART_SAMPLE_THRESHOLD = 1000;
                let step = 1;
                if (maxForD > SMART_SAMPLE_THRESHOLD) {
                    step = Math.max(1, Math.floor(maxForD / 100));
                }

                // Start from maximum and go down to prioritize larger denominations
                for (let bills = maxForD; bills >= 0; bills -= step) {
                    if (stopRequested ||
                        Date.now() - startTime > maxTime ||
                        solutions.length >= maxSolutions) {
                        break;
                    }
                    cur[i] = bills;
                    searchWithTimeout(denoms, i + 1, billsLeft - d * bills, cur, solutions, stock, startTime, maxTime, maxSolutions, bundleSize);
                }

                // Always try the minimum value (0)
                if (step > 1 && maxForD % step !== 0) {
                    cur[i] = 0;
                    searchWithTimeout(denoms, i + 1, billsLeft, cur, solutions, stock, startTime, maxTime, maxSolutions, bundleSize);
                }

                cur[i] = 0;
            }

            // Enumerate partial bundle configurations
            function enumeratePartialConfigs(amount, denoms, stock, maxSolutions, bundleSize) {
                // Quick GCD check: amount must be divisible by GCD of denominations
                if (amount > 0 && amount % gcdArray(denoms) !== 0) {
                    return [];
                }

                const startTime = Date.now();

                const denomsSorted = [...denoms].sort((a, b) => b - a);
                const cur = new Array(denomsSorted.length).fill(0);
                const solutions = [];

                const maxTime = 5000;
                maxSolutions = maxSolutions || 1000;

                searchWithTimeout(denomsSorted, 0, amount, cur, solutions, stock, startTime, maxTime, maxSolutions, bundleSize);

            return solutions;
        }

        // Scoring functions
        function scoreIdeal(blocks, bundleCounts, denoms) {
            const kinds = bundleCounts.filter(c => c > 0).length;
            const totalBundles = bundleCounts.reduce((sum, c) => sum + c, 0);
            const avg = totalBundles > 0 ?
                bundleCounts.reduce((sum, c, i) => sum + denoms[i] * c, 0) / totalBundles : 0;
            return [blocks, kinds, -avg];
        }

        function scoreLoose(bundleCounts, denoms) {
            const totalBundles = bundleCounts.reduce((sum, c) => sum + c, 0);
            const kinds = bundleCounts.filter(c => c > 0).length;
            const avg = totalBundles > 0 ?
                bundleCounts.reduce((sum, c, i) => sum + denoms[i] * c, 0) / totalBundles : 0;
            return [totalBundles, kinds, -avg];
        }

        function scorePartial(billCounts, denoms) {
            const totalBills = billCounts.reduce((sum, c) => sum + c, 0);
            const kinds = billCounts.filter(c => c > 0).length;
            const avg = totalBills > 0 ?
                billCounts.reduce((sum, c, i) => sum + denoms[i] * c, 0) / totalBills : 0;
            return [totalBills, kinds, -avg];
        }

        // Compare scores
        function compareScores(a, b) {
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) return a[i] - b[i];
            }
            return 0;
        }

        // Normalize stock
        function normalizeStock(denoms, bundlesStock) {
            const stock = {};
            denoms.forEach(d => stock[d] = bundlesStock && bundlesStock[d] !== undefined ? bundlesStock[d] : INFINITY);
            return stock;
        }

            // Message handler
            self.onmessage = function(e) {
                const { type, data } = e.data;

                if (type === 'start') {
                    stopRequested = false;

                    const { amount, currencyCode, maxVariants, bundlesStock, bundleSize: msgBundleSize, blockSize: msgBlockSize, assetType } = data;

                    // Use parameterized sizes (for coins: ROLL_SIZE=20, COIN_BLOCK_SIZE=10)
                    const BUNDLE_SIZE = msgBundleSize || DEFAULT_BUNDLE_SIZE;
                    const BLOCK_SIZE = msgBlockSize || DEFAULT_BLOCK_SIZE;

                    try {
                        // Get denominations based on asset type
                        let denoms;
                        let scaleFactor = 1;
                        let scaledAmount = amount;

                        if (assetType === 'coins') {
                            const rawDenoms = COIN_CURRENCIES[currencyCode.toUpperCase()];
                            if (!rawDenoms) {
                                throw new Error(`Currency ${currencyCode} not supported for coins`);
                            }
                            scaleFactor = COIN_SCALE[currencyCode.toUpperCase()] || 1;
                            // Scale denominations to integers
                            denoms = rawDenoms.map(d => Math.round(d * scaleFactor));
                            // Scale amount to same units
                            scaledAmount = Math.round(amount * scaleFactor);
                        } else {
                            denoms = CURRENCIES[currencyCode.toUpperCase()];
                            if (!denoms) {
                                throw new Error(`Currency ${currencyCode} not supported`);
                            }
                            scaledAmount = amount;
                        }

                        // Scale stock keys if coins
                        let scaledStock;
                        if (assetType === 'coins' && bundlesStock) {
                            scaledStock = {};
                            Object.keys(bundlesStock).forEach(key => {
                                const scaledKey = Math.round(parseFloat(key) * scaleFactor);
                                scaledStock[scaledKey] = bundlesStock[key];
                            });
                        } else {
                            scaledStock = bundlesStock;
                        }

            const stock = normalizeStock(denoms, scaledStock);
            const denomsSorted = [...denoms].sort((a, b) => b - a);

                        let foundIdeal = false;
                        let foundLoose = false;
                        let foundPartial = false;

                        // Try ideal blocks first
                        if (scaledAmount % BUNDLE_SIZE === 0 && !stopRequested) {
                            const idealVariants = enumerateIdealConfigs(scaledAmount, denoms, stock, maxVariants, BUNDLE_SIZE, BLOCK_SIZE);

                            if (idealVariants.length > 0) {
                                idealVariants.sort((a, b) => compareScores(
                scoreIdeal(a[0], a[1], denomsSorted),
                scoreIdeal(b[0], b[1], denomsSorted)
            ));

                                foundIdeal = true;
                            }
                        }

                        // Try loose bundles if no ideal found
                        if (!foundIdeal && scaledAmount % BUNDLE_SIZE === 0 && !stopRequested) {
                            const looseVariants = enumerateLooseConfigs(scaledAmount, denoms, stock, maxVariants, BUNDLE_SIZE);

                            if (looseVariants.length > 0) {
                                looseVariants.sort((a, b) => compareScores(
                scoreLoose(a, denomsSorted),
                scoreLoose(b, denomsSorted)
            ));

                                foundLoose = true;
                            }
                        }

                        // Try partial bundles if no ideal or loose found
                        if (!foundIdeal && !foundLoose && !stopRequested) {
                            const partialVariants = enumeratePartialConfigs(scaledAmount, denoms, stock, maxVariants, BUNDLE_SIZE);

                            if (partialVariants.length > 0) {
                                partialVariants.sort((a, b) => compareScores(
                scorePartial(a, denomsSorted),
                scorePartial(b, denomsSorted)
            ));

                                foundPartial = true;
                            } else if (!stopRequested) {
                                throw new Error('Cannot fulfill order with given stock');
                            }
                        }

                        // Send completion
                        self.postMessage({
                            type: 'complete',
                            data: {
                                hasIdeal: foundIdeal,
                                hasLoose: foundLoose,
                                hasPartial: foundPartial,
                                stopped: stopRequested,
                                scaleFactor: scaleFactor
                            }
                        });

                    } catch (error) {
                        self.postMessage({
                            type: 'error',
                            data: { message: error.message }
                        });
                    }
                } else if (type === 'stop') {
                    stopRequested = true;
                }
            };

// CJS export for testing
if (typeof module !== "undefined") {
    module.exports = {
        DEFAULT_BUNDLE_SIZE, DEFAULT_BLOCK_SIZE, INFINITY, CURRENCIES, COIN_CURRENCIES, COIN_SCALE,
        gcd, gcdArray,
        searchBlocks, searchBundles, searchWithTimeout,
        enumerateIdealConfigs, enumerateLooseConfigs, enumeratePartialConfigs,
        scoreIdeal, scoreLoose, scorePartial,
        compareScores, normalizeStock,
        get stopRequested() { return stopRequested; },
        set stopRequested(v) { stopRequested = v; }
    };
}
