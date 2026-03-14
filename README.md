# Cash Cleaner Calculator 💰

**🌐 Live Demo:** [https://virusalex.github.io/CashCleanerSimulator/](https://virusalex.github.io/CashCleanerSimulator/)

Calculator for [Cash Cleaner Simulator](https://store.steampowered.com/app/2488370/Cash_Cleaner_Simulator/) — helps plan how to assemble cash orders from your stock into bundles and blocks.

---

## 🇺🇸 English

### What is this?

In Cash Cleaner Simulator you deal with piles of cash that need to be sorted and packed. This calculator takes an order amount, looks at what you have in stock, and tells you the best way to pack it — which denominations to use, how many bundles and blocks you get, and in what order to assemble them.

The algorithm tries to maximize full blocks (30 bundles = 3,000 bills), then fills with loose bundles, and covers the remainder with individual bills.

### Features

- **4 currencies**: 🇺🇸 USD, 🇪🇺 EUR, 🇯🇵 JPY, 🇬🇧 GBP with proper denominations and color coding
- **Bills and coins**: Toggle between banknote and coin asset types
- **Stock management**: Enter your stock per denomination as bundles or individual bills; balances update when you execute orders
- **Multiple variants**: Several packing options ranked by compactness — pick the one that fits
- **Block visualization**: Assembly dialog shows the packing order; click blocks to mark them as collected
- **No backend**: All calculations run in the browser. Settings and stock persist in LocalStorage
- **English / Russian** with auto-detection
- **Mobile friendly**

### How to use

1. Enter the order amount
2. Pick a currency (🇺🇸 USD, 🇪🇺 EUR, 🇯🇵 JPY, 🇬🇧 GBP)
3. Set stock limits per denomination (or leave unlimited)
4. Review variants, execute the one you want

Open the [live demo](https://virusalex.github.io/CashCleanerSimulator/) or clone the repo and serve it locally (e.g. `python -m http.server`). No build step needed.

---

## 🇷🇺 Русский

### Что это?

В Cash Cleaner Simulator нужно сортировать и упаковывать наличку. Калькулятор берёт сумму заказа, смотрит что есть на складе, и подбирает оптимальную раскладку — какие номиналы использовать, сколько пачек и блоков получится, в каком порядке собирать.

Алгоритм старается набрать максимум полных блоков (30 пачек = 3 000 купюр), потом добирает свободными пачками, остаток — отдельными купюрами.

### Возможности

- **4 валюты**: 🇺🇸 USD, 🇪🇺 EUR, 🇯🇵 JPY, 🇬🇧 GBP с реальными номиналами и цветовой маркировкой
- **Купюры и монеты**: Переключение между типами активов
- **Учёт остатков**: Остатки склада по номиналам — в пачках или поштучно; обновляются при выполнении заказов
- **Несколько вариантов**: Раскладки отсортированы по компактности — выбирайте подходящую
- **Визуализация сборки**: Диалог с порядком сборки; клик по блоку отмечает его как собранный
- **Без бэкенда**: Все расчёты в браузере. Настройки и остатки в LocalStorage
- **Русский / английский** с автоопределением
- **Мобильная версия**

### Как пользоваться

1. Введите сумму заказа
2. Выберите валюту (🇺🇸 USD, 🇪🇺 EUR, 🇯🇵 JPY, 🇬🇧 GBP)
3. Задайте остатки по номиналам (или оставьте без ограничений)
4. Выберите вариант и выполните заказ

Откройте [демо](https://virusalex.github.io/CashCleanerSimulator/) или склонируйте репозиторий и запустите локальный сервер (например `python -m http.server`). Сборка не требуется.

---

## Technical details

- Single-page app: HTML + CSS + JS, no build step
- Vanilla JavaScript, no frameworks
- Calculation in a Web Worker (DFS with timeout protection)
- LocalStorage for persistence

## License

MIT
