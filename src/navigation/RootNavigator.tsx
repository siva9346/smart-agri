import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LogOut, Home, ShoppingBag, CloudRain, ShieldAlert, User as UserIcon } from 'lucide-react-native';
import { FarmerDashboard } from '../features/farmer/FarmerDashboard';
import { AdminDashboard } from '../features/admin/AdminDashboard';
import { FertilizerList } from '../features/farmer/FertilizerList';
import { RainUpdates, SymptomsView } from '../features/advisory/AdvisoryScreens';
import { AddLandScreen } from '../features/farmer/AddLandScreen';
import { PurchaseHistory } from '../features/farmer/PurchaseHistory';
import { EnquiryScreen } from '../features/farmer/EnquiryScreen';
import { AdminActionPlaceholder } from '../features/admin/AdminActionPlaceholder';
import { COLORS, SPACING } from '../theme';
import { UserRole } from '../types/domain';

const Tab = createBottomTabNavigator();
const FarmerStack = createNativeStackNavigator();
const AdminStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

const HeaderTitle = () => (
  <View style={styles.headerTitleContainer}>
    <Image 
      source={require('../../assets/logo.png')} 
      style={styles.headerLogo}
      resizeMode="contain"
    />
    <Text style={styles.headerTitleText}>Naveena Uzhavan</Text>
  </View>
);

const HeaderRight = ({ onLogout }: { onLogout: () => void }) => (
  <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
    <LogOut color={COLORS.error} size={22} />
  </TouchableOpacity>
);

const FarmerTabs = () => (
  <Tab.Navigator 
    screenOptions={{ 
      tabBarActiveTintColor: COLORS.primary,
      headerShown: Boolean(false) 
    }}
  >
    <Tab.Screen 
      name="Home" 
      component={FarmerDashboard} 
      options={{ tabBarIcon: ({ color }) => <Home color={color} size={24} /> }}
    />
    <Tab.Screen 
      name="Fertilizers" 
      component={FertilizerList} 
      options={{ tabBarIcon: ({ color }) => <ShoppingBag color={color} size={24} /> }}
    />
    <Tab.Screen 
      name="Rain" 
      component={RainUpdates} 
      options={{ tabBarIcon: ({ color }) => <CloudRain color={color} size={24} /> }}
    />
    <Tab.Screen 
      name="Symptoms" 
      component={SymptomsView} 
      options={{ tabBarIcon: ({ color }) => <ShieldAlert color={color} size={24} /> }}
    />
  </Tab.Navigator>
);

const AdminTabs = () => (
  <Tab.Navigator 
    screenOptions={{ 
      tabBarActiveTintColor: COLORS.secondary,
      headerShown: Boolean(false) 
    }}
  >
    <Tab.Screen 
      name="Admin" 
      component={AdminDashboard} 
      options={{ tabBarIcon: ({ color }) => <UserIcon color={color} size={24} /> }}
    />
    <Tab.Screen 
      name="Enquiries" 
      component={RainUpdates} 
      options={{ tabBarIcon: ({ color }) => <CloudRain color={color} size={24} /> }}
    />
  </Tab.Navigator>
);

export const RootNavigator = ({ role, onLogout }: { role: UserRole, onLogout: () => void }) => {
  const commonOptions = {
    headerTitle: () => <HeaderTitle />,
    headerRight: () => <HeaderRight onLogout={onLogout} />,
    headerShadowVisible: Boolean(false),
    headerStyle: { backgroundColor: COLORS.background },
  };

  const FarmerNavigator = () => (
    <FarmerStack.Navigator screenOptions={commonOptions}>
      <FarmerStack.Screen 
        name="FarmerTabs" 
        component={FarmerTabs} 
        options={{ headerTitle: () => <HeaderTitle /> }} 
      />
      <FarmerStack.Screen name="FertilizerList" component={FertilizerList} options={{ title: 'Products' }} />
      <FarmerStack.Screen name="RainUpdates" component={RainUpdates} options={{ title: 'Rain Forecast' }} />
      <FarmerStack.Screen name="Symptoms" component={SymptomsView} options={{ title: 'Crop Symptoms' }} />
      <FarmerStack.Screen name="AddLand" component={AddLandScreen} options={{ title: 'Add New Land' }} />
      <FarmerStack.Screen name="PurchaseHistory" component={PurchaseHistory} options={{ title: 'Purchase History' }} />
      <FarmerStack.Screen name="Enquiry" component={EnquiryScreen} options={{ title: 'Book Enquiry' }} />
    </FarmerStack.Navigator>
  );

  const AdminNavigator = () => (
    <AdminStack.Navigator screenOptions={commonOptions}>
      <AdminStack.Screen 
        name="AdminTabs" 
        component={AdminTabs} 
        options={{ headerTitle: () => <HeaderTitle /> }} 
      />
      <AdminStack.Screen name="AddCustomer" component={AdminActionPlaceholder} options={{ title: 'Add Customer' }} />
      <AdminStack.Screen name="ManageStock" component={AdminActionPlaceholder} options={{ title: 'Update Stock' }} />
      <AdminStack.Screen name="ManagePrice" component={AdminActionPlaceholder} options={{ title: 'Update Price' }} />
      <AdminStack.Screen name="ViewEnquiries" component={AdminActionPlaceholder} options={{ title: 'View Enquiries' }} />
      <AdminStack.Screen name="UpdateRain" component={RainUpdates} options={{ title: 'Update Rain Data' }} />
      <AdminStack.Screen name="UpdateSymptoms" component={SymptomsView} options={{ title: 'Update Symptoms' }} />
      <AdminStack.Screen name="CustomerDetails" component={AdminActionPlaceholder} options={{ title: 'Customer Details' }} />
      <AdminStack.Screen name="FertilizerList" component={FertilizerList} options={{ title: 'Management' }} />
    </AdminStack.Navigator>
  );

  return (
    <MainStack.Navigator screenOptions={{ headerShown: Boolean(false) }}>
      {role === 'ADMIN' ? (
        <MainStack.Screen name="AdminRoot" component={AdminNavigator} />
      ) : (
        <MainStack.Screen name="FarmerRoot" component={FarmerNavigator} />
      )}
    </MainStack.Navigator>
  );
};

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
    marginRight: SPACING.sm,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  logoutButton: {
    padding: SPACING.sm,
  },
});
