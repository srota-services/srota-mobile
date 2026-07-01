# AudioBook Mobile App

A modern, high-performance mobile application for streaming and managing audiobooks. Built with React Native and Expo, featuring a Netflix-inspired UI with smooth animations and optimized performance.

## 📱 Features

### Core Features

- **User Authentication**: Secure sign-in and sign-up with persistent sessions
- **Home Screen**: Personalized content discovery with trending and recommended audiobooks
- **Content Browsing**: Horizontal scrollable rows with categorized content
- **Profile Management**: User profile with liked stories, downloads, and personal lists
- **Search Functionality**: Quick search for stories, authors, and genres
- **Content Details**: Detailed view for individual audiobooks
- **Downloads**: Offline access to downloaded content
- **Share Functionality**: Share favorite stories with friends

### UI/UX Features

- **Smooth Animations**: Custom animated tab transitions using React Native Reanimated
- **Dark Theme**: Modern dark theme optimized for extended listening sessions
- **Responsive Design**: Optimized for both iOS and Android devices
- **Performance Optimized**: Memoized components and efficient rendering

## 🛠 Tech Stack

### Core Technologies

- **React Native** (0.81.5) - Cross-platform mobile framework
- **Expo** (~54.0.0) - Development platform and tooling
- **TypeScript** (~5.9.2) - Type-safe development
- **Expo Router** (~6.0.14) - File-based routing system

### State Management

- **Redux Toolkit** (^2.0.1) - Global state management
- **Redux Persist** (^6.0.0) - State persistence
- **TanStack Query** (^5.62.0) - Server state management and caching
- **Zustand** (^4.5.5) - Lightweight state management (optional)

### UI & Styling

- **NativeWind** (^4.2.1) - Tailwind CSS for React Native
- **React Native Reanimated** (~4.1.5) - Smooth animations
- **Expo Linear Gradient** (~15.0.7) - Gradient effects
- **Expo Image** (~3.0.10) - Optimized image loading

### Forms & Validation

- **React Hook Form** (^7.53.0) - Form management
- **Zod** (^3.23.8) - Schema validation
- **@hookform/resolvers** (^3.9.0) - Form validation resolvers

### Storage & Security

- **Expo Secure Store** (~15.0.7) - Secure credential storage
- **AsyncStorage** (2.2.0) - Async key-value storage

### Audio playback

- **react-native-track-player** — HLS chapter streaming, lock screen and notification controls
- See [docs/audio-player.md](docs/audio-player.md) for setup, skip duration setting, and native rebuild steps

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** `26.4.0` (see `.nvmrc` — run `nvm use` or `fnm use` from this directory)
- **npm** `11.17.0` (install with `npm i -g npm@11.17.0` if needed)
- **Expo CLI** (via `npx expo` or global install)
- **iOS Development**: Xcode (for macOS only)
- **Android Development**: Android Studio and Android SDK

All npm scripts enforce the Node and npm versions above. Run `npm run check:runtime` to verify your environment.

## 🚀 Getting Started

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd mobile
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure environment variables**

   The app supports four environments, each with a committed template in the repo:

   | Environment   | App name      | Bundle ID                  | Env file              |
   |---------------|---------------|----------------------------|-----------------------|
   | development   | Srota Dev     | `com.srota.mobile.dev`     | `.env.development`    |
   | testing       | Srota Test    | `com.srota.mobile.test`    | `.env.testing`        |
   | staging       | Srota Staging | `com.srota.mobile.staging` | `.env.staging`        |
   | production    | Srota         | `com.srota.mobile`         | `.env.production`     |

   Copy [`.env.example`](.env.example) for reference. For local secrets or LAN IP overrides, create a gitignored `.env.local`:

   ```env
   EXPO_PUBLIC_AUTH_API_URL=http://192.168.1.100
   EXPO_PUBLIC_API_URL=http://192.168.1.100
   EXPO_PUBLIC_STREAMING_URL=http://192.168.1.100
   EXPO_PUBLIC_AUTH_API_PORT=8080
   EXPO_PUBLIC_API_PORT=8081
   EXPO_PUBLIC_STREAMING_URL_PORT=8082
   ```

   **Ports (development defaults)**:
   - Auth API: **8080**
   - Main app API: **8081**
   - Streaming API: **8082**
   - Android emulator uses `10.0.2.2` automatically when URLs are empty
   - iOS simulator uses `localhost` when URLs are empty

### Running the App

#### Development Mode (default)

```bash
# Start Metro with development env
npm run start:development
# alias: npm start, npm run start:dev

# Run on a specific platform (local native build)
npm run run:android:development   # alias: npm run build:dev:android
npm run run:ios:development       # alias: npm run build:dev:ios
```

#### Other environments (Metro)

```bash
npm run start:testing
npm run start:staging
npm run start:production
```

#### Local native builds (`expo run`)

```bash
npm run run:android:testing
npm run run:ios:testing
npm run run:android:staging
npm run run:ios:staging
npm run run:android:production   # release variant
npm run run:ios:production       # Release configuration
```

**Switching bundle ID / environment:** run prebuild once for the target env before the first native build:

```bash
npm run prebuild:development   # or prebuild:testing / staging / production
```

