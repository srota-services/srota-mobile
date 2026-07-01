/**
 * Redux store configuration
 * Centralized state management with Redux Toolkit
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authReducer, { initializeAuth } from './auth';
import { loadSignupWizardProgressCache } from '@/utils/signupWizardStorage';
import audiobooksReducer from './audiobooks';
import streamingReducer from './streaming';
import playerReducer from './player';
import settingsReducer from './settings';

// Import Reactotron for Redux monitoring (only active in development)
import Reactotron from '../config/ReactotronConfig';

/**
 * Root reducer combining all feature reducers
 */
const rootReducer = combineReducers({
   auth: authReducer,
   audiobooks: audiobooksReducer,
   streaming: streamingReducer,
   player: playerReducer,
   settings: settingsReducer,
});

/**
 * Redux persist configuration
 * Persists non-sensitive state to AsyncStorage
 */
const persistConfig = {
   key: 'root',
   storage: AsyncStorage,
   // Only persist user data (non-sensitive), not accessToken (stored in SecureStore)
   // Don't persist audiobooks as they should be fetched fresh on app start
   whitelist: ['auth', 'settings'],
   // Transform to exclude accessToken from persistence (it's in SecureStore)
   transforms: [],
};

/**
 * Persisted root reducer
 */
const persistedReducer = persistReducer(persistConfig, rootReducer);

/**
 * Redux store instance
 */
export const store = configureStore({
   reducer: persistedReducer,
   middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
         serializableCheck: {
            // Ignore redux-persist actions
            ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
         },
      }),
   // Add Reactotron enhancer in development mode
   enhancers: (getDefaultEnhancers) => {
      if (__DEV__ && Reactotron && 'createEnhancer' in Reactotron && typeof Reactotron.createEnhancer === 'function') {
         const enhancer = Reactotron.createEnhancer();
         if (enhancer && typeof enhancer === 'function') {
            return getDefaultEnhancers().concat(enhancer as ReturnType<typeof getDefaultEnhancers>[number]);
         }
      }
      return getDefaultEnhancers();
   },
});

/**
 * Persistor for redux-persist
 */
export const persistor = persistStore(store);

/**
 * Initialize auth state on app startup
 * Should be called in root layout
 */
export const initializeApp = async (): Promise<void> => {
   await Promise.all([
      store.dispatch(initializeAuth()),
      loadSignupWizardProgressCache(),
   ]);
};

/**
 * Type definitions for Redux
 */
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
