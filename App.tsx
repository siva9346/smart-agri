import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, RootState, AppDispatch } from './src/store';
import { signOut } from './src/store/authActions';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { ToastHost } from './src/ui';

// Dev-only: lets automated web smoke tests open screens directly.
if (__DEV__ && typeof window !== 'undefined') (window as any).__nav = navigationRef;

function AppContent() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <>
      <StatusBar style="dark" />
      {user ? (
        <RootNavigator role={user.role} onLogout={() => dispatch(signOut() as any)} />
      ) : (
        <AuthNavigator />
      )}
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <AppContent />
        </NavigationContainer>
        <ToastHost />
      </SafeAreaProvider>
    </Provider>
  );
}
