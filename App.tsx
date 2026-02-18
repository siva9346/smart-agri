import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LoginScreen } from './src/features/auth/LoginScreen';
import { RootNavigator } from './src/navigation/RootNavigator';
import { User } from './src/types/domain';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (authenticatedUser: User) => {
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {!user ? (
          <LoginScreen onLoginSuccess={handleLogin} />
        ) : (
          <RootNavigator role={user.role} onLogout={handleLogout} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
