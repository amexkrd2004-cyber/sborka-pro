import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ackAllEscalations, ApiError, fetchOrders } from '../api/client';
import type { OrderSummary } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../lib/formatMoney';

type Props = {
  onSelectOrder: (id: string) => void;
};

export default function OrdersScreen({ onSelectOrder }: Props) {
  const { token, logout } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ackBusy, setAckBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    setMessage(null);
    const maxAttempts = 3;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const data = await fetchOrders(token);
        setOrders(data.orders ?? []);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        }
      }
    }
    if (lastErr != null) {
      const msg =
        lastErr instanceof ApiError ? lastErr.message : 'Не удалось загрузить заказы';
      setError(msg);
      setOrders([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    let appState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.match(/inactive|background/) && next === 'active' && token) {
        load();
      }
      appState = next;
    });
    return () => sub.remove();
  }, [token, load]);

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  async function onAckAllSignals() {
    if (!token) return;
    setAckBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await ackAllEscalations(token);
      setMessage(
        res.stoppedCount > 0
          ? `Сигнал подтверждён: остановлено тревог ${res.stoppedCount}.`
          : 'Активных тревог сейчас нет.'
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось отключить тревоги';
      setError(msg);
    } finally {
      setAckBusy(false);
    }
  }

  function renderItem({ item }: { item: OrderSummary }) {
    return (
      <Pressable style={styles.row} onPress={() => onSelectOrder(item.id)}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        {item.stateName ? <Text style={styles.rowMeta}>{item.stateName}</Text> : null}
        {item.sum != null ? <Text style={styles.rowMeta}>{formatRubles(item.sum)} ₽</Text> : null}
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
      {message ? <Text style={styles.infoBanner}>{message}</Text> : null}
      <View style={styles.actions}>
        <Pressable
          style={[styles.alarmAckBtn, ackBusy && styles.btnDisabled]}
          onPress={onAckAllSignals}
          disabled={ackBusy}
        >
          {ackBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.alarmAckBtnText}>Подтвердить сигнал</Text>
          )}
        </Pressable>
      </View>

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
  infoBanner: {
    marginHorizontal: 12,
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e4f5e6',
    color: '#1a6b2e',
    borderRadius: 8,
    overflow: 'hidden',
  },
  actions: {
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  alarmAckBtn: {
    backgroundColor: '#7a4f00',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  alarmAckBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.65 },
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
