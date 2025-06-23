# Cash Cleaner Calculator 💰

**🌐 Live Demo:** [https://virusalex.github.io/CashCleanerSimulator/](https://virusalex.github.io/CashCleanerSimulator/)

A smart web calculator for optimizing cash distribution into bundles and blocks with support for multiple currencies and flexible stock management.

---

## 🇺🇸 English

### What is this?

Cash Cleaner Calculator helps you determine the optimal way to package cash into bundles and blocks while respecting stock limitations. It's designed for banks, cash management companies, and financial institutions that need to efficiently organize large amounts of cash.

### Key Features

- **🎯 Smart Optimization**: Three-level algorithm (Ideal Blocks → Loose Bundles → Partial Packs)
- **💱 Multi-Currency**: USD, EUR, JPY support with proper denominations
- **📦 Flexible Stock Input**: Switch between bundle count or individual bill count
- **⚡ Instant Results**: No server required - runs entirely in your browser
- **🌍 Bilingual**: English/Russian interface with auto-detection
- **📱 Mobile Friendly**: Responsive design works on any device
- **💾 Smart Storage**: Remembers your preferences and stock data

### How it works

1. **Enter order amount** - Any positive value
2. **Select currency** - USD (🇺🇸), EUR (🇪🇺), or JPY (🇯🇵)
3. **Set stock limits** - Toggle between bundles (📦) or bills (💵) input
4. **Get optimized results** - Multiple variants ranked by efficiency

### Algorithm Logic

- **Ideal Blocks**: 30 bundles per block (3,000 bills total) - most compact
- **Loose Bundles**: Any number of complete 100-bill bundles
- **Partial Packs**: Individual bills when bundles can't cover the amount

### Quick Start

Simply open the [live demo](https://virusalex.github.io/CashCleanerSimulator/) in your browser or download `index.html` and open it locally. No installation required!

---

## 🇷🇺 Русский

### Что это?

Cash Cleaner Calculator помогает определить оптимальный способ упаковки наличных в пачки и блоки с учетом ограничений по остаткам. Разработан для банков, инкассаторских компаний и финансовых учреждений, которым нужно эффективно организовывать большие объемы наличности.

### Основные возможности

- **🎯 Умная оптимизация**: Трёхуровневый алгоритм (Идеальные блоки → Свободные пачки → Неполные пачки)
- **💱 Мультивалютность**: Поддержка USD, EUR, JPY с правильными номиналами
- **📦 Гибкий ввод остатков**: Переключение между количеством пачек или отдельных купюр
- **⚡ Мгновенные результаты**: Работает полностью в браузере без сервера
- **🌍 Двуязычность**: Интерфейс на английском/русском с автоопределением
- **📱 Мобильная версия**: Адаптивный дизайн для любых устройств
- **💾 Умное хранение**: Запоминает настройки и данные склада

### Как работает

1. **Введите сумму заказа** - Любое положительное значение
2. **Выберите валюту** - USD (🇺🇸), EUR (🇪🇺) или JPY (🇯🇵)
3. **Укажите остатки склада** - Переключайтесь между пачками (📦) и купюрами (💵)
4. **Получите оптимизированные результаты** - Несколько вариантов по эффективности

### Логика алгоритма

- **Идеальные блоки**: 30 пачек в блоке (3,000 купюр) - максимальная компактность
- **Свободные пачки**: Любое количество полных пачек по 100 купюр
- **Неполные пачки**: Отдельные купюры, когда пачки не покрывают сумму

### Быстрый старт

Просто откройте [демо-версию](https://virusalex.github.io/CashCleanerSimulator/) в браузере или скачайте `index.html` и откройте локально. Установка не требуется!

---

## 🛠 Technical Details

- **Single file**: `index.html` (~100KB) - no dependencies
- **Technologies**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Algorithms**: Depth-first search with optimization constraints
- **Storage**: LocalStorage for settings and stock data
- **Performance**: Client-side processing with timeout protection

## 📄 License

MIT License - feel free to use, modify, and distribute.

## 🤝 Contributing

Found a bug or have an idea? Open an issue or submit a pull request on [GitHub](https://github.com/VirusAlex/CashCleanerSimulator). 