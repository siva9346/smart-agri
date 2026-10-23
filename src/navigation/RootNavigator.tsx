import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { LogOut, Home, FileText, CloudRain, Stethoscope, User as UserIcon, ArrowLeft, Bell, Menu } from 'lucide-react-native';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen';
import { useUnreadNotifications } from '../features/notifications/useUnreadNotifications';
import { CustomDrawer, useDrawer } from './CustomDrawer';
import { AppDrawerContent } from './AppDrawerContent';
import { updateUser } from '../store/authSlice';
import { profileApi } from '../services/platform';
import { registerForPush, listenForPushTaps } from '../services/push';
import { ConsultationRequestScreen } from '../features/consultations/ConsultationRequestScreen';
import { ConsultationListScreen } from '../features/consultations/ConsultationListScreen';
import { ConsultationDetailScreen } from '../features/consultations/ConsultationDetailScreen';
import { CrmDashboardScreen } from '../features/crm/CrmDashboardScreen';
import { LeadListScreen } from '../features/crm/LeadListScreen';
import { LeadFormScreen } from '../features/crm/LeadFormScreen';
import { LeadDetailScreen } from '../features/crm/LeadDetailScreen';
import { PipelineScreen } from '../features/crm/PipelineScreen';
import { CrmReportsScreen } from '../features/crm/CrmReportsScreen';
import { CustomerProfileScreen } from '../features/crm/CustomerProfileScreen';
import { ActivityFeedScreen } from '../features/crm/ActivityFeedScreen';
import { QuotationBuilderScreen } from '../features/quotations/QuotationBuilderScreen';
import { QuotationListScreen } from '../features/quotations/QuotationListScreen';
import { QuotationDetailScreen } from '../features/quotations/QuotationDetailScreen';
import { TaskListScreen } from '../features/tasks/TaskListScreen';
import { TaskFormScreen } from '../features/tasks/TaskFormScreen';
import { CalendarScreen } from '../features/tasks/CalendarScreen';
import { DailyReportScreen } from '../features/crm/DailyReportScreen';
import { PerformanceScreen } from '../features/crm/PerformanceScreen';
import { TargetsScreen } from '../features/crm/TargetsScreen';
import { AiAssistantScreen } from '../features/ai/AiAssistantScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { PreferencesScreen } from '../features/settings/PreferencesScreen';
import { UserManagementScreen } from '../features/admin/team/UserManagementScreen';
import { UserFormScreen } from '../features/admin/team/UserFormScreen';
import { ExpertCoverageScreen } from '../features/admin/team/ExpertCoverageScreen';
import { AssignmentRulesScreen } from '../features/admin/settings/AssignmentRulesScreen';
import { AutomationRulesScreen } from '../features/admin/settings/AutomationRulesScreen';
import { QuotationSettingsScreen } from '../features/admin/settings/QuotationSettingsScreen';
import { RolePermissionsScreen } from '../features/admin/settings/RolePermissionsScreen';
import { AiConfigScreen } from '../features/admin/settings/AiConfigScreen';
import { WhatsAppConfigScreen } from '../features/admin/settings/WhatsAppConfigScreen';
import { AuditLogScreen } from '../features/admin/settings/AuditLogScreen';
import { AnnouncementsScreen } from '../features/admin/announcements/AnnouncementsScreen';
import { AnnouncementComposerScreen } from '../features/admin/announcements/AnnouncementComposerScreen';
import { WorkDashboardScreen } from '../features/dashboard/WorkDashboardScreen';
import { AdminOverviewScreen } from '../features/dashboard/AdminOverviewScreen';
import { RootState } from '../store';
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
import { AlertsListScreen } from '../features/admin/screens/AlertsListScreen';
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
const WorkStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

