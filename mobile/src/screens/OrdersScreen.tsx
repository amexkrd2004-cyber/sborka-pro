import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { ApiError, fetchOrders } from '../api/client';
import type { OrderSummary } from '../api/types';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';

type Props = StackScreenProps<RootStackParamList, 'Orders'>;

export default function OrdersScreen({ navigation }: Props) {
  const { token, logout } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchOrders(token);
      setOrders(data.orders ?? []);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось загрузить заказы';
      setError(msg);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  function renderItem({ item }: { item: OrderSummary }) {
    return (
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('OrderDetail', { id: item.id })}
      >
        <Text style={styles.rowTitle}>{item.name}</Text>
        {item.stateName ? <Text style={styles.rowMeta}>{item.stateName}</Text> : null}
        {item.sum != null ? <Text style={styles.rowMeta}>{item.sum} ₽</Text> : null}
      </Pressable>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a5fb4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Заказы в сборке</Text>
        <Pressable onPress={() => logout()} hitSlop={12}>
          <Text style={styles.logout}>Выйти</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.banner}>{error}</Text> : null}

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Нет заказов в текущем статусе на сервере.</Text>
        }
        contentContainerStyle={orders.length === 0 ? styles.emptyList : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef1f5' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#eef1f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c5d0dc',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a2b45' },
  logout: { fontSize: 15, color: '#1a5fb4', fontWeight: '600' },
  banner: {
    margin: 12,
    padding: 12,
    backgroundColor: '#ffe5e5',
    color: '#8a1538',
    borderRadius: 8,
    overflow: 'hidden',
  },
  row: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    padding: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#dce3ea',
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#1a2b45' },
  rowMeta: { marginTop: 4, fontSize: 14, color: '#5a6b7d' },
  empty: { textAlign: 'center', color: '#5a6b7d', padding: 24, fontSize: 15 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
});
