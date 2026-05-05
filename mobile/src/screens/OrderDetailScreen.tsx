import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, claimOrder, fetchOrder, patchOrderStatus } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatRubles } from '../lib/formatMoney';

type Props = {
  orderId: string;
  onGoBack: () => void;
};

function pickString(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return typeof v === 'string' ? v : undefined;
}

function pickNumber(o: Record<string, unknown>, key: string): number | undefined {
  const v = o[key];
  return typeof v === 'number' ? v : undefined;
}

export default function OrderDetailScreen({ orderId: id, onGoBack }: Props) {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimBusy, setClaimBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
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
        try {
          const patched = await patchOrderStatus(token, id, 'Сборка (в работе)');
          setOrder((patched.order as Record<string, unknown>) ?? order);
        } catch (_) {
          // Статус может быть уже не «Сборка» — оставляем мягкую деградацию.
        }
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

  async function onChangeStatus(targetStatus: string) {
    if (!token) return;
    setStatusBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await patchOrderStatus(token, id, targetStatus);
      setOrder((res.order as Record<string, unknown>) ?? order);
      setMessage(`Статус обновлён: ${res.targetStatus}`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Ошибка смены статуса';
      setError(msg);
    } finally {
      setStatusBusy(false);
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
        <Pressable style={styles.secondaryBtn} onPress={onGoBack}>
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
  const canClaim = stateName === 'Сборка' || stateName == null;
  const customFields = (order.customFields as Record<string, unknown> | undefined) || undefined;
  const deliveryType = customFields && typeof customFields.deliveryType === 'string' ? customFields.deliveryType : null;
  const pickerNote = customFields && typeof customFields.pickerNote === 'string' ? customFields.pickerNote : null;
  const shipmentNumber =
    customFields && typeof customFields.shipmentNumber === 'string' ? customFields.shipmentNumber : null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) + 4 }]}>
        <Pressable onPress={onGoBack} hitSlop={12} style={styles.backPress}>
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{name ?? 'Заказ'}</Text>
        {moment ? <Text style={styles.meta}>{moment}</Text> : null}
        {sum != null ? <Text style={styles.meta}>Сумма: {formatRubles(sum)} ₽</Text> : null}
        {stateName ? <Text style={styles.meta}>Статус: {stateName}</Text> : null}
        {deliveryType ? <Text style={styles.meta}>Тип доставки: {deliveryType}</Text> : null}
        {shipmentNumber ? <Text style={styles.meta}>Номер отправления: {shipmentNumber}</Text> : null}
        {pickerNote ? <Text style={styles.note}>Примечание: {pickerNote}</Text> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.info}>{message}</Text> : null}

        {canClaim ? (
          <Pressable
            style={[styles.primaryBtn, (claimBusy || statusBusy) && styles.btnDisabled]}
            onPress={onClaim}
            disabled={claimBusy || statusBusy}
          >
            {claimBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Взять в работу</Text>
            )}
          </Pressable>
        ) : null}

        <View style={styles.statusGroup}>
          <Text style={styles.statusTitle}>Смена статуса</Text>
          <View style={styles.statusRow}>
            <Pressable
              style={[styles.secondaryActionBtn, statusBusy && styles.btnDisabled]}
              onPress={() => onChangeStatus('Собран')}
              disabled={statusBusy || claimBusy}
            >
              <Text style={styles.secondaryActionBtnText}>Собран</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryActionBtn, statusBusy && styles.btnDisabled]}
              onPress={() => onChangeStatus('Отгружен')}
              disabled={statusBusy || claimBusy}
            >
              <Text style={styles.secondaryActionBtnText}>Отгружен</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.warnBtn, statusBusy && styles.btnDisabled]}
            onPress={() => onChangeStatus('Проблема со сборкой')}
            disabled={statusBusy || claimBusy}
          >
            {statusBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.warnBtnText}>Проблема со сборкой</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#eef1f5' },
  topBar: {
    paddingBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c5d0dc',
  },
  backPress: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
  backText: { fontSize: 16, color: '#1a5fb4', fontWeight: '600' },
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
  note: {
    marginTop: 12,
    fontSize: 14,
    color: '#1f334d',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
  },
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
  statusGroup: { marginTop: 24 },
  statusTitle: { fontSize: 15, fontWeight: '700', color: '#1a2b45', marginBottom: 10 },
  statusRow: { flexDirection: 'row', gap: 10 },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: '#2e7ecb',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  warnBtn: {
    marginTop: 10,
    backgroundColor: '#a82a2a',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  warnBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  errText: { color: '#5a6b7d', textAlign: 'center', marginBottom: 16 },
});
