import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import OrdersScreen from '../screens/OrdersScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';

/**
 * Без React Navigation: в Expo Go на Android у стека/native-stack часто падает
 * `String cannot be cast to Boolean` внутри нативного слоя. Переключение экранов — через state.
 */
export default function RootNavigator() {
  const { token, ready } = useAuth();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (token == null) {
      setOpenOrderId(null);
    }
  }, [token]);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#1a5fb4" />
      </View>
    );
  }

  if (token == null) {
    return <LoginScreen />;
  }

  if (openOrderId != null) {
    return <OrderDetailScreen orderId={openOrderId} onGoBack={() => setOpenOrderId(null)} />;
  }

  return <OrdersScreen onSelectOrder={(id) => setOpenOrderId(id)} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef1f5',
  },
});
