import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ShoppingBag, Users, MessageSquare } from 'lucide-react-native';

import { AdminDashboardScreen } from '../features/admin/screens/AdminDashboardScreen';
import { OrderListScreen } from '../features/admin/screens/OrderListScreen';
import { CustomerListScreen } from '../features/admin/screens/CustomerListScreen';
import { EnquiryListScreen } from '../features/admin/screens/EnquiryListScreen';
import { COLORS } from '../theme';

const Tab = createBottomTabNavigator();

export const AdminTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.secondary,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrderListScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <ShoppingBag color={color} size={24} />,
        }}
      />
      <Tab.Screen
        name="CustomersTab"
        component={CustomerListScreen}
        options={{
          title: 'Customers',
          tabBarIcon: ({ color }) => <Users color={color} size={24} />,
        }}
      />
      <Tab.Screen
        name="EnquiriesTab"
        component={EnquiryListScreen}
        options={{
          title: 'Enquiries',
          tabBarIcon: ({ color }) => <MessageSquare color={color} size={24} />,
        }}
      />
    </Tab.Navigator>
  );
};
