# Cash Cleaner Optimizer - Static Version

**🌐 Live Demo:** [GitHub Pages Link](https://your-username.github.io/cash-cleaner-optimizer/)

A static, client-side web application for optimizing cash packaging into bundles and blocks. This version runs entirely in the browser with JavaScript - no server required!

## ✨ Features

- 🎯 **Complete optimization logic** - All Python algorithms ported to JavaScript
- 📱 **Fully responsive design** - Works perfectly on mobile, tablet, and desktop
- 🌍 **Multi-language support** - English and Russian with automatic detection
- 🎨 **Beautiful modern UI** - Gradient backgrounds, smooth animations, and color-coded denominations
- ⚡ **Instant results** - No server calls, everything runs in your browser
- 💾 **Local storage** - Remembers your language preference
- 🚀 **GitHub Pages ready** - Deploy anywhere static hosting is supported

## 🎨 Supported Features

### Currencies & Denominations
- **USD**: 100, 50, 20, 10
- **EUR**: 100, 50, 20  
- **JPY**: 10,000, 5,000, 1,000

### Optimization Types
- **🎯 Ideal Blocks**: Priority formation of 30-bundle blocks (100 bills each)
- **📦 Loose Bundles**: Fallback mode when ideal blocks aren't possible
- **📊 Stock Awareness**: Respects bundle quantity limitations
- **🔄 Multiple Variants**: Shows up to 100 alternative solutions

## 🚀 Quick Start

### Option 1: GitHub Pages (Recommended)

1. Fork this repository
2. Enable GitHub Pages in repository settings
3. Choose source: `/ (root)` or `/static-version`
4. Your app will be available at: `https://your-username.github.io/repository-name/`

### Option 2: Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/cash-cleaner-optimizer.git

# Navigate to static version
cd cash-cleaner-optimizer/docs

# Serve locally (Python)
python -m http.server 8000

# Or use any other static server
# npx serve .
# php -S localhost:8000
```

### Option 3: Any Static Hosting

Upload the `index.html` file to any static hosting service:
- Netlify
- Vercel  
- Surge.sh
- Firebase Hosting
- AWS S3 + CloudFront

## 💻 Development

### Architecture

The application is built as a **Single Page Application (SPA)** with:

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **No dependencies**: Only external resources are fonts and icons from CDN
- **Client-side optimization**: Complete port of Python DFS algorithms
- **Progressive enhancement**: Works even with JavaScript disabled (form validation)

### Core Algorithms (Ported from Python)

```javascript
// Ideal block enumeration with DFS
function enumerateIdealConfigs(amount, denoms, stock)

// Loose bundle enumeration  
function enumerateLooseConfigs(amount, denoms, stock)

// Multi-criteria scoring and sorting
function scoreIdeal(blocks, bundleCounts, denoms)
function scoreLoose(bundleCounts, denoms)
```

### Internationalization System

```javascript
// Language detection and persistence
function detectBrowserLanguage()
function initLanguage()
function applyLanguage(lang)

// Translation with parameters
function t(key, params = {})
```

## 🎯 Usage Examples

### Example 1: Ideal Blocks (USD)
- **Amount**: 750,000 USD  
- **Stock**: 100=18, 50=40
- **Result**: 2 ideal blocks + optimal combination

### Example 2: Fallback Mode (EUR)
- **Amount**: 150,000 EUR
- **Stock**: 100=10, 50=5  
- **Result**: Loose bundle combinations (ideal blocks impossible)

### Example 3: Unlimited Stock (JPY)
- **Amount**: 3,000,000 JPY
- **Stock**: (unlimited)
- **Result**: Multiple ideal block options

## 🎨 Customization

### Adding New Languages

```javascript
// Add to TRANSLATIONS object
const TRANSLATIONS = {
    en: { /* existing */ },
    ru: { /* existing */ },
    fr: {
        title: 'Optimiseur Cash Cleaner',
        subtitle: 'Optimiser l\'emballage des espèces...',
        // ... add all keys
    }
};

// Update language detection
function detectBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('en')) return 'en';
    if (browserLang.startsWith('ru')) return 'ru';
    if (browserLang.startsWith('fr')) return 'fr';  // Add this
    return 'en';
}
```

### Adding New Currencies

```javascript
// Add to CURRENCIES object
const CURRENCIES = {
    'USD': [100, 50, 20, 10],
    'EUR': [100, 50, 20],
    'JPY': [10000, 5000, 1000],
    'GBP': [50, 20, 10, 5],  // Add new currency
};

// Add colors for denominations
const DENOM_COLORS = {
    // ... existing colors
    5: '#8b5cf6',   // purple for GBP £5
};
```

### Customizing Styling

The app uses CSS custom properties for easy theming:

```css
:root {
    --primary-color: #2563eb;      /* Change primary color */
    --primary-hover: #1d4ed8;      /* Hover state */
    --secondary-color: #f8fafc;    /* Background panels */
    
    /* Denomination colors */
    --denom-100: #fbbf24;          /* Customize per denomination */
    --denom-50: #f97316;
}
```

## 📱 Mobile Optimization

The app is fully optimized for mobile devices:

- **Responsive grid** that stacks on mobile
- **Touch-friendly** buttons and inputs  
- **Optimized font sizes** for small screens
- **Compact stock input** layout for mobile
- **Viewport meta tag** for proper scaling

## 🔧 Browser Support

- **Modern browsers**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **JavaScript features used**: ES6+ (arrow functions, destructuring, modules)
- **CSS features**: CSS Grid, CSS Custom Properties, Flexbox
- **Graceful degradation**: Basic functionality without JavaScript

## 🚀 Performance

- **Lightweight**: Single HTML file (~50KB)
- **Fast loading**: Minimal external dependencies
- **Efficient algorithms**: Optimized DFS with early termination
- **No network calls**: Everything runs client-side
- **Caching**: Browser caches everything after first load

## 📄 License

This project is open source. Feel free to use, modify, and distribute.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Issues & Support

If you encounter any issues or have suggestions:

1. Check existing [GitHub Issues](https://github.com/your-username/cash-cleaner-optimizer/issues)
2. Create a new issue with:
   - Browser and version
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable

---

**Made with ❤️ for efficient cash handling optimization** 