import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';
import LoginScreen from '../screens/LoginScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';

/** JS Stack вместо native-stack — в Expo Go на Android у native-stack часто падает `String cannot be cast to Boolean`. */
const Stack = createStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#eef1f5',
  },
};

export default function RootNavigator() {
  const { token, ready } = useAuth();

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#1a5fb4" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          cardStyle: { backgroundColor: '#eef1f5' },
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#1a2b45',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        {token == null ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Orders" component={OrdersScreen} options={{ headerShown: false }} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Заказ' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef1f5',
  },
});
