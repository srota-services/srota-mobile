module.exports = {
   preset: 'jest-expo',
   transformIgnorePatterns: [
      'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@reduxjs/toolkit|react-redux|immer)',
   ],
   setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
   collectCoverageFrom: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'services/**/*.{ts,tsx}',
      'utils/**/*.{ts,tsx}',
      '!**/*.d.ts',
      '!**/node_modules/**',
   ],
   moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/$1',
      '\\.svg$': '<rootDir>/tests/__mocks__/svgMock.tsx',
   },
};