const MenuButton = () => {
  const { openDrawer } = useDrawer();
  return (
    <TouchableOpacity
      onPress={openDrawer}
      style={styles.circularBackBtn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Menu size={20} color="#1A1A1A" />
    </TouchableOpacity>
  );
};

const HeaderTitle = () => (
  <View style={styles.headerTitleContainer}>
    <Image 
      source={require('../../assets/logo.png')} 
      style={styles.headerLogo}
      resizeMode="contain"
    />
    <Text style={styles.headerTitleText}>Smart Agri</Text>
  </View>
);

const HeaderRight = ({ onLogout, navigation, showBell }: { onLogout: () => void; navigation: any; showBell?: boolean }) => {
  const unread = useSelector((s: RootState) => s.notification.unreadCount);
  return (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {showBell && (
      <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.logoutButton}>
        <Bell color={COLORS.primary} size={22} />
        {unread > 0 && (
          <View style={styles.unreadBadge} accessibilityLabel={`${unread} unread notifications`}>
            <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </TouchableOpacity>
    )}
    <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.logoutButton} accessibilityLabel="Settings">
      <UserIcon color={COLORS.primary} size={22} />
    </TouchableOpacity>
    <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
      <LogOut color={COLORS.error} size={22} />
    </TouchableOpacity>
  </View>
  );
};

/**
 * Screens available to every role's stack (customer-facing consultation / quotation /
 * AI / settings screens). Internal-only screens are added with `internal`.
 * Visibility is UI convenience; the backend enforces every permission.
 */
const sharedScreens = (S: any, internal: boolean) => (
  <>
    <S.Screen name="ConsultationRequest" component={ConsultationRequestScreen} options={{ title: 'Get Suggestions from Experts' }} />
    <S.Screen name="ConsultationList" component={ConsultationListScreen} options={{ title: internal ? 'Consultations' : 'My Consultations' }} />
    <S.Screen name="ConsultationDetail" component={ConsultationDetailScreen} options={{ title: 'Consultation' }} />
    <S.Screen name="QuotationList" component={QuotationListScreen} options={{ title: internal ? 'Quotations' : 'My Quotations' }} />
    <S.Screen name="QuotationDetail" component={QuotationDetailScreen} options={{ title: 'Quotation' }} />
    <S.Screen name="AiAssistant" component={AiAssistantScreen} options={{ title: internal ? 'AI Assistant' : 'AI Farming Assistant' }} />
    <S.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    <S.Screen name="Preferences" component={PreferencesScreen} options={{ title: 'Preferences' }} />
    {internal && (
      <>
        <S.Screen name="CrmDashboard" component={CrmDashboardScreen} options={{ title: 'CRM' }} />
        <S.Screen name="LeadList" component={LeadListScreen} options={{ title: 'Leads' }} />
        <S.Screen name="LeadForm" component={LeadFormScreen} options={{ title: 'New Lead' }} />
        <S.Screen name="LeadDetail" component={LeadDetailScreen} options={{ title: 'Lead' }} />
        <S.Screen name="Pipeline" component={PipelineScreen} options={{ title: 'Pipeline' }} />
        <S.Screen name="CrmReports" component={CrmReportsScreen} options={{ title: 'CRM Reports' }} />
        <S.Screen name="ActivityFeed" component={ActivityFeedScreen} options={{ title: 'Activities' }} />
        <S.Screen name="CustomerProfile" component={CustomerProfileScreen} options={{ title: 'Customer' }} />
        <S.Screen name="QuotationBuilder" component={QuotationBuilderScreen} options={{ title: 'Quotation' }} />
        <S.Screen name="TaskList" component={TaskListScreen} options={{ title: 'Tasks & Calendar' }} />
        <S.Screen name="TaskForm" component={TaskFormScreen} options={{ title: 'Task' }} />
        <S.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
        <S.Screen name="DailyReport" component={DailyReportScreen} options={{ title: 'Daily Report' }} />
        <S.Screen name="Performance" component={PerformanceScreen} options={{ title: 'Team Performance' }} />
        <S.Screen name="Targets" component={TargetsScreen} options={{ title: 'Sales Targets' }} />
        <S.Screen name="UserManagement" component={UserManagementScreen} options={{ title: 'User Management' }} />
        <S.Screen name="UserForm" component={UserFormScreen} options={{ title: 'Team Member' }} />
        <S.Screen name="ExpertCoverage" component={ExpertCoverageScreen} options={{ title: 'Experts & Coverage' }} />
        <S.Screen name="AssignmentRules" component={AssignmentRulesScreen} options={{ title: 'Assignment Rules' }} />
        <S.Screen name="AutomationRules" component={AutomationRulesScreen} options={{ title: 'Automation Rules' }} />
        <S.Screen name="QuotationSettings" component={QuotationSettingsScreen} options={{ title: 'Quotation Settings' }} />
        <S.Screen name="RolePermissions" component={RolePermissionsScreen} options={{ title: 'Roles & Permissions' }} />
        <S.Screen name="AiConfig" component={AiConfigScreen} options={{ title: 'AI Configuration' }} />
        <S.Screen name="WhatsAppConfig" component={WhatsAppConfigScreen} options={{ title: 'WhatsApp Business' }} />
        <S.Screen name="AuditLog" component={AuditLogScreen} options={{ title: 'Audit Logs' }} />
        <S.Screen name="Announcements" component={AnnouncementsScreen} options={{ title: 'Announcements' }} />
        <S.Screen name="AnnouncementComposer" component={AnnouncementComposerScreen} options={{ title: 'New Announcement' }} />
        <S.Screen name="AdminOverview" component={AdminOverviewScreen} options={{ title: 'Platform Overview' }} />
      </>
    )}
  </>
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
    {/* No product catalogue for customers — products reach them only through quotations. */}
    <Tab.Screen
      name="QuotationsTab"
      component={QuotationListScreen}
      options={{ title: 'My Quotations', tabBarIcon: ({ color }) => <FileText color={color} size={24} /> }}
    />
    <Tab.Screen
      name="ExpertsTab"
      component={ConsultationListScreen}
      options={{ title: 'Experts', tabBarIcon: ({ color }) => <Stethoscope color={color} size={24} /> }}
    />
    <Tab.Screen 
      name="Weather" 
      component={RainUpdates} 
      options={{ tabBarIcon: ({ color }) => <CloudRain color={color} size={24} /> }}
    />
  </Tab.Navigator>
);

const getCommonOptions = (onLogout: () => void, navigation: any, showBell?: boolean) => ({
  headerRight: () => <HeaderRight onLogout={onLogout} navigation={navigation} showBell={showBell} />,
  headerShadowVisible: Boolean(false),
  headerStyle: { backgroundColor: COLORS.background },
  headerTitleAlign: 'center' as const,
});

const FarmerNavigator = ({ onLogout }: any) => {
  useUnreadNotifications(true);
  return (
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
          headerLeft: isHomeTab ? () => <MenuButton /> : () => (
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
    {/* Catalogue screens (FertilizerList, ProductDetails, Cart, Checkout) are intentionally not registered for customers. */}
    <FarmerStack.Screen name="RainUpdates" component={RainUpdates} options={{ headerShown: false }} />
    <FarmerStack.Screen name="Symptoms" component={SymptomsView} options={{ title: 'Crop Symptoms' }} />
    <FarmerStack.Screen name="AddLand" component={AddLandScreen} options={{ headerShown: false }} />
    <FarmerStack.Screen name="PurchaseHistory" component={PurchaseHistory} options={{ title: 'Purchase History' }} />
    <FarmerStack.Screen name="Enquiry" component={EnquiryScreen} options={{ title: 'Book Enquiry' }} />
    
    {/* Crop Tracking & Expense Management */}
    <FarmerStack.Screen name="CropTrackingHome" component={CropTrackingHomeScreen} options={{ headerShown: false }} />
    <FarmerStack.Screen name="CropCycle" component={CropCycleScreen} options={{ headerShown: false }} />
    <FarmerStack.Screen name="CropTracking" component={CropTrackingScreen} options={{ headerShown: false }} />
    <FarmerStack.Screen name="ActivityDetails" component={ActivityDetailsScreen} options={{ headerShown: false }} />
    <FarmerStack.Screen name="AddDailyRecord" component={AddDailyRecordScreen} options={{ title: 'Add Entry' }} />
    <FarmerStack.Screen name="AddExpenseEntry" component={AddExpenseEntryScreen} options={{ headerShown: false }} />
    <FarmerStack.Screen name="ExpenseSummary" component={ExpenseSummaryScreen} options={{ headerShown: false }} />
    <FarmerStack.Screen name="ExpenseBreakdown" component={ExpenseBreakdownScreen} options={{ headerShown: false }} />
    <FarmerStack.Screen name="AddCropCycle" component={AddCropCycleScreen} options={{ headerShown: false }} />
    <FarmerStack.Screen name="ExpertAdvice" component={ExpertAdviceScreen} options={{ title: 'Expert Advice' }} />
    <FarmerStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
    <FarmerStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    {sharedScreens(FarmerStack, false)}
  </FarmerStack.Navigator>
  );
};

const AdminNavigator = ({ onLogout, role }: any) => {
  useUnreadNotifications(true);
  return (
  <AdminStack.Navigator
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
    <AdminStack.Screen
      name="AdminTabs"
      component={AdminTabNavigator}
      options={({ navigation, route }) => {
        const activeTab = getFocusedRouteNameFromRoute(route) ?? 'Dashboard';
        const isDashboardTab = activeTab === 'Dashboard';
        return {
          headerTitle: () => <HeaderTitle />,
          headerLeft: isDashboardTab ? () => <MenuButton /> : () => (
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
    <AdminStack.Screen name="UpdateRain" component={RainUpdates} options={{ headerShown: false }} />
    <AdminStack.Screen name="EnquiryList" component={EnquiryListScreen} options={{ title: 'User Enquiries' }} />
    <AdminStack.Screen name="EnquiryDetails" component={EnquiryDetailsScreen} options={{ title: 'Enquiry Details' }} />
    <AdminStack.Screen name="SymptomsList" component={SymptomsListScreen} options={{ title: 'Symptom Records' }} />
    <AdminStack.Screen name="AlertsList" component={AlertsListScreen} options={{ title: 'Symptom Alerts' }} />
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
      options={{ headerShown: false }}
    />
    <AdminStack.Screen name="OrderList" component={AdminOrderListScreen} options={{ title: 'Customer Orders' }} />
    <AdminStack.Screen name="AddProduct" component={AddProductScreen} options={{ title: 'Add New Item' }} />
    <AdminStack.Screen name="ProductDetails" component={ProductDetailsScreen} options={{ title: 'Item Details' }} />
    <AdminStack.Screen name="Cart" component={CartScreen} options={{ title: 'Mock Cart' }} />
    <AdminStack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Confirm Order' }} />

    {/* Crop Tracking & Expense Management (read-only for admin, except Give Advice) */}
    <AdminStack.Screen name="CropCycle" component={CropCycleScreen} options={{ headerShown: false }} />
    <AdminStack.Screen name="CropTracking" component={CropTrackingScreen} options={{ headerShown: false }} />
    <AdminStack.Screen name="ActivityDetails" component={ActivityDetailsScreen} options={{ headerShown: false }} />
    <AdminStack.Screen name="AddExpenseEntry" component={AddExpenseEntryScreen} options={{ headerShown: false }} />
    <AdminStack.Screen name="ExpenseSummary" component={ExpenseSummaryScreen} options={{ headerShown: false }} />
    <AdminStack.Screen name="ExpenseBreakdown" component={ExpenseBreakdownScreen} options={{ headerShown: false }} />
    <AdminStack.Screen name="AddCropCycle" component={AddCropCycleScreen} options={{ headerShown: false }} />
    <AdminStack.Screen name="AddAdvice" component={AddAdviceScreen} options={{ title: 'Give Advice' }} />
    <AdminStack.Screen name="ExpertAdviceList" component={ExpertAdviceListScreen} options={{ title: 'Expert Advice Requests' }} />
    <AdminStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
    <AdminStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    {sharedScreens(AdminStack, true)}
  </AdminStack.Navigator>
  );
};

/** STAFF and EXPERT: work dashboard + CRM / consultation screens. */
const WorkNavigator = ({ onLogout, role }: any) => {
  useUnreadNotifications(true);
  return (
    <WorkStack.Navigator
      screenOptions={({ navigation }) => ({
        ...getCommonOptions(onLogout, navigation, true),
        headerShown: true,
        headerLeft: ({ canGoBack }) => canGoBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circularBackBtn}>
            <ArrowLeft size={22} color="#1A1A1A" />
          </TouchableOpacity>
        ) : null,
      })}
    >
      <WorkStack.Screen name="WorkHome" component={WorkDashboardScreen}
                        options={{ headerTitle: () => <HeaderTitle />, headerLeft: () => <MenuButton /> }} />
      <WorkStack.Screen name="FertilizerList" component={ProductListScreen} initialParams={{ role: 'viewer' }} options={{ headerShown: false }} />
      <WorkStack.Screen name="ProductDetails" component={ProductDetailsScreen} options={{ title: 'Product Info' }} />
      <WorkStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <WorkStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      {sharedScreens(WorkStack, true)}
    </WorkStack.Navigator>
  );
};

export const RootNavigator = ({ role, onLogout }: { role: UserRole, onLogout: () => void }) => {
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isWork = role === 'STAFF' || role === 'EXPERT';
  const dispatch = useDispatch();

  // Pick up permission changes made by a Super Admin since this session's login.
  useEffect(() => {
    profileApi.get()
      .then(p => dispatch(updateUser({ permissions: p.permissions, name: p.name })))
      .catch(() => {});
    registerForPush();
  }, [dispatch]);

  // Tapping a push notification opens the linked consultation / lead / quotation.
  useEffect(() => listenForPushTaps(role), [role]);

  return (
    <CustomDrawer renderContent={(close) => <AppDrawerContent onClose={close} />}>
      <MainStack.Navigator screenOptions={{ headerShown: Boolean(false) }}>
        {isAdmin ? (
          <MainStack.Screen name="AdminRoot">
               {props => <AdminNavigator {...props} onLogout={onLogout} role={role} />}
          </MainStack.Screen>
        ) : isWork ? (
          <MainStack.Screen name="WorkRoot">
               {props => <WorkNavigator {...props} onLogout={onLogout} role={role} />}
          </MainStack.Screen>
        ) : (
          <MainStack.Screen name="FarmerRoot">
               {props => <FarmerNavigator {...props} onLogout={onLogout} />}
          </MainStack.Screen>
        )}
      </MainStack.Navigator>
    </CustomDrawer>
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
  unreadBadge: {
    position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.background,
  },
  unreadBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  unreadDot: {
    position: 'absolute', top: 6, right: 6,
    width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: COLORS.error, borderWidth: 1.5, borderColor: COLORS.background,
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
