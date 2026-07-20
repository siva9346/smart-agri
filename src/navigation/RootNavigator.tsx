import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { LogOut, Home, ShoppingBag, CloudRain, ShoppingCart, User as UserIcon, ArrowLeft, Bell } from 'lucide-react-native';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { FarmerDashboard } from '../features/farmer/FarmerDashboard';
import { RainUpdates, SymptomsView } from '../features/advisory/AdvisoryScreens';
import { AddLandScreen } from '../features/farmer/AddLandScreen';
import { PurchaseHistory } from '../features/farmer/PurchaseHistory';
import { EnquiryScreen } from '../features/farmer/EnquiryScreen';
import { AdminActionPlaceholder } from '../features/admin/AdminActionPlaceholder';
import { AdminTabNavigator } from './AdminTabNavigator';
import { OrderListScreen as AdminOrderListScreen } from '../features/admin/screens/OrderListScreen';
import { OrderDetailsScreen } from '../features/admin/screens/OrderDetailsScreen';
import { StockListScreen } from '../features/admin/screens/StockListScreen';
import { AddStockScreen as AdminAddStockScreen } from '../features/admin/screens/AddStockScreen';
import { EditStockScreen } from '../features/admin/screens/EditStockScreen';
import { CustomerListScreen } from '../features/admin/screens/CustomerListScreen';
import { AddCustomerScreen as AdminAddCustomerScreen } from '../features/admin/screens/AddCustomerScreen';
import { AddAdminScreen } from '../features/admin/screens/AddAdminScreen';
import { CustomerDetailsScreen } from '../features/admin/screens/CustomerDetailsScreen';
import { EnquiryListScreen } from '../features/admin/screens/EnquiryListScreen';
import { EnquiryDetailsScreen } from '../features/admin/screens/EnquiryDetailsScreen';
import { SymptomsListScreen } from '../features/admin/screens/SymptomsListScreen';
import { AddSymptomScreen } from '../features/admin/screens/AddSymptomScreen';
import { EditSymptomScreen } from '../features/admin/screens/EditSymptomScreen';
import { NotificationListScreen } from '../features/admin/screens/NotificationListScreen';
import { AddNotificationScreen } from '../features/admin/screens/AddNotificationScreen';
import { EditNotificationScreen } from '../features/admin/screens/EditNotificationScreen';
import { AddAdviceScreen } from '../features/admin/screens/AddAdviceScreen';
import { SalesReportScreen } from '../features/admin/screens/SalesReportScreen';
import {
  ProductListScreen,
  ProductDetailsScreen,
  CartScreen,
  CheckoutScreen,
  AddProductScreen
} from '../features/products';
import {
  CropTrackingHomeScreen,
  CropCycleScreen,
  CropTrackingScreen,
  AddDailyRecordScreen,
  AddExpenseEntryScreen,
  ExpenseSummaryScreen,
  ExpenseBreakdownScreen,
  AddCropCycleScreen,
  ActivityDetailsScreen,
} from '../features/cropTracking';
import { ExpertAdviceScreen } from '../features/farmer/ExpertAdviceScreen';
import { ExpertAdviceListScreen } from '../features/admin/screens/ExpertAdviceListScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
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

const HeaderRight = ({ onLogout, navigation, showBell }: { onLogout: () => void; navigation: any; showBell?: boolean }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {showBell && (
      <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.logoutButton}>
        <Bell color={COLORS.primary} size={22} />
      </TouchableOpacity>
    )}
    <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.logoutButton}>
      <UserIcon color={COLORS.primary} size={22} />
    </TouchableOpacity>
    <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
      <LogOut color={COLORS.error} size={22} />
    </TouchableOpacity>
  </View>
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
      component={ProductListScreen} 
      initialParams={{ role: 'customer' }}
      options={{ tabBarIcon: ({ color }) => <ShoppingBag color={color} size={24} /> }}
    />
    <Tab.Screen 
      name="Weather" 
      component={RainUpdates} 
      options={{ tabBarIcon: ({ color }) => <CloudRain color={color} size={24} /> }}
    />
    <Tab.Screen 
      name="CartTab" 
      component={CartScreen} 
      options={{ title: 'Cart', tabBarIcon: ({ color }) => <ShoppingCart color={color} size={24} /> }}
    />
  </Tab.Navigator>
);

const getCommonOptions = (onLogout: () => void, navigation: any, showBell?: boolean) => ({
  headerRight: () => <HeaderRight onLogout={onLogout} navigation={navigation} showBell={showBell} />,
  headerShadowVisible: Boolean(false),
  headerStyle: { backgroundColor: COLORS.background },
  headerTitleAlign: 'center' as const,
});