#### Cloud builds (EAS)

Requires [EAS CLI](https://docs.expo.dev/build/setup/) and `eas login`. Set production secrets via [EAS Secrets](https://docs.expo.dev/build-reference/variables/) rather than committing them.

```bash
npm run build:android:development
npm run build:ios:development
npm run build:android:testing
npm run build:ios:testing
npm run build:android:staging
npm run build:ios:staging
npm run build:android:production   # AAB for Play Store
npm run build:ios:production       # IPA for App Store
```

#### OTA updates (expo-updates)

```bash
npm run update:testing
npm run update:staging
npm run update:production
```

Run `eas update:configure` once to set `EXPO_PUBLIC_UPDATES_URL`.

#### Windows note

If Android builds fail with a Java error, set `JAVA_HOME` in your shell before running native builds (e.g. `C:\Program Files\Java\jdk-21`). It is intentionally not hardcoded in `package.json`.

#### Legacy commands

```bash
npm run android    # starts Metro + opens Android (development)
npm run ios        # starts Metro + opens iOS (development)
npm run web
```

## 📁 Project Structure

```
mobile/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Home screen
│   │   ├── new-hot.tsx    # New & Hot screen
│   │   └── profile.tsx    # Profile screen
│   ├── details/           # Content details
│   ├── search.tsx         # Search screen
│   ├── signin.tsx        # Sign in screen
│   ├── signup.tsx        # Sign up screen
│   └── _layout.tsx        # Root layout
├── components/            # Reusable UI components
│   ├── AnimatedTabScreen.tsx
│   ├── ContentCard.tsx
│   ├── ContentRow.tsx
│   ├── Header.tsx
│   ├── HeroSection.tsx
│   ├── NavigationPills.tsx
│   └── ...
├── hooks/                 # Custom React hooks
│   └── useTabNavigation.tsx
├── services/              # API and service layers
│   ├── api.ts
│   └── auth.ts
├── store/                 # Redux store configuration
│   ├── auth.ts
│   └── index.ts
├── theme/                 # Theme configuration
│   └── index.ts
├── utils/                 # Utility functions
│   └── types.ts
├── assets/                # Static assets
│   ├── fonts/
│   └── images/
└── test/                  # Test files
```

## 🎨 Key Components

### Reusable Components

- **ContentCard**: Displays individual content items with images and badges
- **ContentRow**: Horizontal scrollable row of content cards
- **Header**: App header with user greeting and action icons
- **HeroSection**: Large featured content section
- **NavigationPills**: Category navigation pills
- **StoryCardWithShare**: Content card with share functionality
- **AnimatedTabScreen**: Animated wrapper for tab screens

### Performance Optimizations

The app is heavily optimized for performance:

- **Memoization**: All components use `React.memo` to prevent unnecessary re-renders
- **useMemo/useCallback**: Expensive computations and handlers are memoized
- **Image Caching**: Images use `expo-image` with memory-disk caching
- **Lazy Loading**: ScrollViews use `removeClippedSubviews` for better performance
- **Query Caching**: TanStack Query configured with 5-minute stale time
- **Component Isolation**: Each section is memoized independently to prevent cascade re-renders

## 🧪 Testing

Run tests with:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## 🔧 Development Scripts

| Script               | Description                    |
| -------------------- | ------------------------------ |
| `npm start`          | Start Expo development server  |
| `npm run start:dev`  | Start with dev client          |
| `npm run android`    | Run on Android device/emulator |
| `npm run ios`        | Run on iOS device/simulator    |
| `npm run web`        | Run on web browser             |
| `npm run lint`       | Run ESLint                     |
| `npm run lint:fix`   | Fix ESLint errors              |
| `npm run format`     | Format code with Prettier      |
| `npm run type-check` | Run TypeScript type checking   |
| `npm test`           | Run Jest tests                 |

## 🎯 Code Quality

The project follows strict code quality standards:

- **TypeScript**: Full type safety throughout the codebase
- **ESLint**: Code linting with Expo and React plugins
- **Prettier**: Consistent code formatting
- **React Hooks Rules**: Proper use of React hooks
- **No `any` Types**: Minimal use of `any` type for better type safety

## 📱 Platform Support

- ✅ iOS (iPhone & iPad)
- ✅ Android (Phone & Tablet)
- ✅ Web (Progressive Web App)

## 🔐 Security

- Secure credential storage using Expo Secure Store
- Redux state persistence with encryption
- Secure API communication
- Input validation with Zod schemas

## 🚧 Development Status

This project is currently in active development. Features are being added and refined regularly.

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style Guidelines

- Write TypeScript with proper types (avoid `any`)
- Use functional components with hooks
- Follow React best practices
- Add comments for complex logic
- Write tests for new features
- Ensure all components are reusable and memoized

## 📄 License

This project is private and proprietary.

## 👥 Authors

- **Development Team** - AudioBook Mobile App

## 🙏 Acknowledgments

- Expo team for the excellent development platform
- React Native community for amazing libraries
- Netflix for UI/UX inspiration

---

**Note**: This app requires a backend API server to function properly. Make sure to configure the API URL in your environment variables or `services/api.ts`.

For more information, please refer to the project documentation or contact the development team.
