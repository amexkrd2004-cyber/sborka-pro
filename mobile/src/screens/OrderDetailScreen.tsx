import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StackScreenProps } from '@react-navigation/stack';
import { ApiError, claimOrder, fetchOrder } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';

type Props = StackScreenProps<RootStackParamList, 'OrderDetail'>;

function pickString(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return typeof v === 'string' ? v : undefined;
}

function pickNumber(o: Record<string, unknown>, key: string): number | undefined {
  const v = o[key];
  return typeof v === 'number' ? v : undefined;
}

export default function OrderDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { token } = useAuth();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimBusy, setClaimBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      const data = await fetchOrder(token, id);
      setOrder((data.order as Record<string, unknown>) ?? null);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Не удалось загрузить заказ';
      setError(msg);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  React.useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function onClaim() {
    if (!token) return;
    setClaimBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await claimOrder(token, id);
      if ('claimed' in res && res.claimed) {
        setMessage(res.already ? 'Заказ уже у вас в работе.' : 'Заказ закреплён за вами.');
      } else if ('takenBy' in res && res.takenBy) {
        setMessage(`Уже взял: ${res.takenBy.login}`);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Ошибка захвата';
      setError(msg);
    } finally {
      setClaimBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a5fb4" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errText}>{error ?? 'Заказ не найден'}</Text>
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>Назад</Text>
        </Pressable>
      </View>
    );
  }

  const name = pickString(order, 'name');
  const moment = pickString(order, 'moment');
  const sum = pickNumber(order, 'sum');
  const state = order.state as Record<string, unknown> | undefined;
  const stateName =
    state && typeof state.name === 'string' ? state.name : pickString(order, 'stateName');

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{name ?? 'Заказ'}</Text>
      {moment ? <Text style={styles.meta}>{moment}</Text> : null}
      {sum != null ? <Text style={styles.meta}>Сумма: {sum} ₽</Text> : null}
      {stateName ? <Text style={styles.meta}>Статус: {stateName}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.info}>{message}</Text> : null}

      <Pressable
        style={[styles.primaryBtn, claimBusy && styles.btnDisabled]}
        onPress={onClaim}
        disabled={claimBusy}
      >
        {claimBusy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Взять в работу</Text>
        )}
      </Pressable>

      <Text style={styles.hint}>
        Смена статусов в МойСклад из приложения будет после согласования названий статусов и
        доработки API на сервере.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#eef1f5' },
  content: { padding: 16, paddingBottom: 32 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#eef1f5',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1a2b45' },
  meta: { marginTop: 8, fontSize: 15, color: '#5a6b7d' },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: '#1a5fb4',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryBtnText: { color: '#1a5fb4', fontSize: 16, fontWeight: '600' },
  error: { marginTop: 12, color: '#c01c28', fontSize: 14 },
  info: { marginTop: 12, color: '#1a6b2e', fontSize: 14 },
  errText: { color: '#5a6b7d', textAlign: 'center', marginBottom: 16 },
  hint: {
    marginTop: 24,
    fontSize: 13,
    color: '#6a7d90',
    lineHeight: 18,
  },
});