const FarmerNavigator = ({ onLogout }: any) => (
  <FarmerStack.Navigator
    screenOptions={({ navigation }) => ({
      ...getCommonOptions(onLogout, navigation, true),
      headerShown: true,
      headerLeft: ({ canGoBack }) => canGoBack ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circularBackBtn}>
          <ArrowLeft size={22} color="#1A1A1A" />
        </TouchableOpacity>
      ) : null
    })}
  >
    <FarmerStack.Screen
      name="FarmerTabs"
      component={FarmerTabs}
      options={({ navigation, route }) => {
        const activeTab = getFocusedRouteNameFromRoute(route) ?? 'Home';
        const isHomeTab = activeTab === 'Home';
        return {
          headerTitle: () => <HeaderTitle />,
          headerLeft: isHomeTab ? undefined : () => (
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('FarmerTabs', { screen: 'Home' })}
              style={styles.circularBackBtn}
            >
              <ArrowLeft size={22} color="#1A1A1A" />
            </TouchableOpacity>
          ),
        };
      }}
    />
    <FarmerStack.Screen 
      name="FertilizerList" 
      component={ProductListScreen} 
      initialParams={{ role: 'customer' }}
      options={{ title: 'Agri Store' }} 
    />
    <FarmerStack.Screen name="ProductDetails" component={ProductDetailsScreen} options={{ title: 'Product Info' }} />
    <FarmerStack.Screen name="Cart" component={CartScreen} options={{ title: 'My Cart' }} />
    <FarmerStack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Confirm Order' }} />
    <FarmerStack.Screen name="RainUpdates" component={RainUpdates} options={{ title: 'Weather Forecast' }} />
    <FarmerStack.Screen name="Symptoms" component={SymptomsView} options={{ title: 'Crop Symptoms' }} />
    <FarmerStack.Screen name="AddLand" component={AddLandScreen} options={{ title: 'Add New Land' }} />
    <FarmerStack.Screen name="PurchaseHistory" component={PurchaseHistory} options={{ title: 'Purchase History' }} />
    <FarmerStack.Screen name="Enquiry" component={EnquiryScreen} options={{ title: 'Book Enquiry' }} />
    
    {/* Crop Tracking & Expense Management */}
    <FarmerStack.Screen name="CropTrackingHome" component={CropTrackingHomeScreen} options={{ title: 'My Farm Lands' }} />
    <FarmerStack.Screen name="CropCycle" component={CropCycleScreen} options={{ title: 'Crop Activity' }} />
    <FarmerStack.Screen name="CropTracking" component={CropTrackingScreen} options={{ title: 'Activity Timeline' }} />
    <FarmerStack.Screen name="ActivityDetails" component={ActivityDetailsScreen} options={{ title: 'Activity Details' }} />
    <FarmerStack.Screen name="AddDailyRecord" component={AddDailyRecordScreen} options={{ title: 'Add Entry' }} />
    <FarmerStack.Screen name="AddExpenseEntry" component={AddExpenseEntryScreen} options={{ title: 'Add Activity Record' }} />
    <FarmerStack.Screen name="ExpenseSummary" component={ExpenseSummaryScreen} options={{ title: 'Expense Analysis' }} />
    <FarmerStack.Screen name="ExpenseBreakdown" component={ExpenseBreakdownScreen} options={{ title: 'Breakdown' }} />
    <FarmerStack.Screen name="AddCropCycle" component={AddCropCycleScreen} options={{ title: 'New Cultivation' }} />
    <FarmerStack.Screen name="ExpertAdvice" component={ExpertAdviceScreen} options={{ title: 'Expert Advice' }} />
    <FarmerStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
    <FarmerStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
  </FarmerStack.Navigator>
);

