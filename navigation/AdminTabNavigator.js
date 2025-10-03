// navigation/AdminTabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AdminDashboardScreen    from '../screens/Admin/Dashboard';
import AdminRecipeStack        from './AdminRecipeStack';
import VendorManagementScreen  from '../screens/Admin/VendorManage';
import IngredientStackNavigator  from './IngredientStackNavigator';

const Tab = createBottomTabNavigator();

export default function AdminTabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#425010',
        tabBarInactiveTintColor: '#F7F0CE',
        tabBarLabelStyle: { fontSize: 12 },
        tabBarStyle: {
          backgroundColor: '#FFA920',
          height:         60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop:    5,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Dashboard':iconName = 'grid-outline'; break;
            case 'Recipes':iconName = 'reader-outline'; break;
            case 'Vendors':iconName = 'business-outline'; break;
            case 'Ingredients':iconName='nutrition-outline'; break;
            default:
              iconName = 'ellipse-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{ tabBarLabel: 'แดชบอร์ด' }}
      />
      <Tab.Screen
        name="Recipes"
        component={AdminRecipeStack}
        options={{ tabBarLabel: 'สูตรอาหาร' }}
      />
      <Tab.Screen
        name="Vendors"
        component={VendorManagementScreen}
        options={{ tabBarLabel: 'ร้านค้า' }}
      />
      <Tab.Screen
        name="Ingredients"
        component={IngredientStackNavigator}
        options={{ tabBarLabel:'วัตถุดิบ' }}
      />
    </Tab.Navigator>
  );
}
