// navigation/VendorTabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import VendorHomeScreen      from '../screens/Vendor/VendorHomeScreen';
import OrdersScreen          from '../screens/Vendor/OrdersScreen';
import StockManagementScreen from '../screens/Vendor/StockManagementScreen';
import ReviewsScreen         from '../screens/Vendor/ReviewsScreen';
import VendorProfileScreen   from '../screens/Vendor/VendorProfileScreen';

const Tab = createBottomTabNavigator();

export default function VendorTabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      initialRouteName="VendorHome"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#0066CC',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: { fontSize: 12 },
        tabBarStyle: { height: 60 + insets.bottom, paddingBottom: insets.bottom },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            VendorHome:      'home-outline',
            Orders:          'clipboard-outline',
            Stock:           'cube-outline',
            Reviews:         'star-outline',
            VendorProfile:   'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="VendorHome"
        component={VendorHomeScreen}
        options={{ tabBarLabel: 'หน้าร้าน' }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{ tabBarLabel: 'ออร์เดอร์' }}
      />
      <Tab.Screen
        name="Stock"
        component={StockManagementScreen}
        options={{ tabBarLabel: 'สต็อก' }}
      />
      <Tab.Screen
        name="Reviews"
        component={ReviewsScreen}
        options={{ tabBarLabel: 'รีวิว' }}
      />
      <Tab.Screen
        name="VendorProfile"
        component={VendorProfileScreen}
        options={{ tabBarLabel: 'โปรไฟล์' }}
      />
    </Tab.Navigator>
  );
}
