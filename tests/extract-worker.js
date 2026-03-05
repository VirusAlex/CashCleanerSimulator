import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadWorkerFunctions(postMessageFn) {
    const workerSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'worker.js'), 'utf-8');

    const sandbox = {
        self: {
            postMessage: postMessageFn || function () {},
            onmessage: null,
        },
        Date: Date,
        Math: Math,
        Array: Array,
        Error: Error,
        console: console,
        module: undefined, // Prevent CJS export block from running
    };

    const context = vm.createContext(sandbox);

    // Replace const/let with var so they become context properties
    const patchedSource = workerSource
        .replace(/\bconst\s+/g, 'var ')
        .replace(/\blet\s+/g, 'var ');

    vm.runInContext(patchedSource, context);

    return {
        BUNDLE_SIZE: context.DEFAULT_BUNDLE_SIZE,
        BLOCK_SIZE: context.DEFAULT_BLOCK_SIZE,
        INFINITY: context.INFINITY,
        FULL_BLOCK_VALUE: context.DEFAULT_BUNDLE_SIZE * context.DEFAULT_BLOCK_SIZE,
        CURRENCIES: context.CURRENCIES,
        gcd: context.gcd,
        gcdArray: context.gcdArray,
        searchBlocks: context.searchBlocks,
        searchBundles: context.searchBundles,
        searchWithTimeout: context.searchWithTimeout,
        enumerateIdealConfigs: context.enumerateIdealConfigs,
        enumerateLooseConfigs: context.enumerateLooseConfigs,
        enumeratePartialConfigs: context.enumeratePartialConfigs,
        scoreIdeal: context.scoreIdeal,
        scoreLoose: context.scoreLoose,
        scorePartial: context.scorePartial,
        compareScores: context.compareScores,
        normalizeStock: context.normalizeStock,
        // Access to trigger onmessage
        triggerMessage: (msg) => {
            if (sandbox.self.onmessage) {
                sandbox.self.onmessage({ data: msg });
            }
        },
        // Access to stop flag
        setStopRequested: (val) => {
            vm.runInContext(`stopRequested = ${val};`, context);
        },
        getStopRequested: () => {
            return vm.runInContext('stopRequested', context);
        },
    };
}
