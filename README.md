# Virtual Scroll Package

This repository contains a high-performance virtual scroll library for Angular with an innovative DOM reuse strategy.

## 📦 What's Inside

- **Library** (`packages/virtual-scroll/`) - The virtual scroll component package
- **Demo App** (`src/`) - Interactive demo showcasing all features

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Run Demo Application

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

### Build Library

```bash
npm run build:lib
```

The built library will be in `dist/virtual-scroll/`.

### Watch Library (Development)

```bash
npm run watch:lib
```

## 📚 Library Documentation

See the [library README](packages/virtual-scroll/README.md) for detailed documentation on using the virtual scroll component.

## 🎯 Features

- **DOM Reuse Strategy**: Elements stay in DOM, only content changes
- **Dynamic & Fixed Sizing**: Support for both modes
- **Vertical & Horizontal**: Dual direction support
- **High Performance**: Handles 10,000+ items smoothly
- **ResizeObserver**: Automatic size tracking
- **Standalone Components**: Modern Angular architecture

## 🏗️ Project Structure

```
virtual-scroll/
├── packages/
│   └── virtual-scroll/          # Library source
│       ├── src/
│       │   ├── lib/             # Components & directives
│       │   └── public-api.ts    # Public exports
│       ├── ng-package.json      # Library build config
│       └── package.json         # Library package config
├── src/                         # Demo application
│   └── app/
│       ├── app.component.ts     # Demo examples
│       └── ...
├── angular.json                 # Angular workspace config
├── package.json                 # Root package config
└── README.md                    # This file
```

## 🛠️ Development

### Adding Features

1. Edit library files in `packages/virtual-scroll/src/lib/`
2. Build the library: `npm run build:lib`
3. The demo app will pick up changes automatically

### Running Tests

```bash
npm test
```

## 📝 Scripts

- `npm start` - Start demo application
- `npm run build` - Build demo application
- `npm run build:lib` - Build library package
- `npm run watch:lib` - Watch library for changes
- `npm test` - Run tests

## 🌟 Demo Features

The demo application showcases:

1. **Dynamic Heights** - Items with varying heights
2. **Fixed Heights** - Optimized uniform list
3. **Horizontal Scroll** - Side-scrolling items
4. **Large Dataset** - 10,000 items performance test

## 📦 Publishing

To publish the library to npm:

1. Build the library:
   ```bash
   npm run build:lib
   ```

2. Navigate to the built library:
   ```bash
   cd dist/virtual-scroll
   ```

3. Publish to npm:
   ```bash
   npm publish --access public
   ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🐛 Issues

Found a bug or have a feature request? Please [open an issue](https://github.com/vladislavburko/virtual-scroll/issues).

## 👤 Author

**Vladislav Burko**

---

⭐ If you find this project useful, please consider giving it a star on GitHub!
