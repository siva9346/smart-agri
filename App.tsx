import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store, RootState, AppDispatch } from './src/store';
import { logout } from './src/store/authSlice';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { RootNavigator } from './src/navigation/RootNavigator';

function AppContent() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <>
      <StatusBar style="dark" />
      {user ? (
        <RootNavigator role={user.role} onLogout={() => dispatch(logout())} />
      ) : (
        <LoginScreen />
      )}
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <NavigationContainer>
          <AppContent />
        </NavigationContainer>
      </SafeAreaProvider>
    </Provider>
  );
}
