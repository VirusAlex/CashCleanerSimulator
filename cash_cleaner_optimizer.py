"""
Cash Cleaner Simulator – Packing Optimiser (stock‑aware, graceful fallback)
==========================================================================
Fast DFS solver for Cash Cleaner orders:
* **Ideal mode** – builds blocks of exactly 30 ideal bundles (100 notes each).
* **Fallback** – if no ideal‑block solution fits current stock, suggests
  combinations of ideal bundles without forcing them into full 30‑bundle
  blocks.

Stock constraints, ANSI colour‑coding by denomination, same CLI/API as before.

Usage examples
--------------
```bash
# Try ideal blocks first; fall back to loose bundles if needed
python cash_cleaner_optimizer.py 750000 USD --stock "100=18,50=40"
```

API:
```python
variants = find_ideal_block_variants(750_000, "USD", bundles_stock={100: 18, 50: 40})
if not variants:
    variants = find_loose_bundle_variants(750_000, "USD", bundles_stock={...})
```
"""
from __future__ import annotations

import argparse
from itertools import islice
from typing import Dict, List, Tuple, Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BUNDLE_SIZE: int = 100     # notes per ideal bundle
BLOCK_SIZE: int = 30       # bundles per ideal block

CURRENCIES: Dict[str, List[int]] = {
    "USD": [100, 50, 20, 10],
    "EUR": [100, 50, 20],
    "JPY": [10000, 5000, 1000],
    # Extend here …
}

# ANSI colour escapes -------------------------------------------------------
RESET = "\033[0m"
DENOM_COLOURS: Dict[int, str] = {
    100: "\033[93m",           # bright yellow
    50: "\033[38;5;208m",     # orange (256‑colour palette)
    20: "\033[94m",            # blue
    10: "\033[92m",            # green
    10000: "\033[93m",         # bright yellow (parity with 100)
    5000: "\033[38;5;208m",    # orange
    1000: "\033[92m",          # green
}

_INFTY = 10 ** 9  # sentinel for unlimited stock

# ---------------------------------------------------------------------------
# Helper – colourised text
# ---------------------------------------------------------------------------

def _c(text: str, denom: int) -> str:
    return f"{DENOM_COLOURS.get(denom, '')}{text}{RESET}"

# ---------------------------------------------------------------------------
# Ideal‑block solver (unchanged core, but extracted for reuse)
# ---------------------------------------------------------------------------