const AdminNavigator = ({ onLogout, role }: any) => (
  <AdminStack.Navigator
    screenOptions={({ navigation }) => ({
      ...getCommonOptions(onLogout, navigation),
      headerShown: true,
      headerLeft: ({ canGoBack }) => canGoBack ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circularBackBtn}>
          <ArrowLeft size={22} color="#1A1A1A" />
        </TouchableOpacity>
      ) : null
    })}
  >
    <AdminStack.Screen
      name="AdminTabs"
      component={AdminTabNavigator}
      options={({ navigation, route }) => {
        const activeTab = getFocusedRouteNameFromRoute(route) ?? 'Dashboard';
        const isDashboardTab = activeTab === 'Dashboard';
        return {
          headerTitle: () => <HeaderTitle />,
          headerLeft: isDashboardTab ? undefined : () => (
            <TouchableOpacity
              onPress={() => (navigation as any).navigate('AdminTabs', { screen: 'Dashboard' })}
              style={styles.circularBackBtn}
            >
              <ArrowLeft size={22} color="#1A1A1A" />
            </TouchableOpacity>
          ),
        };
      }}
    />
    <AdminStack.Screen name="AddCustomer" component={CustomerListScreen} options={{ title: 'Customer List' }} />
    <AdminStack.Screen name="ManageStock" component={StockListScreen} options={{ title: 'Inventory Stock' }} />
    <AdminStack.Screen name="OrderDetails" component={OrderDetailsScreen} options={{ title: 'Order Info' }} />
    <AdminStack.Screen name="AddStock" component={AdminAddStockScreen} options={{ title: 'Add Inventory' }} />
    <AdminStack.Screen name="EditStock" component={EditStockScreen} options={{ title: 'Modify Inventory' }} />
    <AdminStack.Screen name="CreateCustomer" component={AdminAddCustomerScreen} options={{ title: 'Register Farmer' }} />
    <AdminStack.Screen name="AddAdmin" component={AddAdminScreen} options={{ title: 'Add Admin' }} />
    <AdminStack.Screen name="CustomerDetails" component={CustomerDetailsScreen} options={{ title: 'Profile' }} />
    <AdminStack.Screen name="ManagePrice" component={AdminActionPlaceholder} options={{ title: 'Update Price' }} />
    <AdminStack.Screen name="UpdateRain" component={RainUpdates} options={{ title: 'Update Weather Data' }} />
    <AdminStack.Screen name="EnquiryList" component={EnquiryListScreen} options={{ title: 'User Enquiries' }} />
    <AdminStack.Screen name="EnquiryDetails" component={EnquiryDetailsScreen} options={{ title: 'Enquiry Details' }} />
    <AdminStack.Screen name="SymptomsList" component={SymptomsListScreen} options={{ title: 'Symptom Records' }} />
    <AdminStack.Screen name="AddSymptom" component={AddSymptomScreen} options={{ title: 'Add Record' }} />
    <AdminStack.Screen name="EditSymptom" component={EditSymptomScreen} options={{ title: 'Edit Record' }} />
    <AdminStack.Screen name="NotificationList" component={NotificationListScreen} options={{ title: 'Notifications' }} />
    <AdminStack.Screen name="SalesReport" component={SalesReportScreen} options={{ title: 'Sales Report' }} />
    <AdminStack.Screen name="AddNotification" component={AddNotificationScreen} options={{ title: 'New Alert' }} />
    <AdminStack.Screen name="EditNotification" component={EditNotificationScreen} options={{ title: 'Edit Alert' }} />
    <AdminStack.Screen 
      name="FertilizerList" 
      component={ProductListScreen} 
      initialParams={{ role: (role || '').toLowerCase() }}
      options={{ title: 'Inventory' }} 
    />
    <AdminStack.Screen name="OrderList" component={AdminOrderListScreen} options={{ title: 'Customer Orders' }} />
    <AdminStack.Screen name="AddProduct" component={AddProductScreen} options={{ title: 'Add New Item' }} />
    <AdminStack.Screen name="ProductDetails" component={ProductDetailsScreen} options={{ title: 'Item Details' }} />
    <AdminStack.Screen name="Cart" component={CartScreen} options={{ title: 'Mock Cart' }} />
    <AdminStack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Confirm Order' }} />

    {/* Crop Tracking & Expense Management (read-only for admin, except Give Advice) */}
    <AdminStack.Screen name="CropCycle" component={CropCycleScreen} options={{ title: 'Crop Activity' }} />
    <AdminStack.Screen name="CropTracking" component={CropTrackingScreen} options={{ title: 'Activity Timeline' }} />
    <AdminStack.Screen name="ActivityDetails" component={ActivityDetailsScreen} options={{ title: 'Activity Details' }} />
    <AdminStack.Screen name="AddExpenseEntry" component={AddExpenseEntryScreen} options={{ title: 'Add Activity Record' }} />
    <AdminStack.Screen name="ExpenseSummary" component={ExpenseSummaryScreen} options={{ title: 'Expense Analysis' }} />
    <AdminStack.Screen name="ExpenseBreakdown" component={ExpenseBreakdownScreen} options={{ title: 'Breakdown' }} />
    <AdminStack.Screen name="AddCropCycle" component={AddCropCycleScreen} options={{ title: 'New Cultivation' }} />
    <AdminStack.Screen name="AddAdvice" component={AddAdviceScreen} options={{ title: 'Give Advice' }} />
    <AdminStack.Screen name="ExpertAdviceList" component={ExpertAdviceListScreen} options={{ title: 'Expert Advice Requests' }} />
    <AdminStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
  </AdminStack.Navigator>
);

export const RootNavigator = ({ role, onLogout }: { role: UserRole, onLogout: () => void }) => {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: Boolean(false) }}>
      {role === 'ADMIN' || role === 'SUPER_ADMIN' ? (
        <MainStack.Screen name="AdminRoot">
             {props => <AdminNavigator {...props} onLogout={onLogout} role={role} />}
        </MainStack.Screen>
      ) : (
        <MainStack.Screen name="FarmerRoot">
             {props => <FarmerNavigator {...props} onLogout={onLogout} />}
        </MainStack.Screen>
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
  circularBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.sm,
  },
});
