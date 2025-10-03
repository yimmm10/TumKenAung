// navigation/IngredientStackNavigator.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import IngredientManagementScreen from '../screens/Admin/Ingredient';
import AddIngredientScreen        from '../screens/Admin/AddIngredient';

const Stack = createNativeStackNavigator();

export default function IngredientStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="IngredientList"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        name="IngredientList"
        component={IngredientManagementScreen}
        options={{ title: 'จัดการวัตถุดิบ' }}
      />
      <Stack.Screen
        name="AddIngredient"
        component={AddIngredientScreen}
        options={({ route }) => ({
          title: route.params?.item ? 'แก้ไขวัตถุดิบ' : 'เพิ่มวัตถุดิบ'
        })}
      />
    </Stack.Navigator>
  );
}