def _search_blocks(denoms: List[int],
                   blocks: int,
                   i: int,
                   bundles_left: int,
                   value_left: int,
                   cur: List[int],
                   out: List[Tuple[int, List[int]]],
                   stock: Dict[int, int]) -> None:
    """Depth‑first enumeration across denominations with strict block size."""
    if i == len(denoms) - 1:
        d = denoms[i]
        needed_bundles = value_left // d if d else 0
        if (value_left == d * needed_bundles and
                needed_bundles == bundles_left and
                needed_bundles <= stock[d]):
            cur[i] = needed_bundles
            out.append((blocks, cur.copy()))
        return

    d = denoms[i]
    max_for_d = min(bundles_left, stock[d], value_left // d)
    for b in range(max_for_d + 1):
        _search_blocks(denoms,
                       blocks,
                       i + 1,
                       bundles_left - b,
                       value_left - d * b,
                       cur.__setitem__(i, b) or cur,  # inplace set + pass cur
                       out,
                       stock)
    cur[i] = 0  # clean for parent callers


def _enumerate_ideal_configs(amount: int,
                             denoms: List[int],
                             stock: Dict[int, int]) -> List[Tuple[int, List[int]]]:
    if amount % BUNDLE_SIZE:
        return []

    units = amount // BUNDLE_SIZE
    denoms = sorted(denoms, reverse=True)

    smallest_bundle_value = min(denoms) * BUNDLE_SIZE
    theoretical_max_blocks = amount // (smallest_bundle_value * BLOCK_SIZE)

    total_stock_bundles = sum(stock[d] for d in denoms)
    max_blocks = min(theoretical_max_blocks, total_stock_bundles // BLOCK_SIZE)

    solutions: List[Tuple[int, List[int]]] = []
    cur = [0] * len(denoms)

    for blocks in range(1, max_blocks + 1):
        bundles_total = blocks * BLOCK_SIZE
        if bundles_total > total_stock_bundles:
            break
        _search_blocks(denoms,
                       blocks,
                       0,
                       bundles_total,
                       units,
                       cur,
                       solutions,
                       stock)
    return solutions


# ---------------------------------------------------------------------------
# Loose‑bundle fallback (no 30‑bundle requirement)
# ---------------------------------------------------------------------------

def _search_bundles(denoms: List[int],
                    i: int,
                    value_left: int,
                    cur: List[int],
                    out: List[List[int]],
                    stock: Dict[int, int]) -> None:
    """DFS without block constraint – just exact amount in bundles."""
    if i == len(denoms) - 1:
        d = denoms[i]
        needed = value_left // d if d else 0
        if value_left == d * needed and needed <= stock[d]:
            cur[i] = needed
            out.append(cur.copy())
        return

    d = denoms[i]
    max_for_d = min(stock[d], value_left // d)
    for b in range(max_for_d + 1):
        cur[i] = b
        _search_bundles(denoms,
                        i + 1,
                        value_left - d * b,
                        cur,
                        out,
                        stock)
    cur[i] = 0


def _enumerate_loose_configs(amount: int,
                             denoms: List[int],
                             stock: Dict[int, int]) -> List[List[int]]:
    if amount % BUNDLE_SIZE:
        return []

    units = amount // BUNDLE_SIZE
    denoms = sorted(denoms, reverse=True)

    cur = [0] * len(denoms)
    out: List[List[int]] = []
    _search_bundles(denoms, 0, units, cur, out, stock)
    return out


# ---------------------------------------------------------------------------
# Variant scoring helpers
# ---------------------------------------------------------------------------

def _score_ideal(blocks: int, bundle_counts: List[int], denoms: List[int]) -> Tuple:
    kinds = sum(1 for c in bundle_counts if c)
    avg = sum(d * c for d, c in zip(denoms, bundle_counts)) / sum(bundle_counts)
    return (blocks, kinds, -avg)


def _score_loose(bundle_counts: List[int], denoms: List[int]) -> Tuple:
    total_bundles = sum(bundle_counts)
    kinds = sum(1 for c in bundle_counts if c)
    avg = sum(d * c for d, c in zip(denoms, bundle_counts)) / total_bundles
    return (total_bundles, kinds, -avg)  # fewer bundles, fewer kinds, larger avg


# ---------------------------------------------------------------------------
# Public APIs
# ---------------------------------------------------------------------------

def _normalise_stock(denoms: List[int], bundles_stock: Optional[Dict[int, int]]) -> Dict[int, int]:
    stock = {d: _INFTY for d in denoms}
    if bundles_stock:
        for d, qty in bundles_stock.items():
            stock[d] = qty
    return stock


def find_ideal_block_variants(amount: int,
                              currency_code: str,
                              max_variants: int = 5,
                              bundles_stock: Optional[Dict[int, int]] = None
                              ) -> List[Tuple[int, List[int]]]:
    denoms = CURRENCIES[currency_code.upper()]
    stock = _normalise_stock(denoms, bundles_stock)
    raw = _enumerate_ideal_configs(amount, denoms, stock)
    raw.sort(key=lambda tpl: _score_ideal(*tpl, denoms))
    return list(islice(raw, max_variants))


def find_loose_bundle_variants(amount: int,
                               currency_code: str,
                               max_variants: int = 5,
                               bundles_stock: Optional[Dict[int, int]] = None
                               ) -> List[List[int]]:
    denoms = CURRENCIES[currency_code.upper()]
    stock = _normalise_stock(denoms, bundles_stock)
    raw = _enumerate_loose_configs(amount, denoms, stock)
    raw.sort(key=lambda bc: _score_loose(bc, denoms))
    return list(islice(raw, max_variants))


# ---------------------------------------------------------------------------
# Pretty printers
# ---------------------------------------------------------------------------

def _describe_ideal(blocks: int, bundle_counts: List[int], denoms: List[int]) -> str:
    lines = [f"{blocks} ideal block(s) = {blocks * BLOCK_SIZE} bundles"]
    total = 0
    for d, b in zip(denoms, bundle_counts):
        if b:
            value = d * b * BUNDLE_SIZE
            total += value
            lines.append(f"  • {_c(f'{b:>2} × bundles of {d}', d)} → {value:,}")
    lines.append(f"TOTAL: {total:,}")
    return "\n".join(lines)


def _describe_loose(bundle_counts: List[int], denoms: List[int]) -> str:
    total_bundles = sum(bundle_counts)
    lines = [f"No ideal blocks – {total_bundles} bundle(s)"]
    total = 0
    for d, b in zip(denoms, bundle_counts):
        if b:
            value = d * b * BUNDLE_SIZE
            total += value
            lines.append(f"  • {_c(f'{b:>2} × bundles of {d}', d)} → {value:,}")
    lines.append(f"TOTAL: {total:,}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI helpers
# ---------------------------------------------------------------------------

def _parse_stock_arg(spec: str, denoms: List[int]) -> Dict[int, int]:
    if not spec:
        return {}
    out: Dict[int, int] = {}
    for entry in spec.split(','):
        try:
            denom_s, qty_s = entry.split('=')
            denom = int(denom_s)
            qty = int(qty_s)
        except ValueError:
            raise argparse.ArgumentTypeError(f"Invalid --stock fragment '{entry}'. Use DENOM=QTY")
        if denom not in denoms:
            raise argparse.ArgumentTypeError(f"Denomination {denom} not valid for this currency")
        if qty < 0:
            raise argparse.ArgumentTypeError("Stock quantities must be non‑negative")
        out[denom] = qty
    return out


def _cli_args() -> argparse.Namespace:
    p = argparse.ArgumentParser("Cash Cleaner ideal‑block optimiser (with fallback)")
    p.add_argument("amount", type=int, help="Order value, e.g. 300000")
    p.add_argument("currency", choices=CURRENCIES.keys(), help="Currency code (USD/EUR/JPY…)")
    p.add_argument("-n", "--num", type=int, default=5, help="Number of variants to show")
    p.add_argument("--no-colour", action="store_true", help="Disable ANSI colours")
    p.add_argument("-s", "--stock", type=str, metavar="SPEC",
                   help="Bundles available per denom, e.g. '100=25,50=8'")
    return p.parse_args()


def main() -> None:
    args = _cli_args()

    if args.no_colour:
        DENOM_COLOURS.clear()

    denoms = sorted(CURRENCIES[args.currency.upper()], reverse=True)
    bundles_stock = _parse_stock_arg(args.stock, denoms) if args.stock else None

    # 1) Try ideal blocks
    ideal_variants = find_ideal_block_variants(args.amount, args.currency, args.num, bundles_stock)

    if ideal_variants:
        descr = "\n" + "-" * 60 + "\n"
        print(descr.join(_describe_ideal(b, counts, denoms) for b, counts in ideal_variants))
        return

    # 2) Loose bundles fallback
    loose_variants = find_loose_bundle_variants(args.amount, args.currency, args.num, bundles_stock)
    if loose_variants:
        print("⚠ No ideal block possible. Showing loose‑bundle variants:\n")
        descr = "\n" + "-" * 60 + "\n"
        print(descr.join(_describe_loose(counts, denoms) for counts in loose_variants))
    else:
        raise SystemExit("✘ Cannot fulfil order with given stock (even without ideal blocks).")


if __name__ == "__main__":
    main()
