import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../api/client';
import { getApiBase } from '../config';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [userLogin, setUserLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiMissing = !getApiBase();

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await login(userLogin.trim(), password);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Ошибка входа';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>СборкаПро</Text>
        <Text style={styles.subtitle}>Вход кладовщика</Text>

        {apiMissing ? (
          <Text style={styles.warn}>
            В корне `mobile` создайте файл `.env` с строкой{'\n'}
            EXPO_PUBLIC_API_URL=https://ваш-сервер.up.railway.app{'\n'}
            и перезапустите Expo (`npx expo start -c`).
          </Text>
        ) : null}

        <Text style={styles.label}>Логин</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          value={userLogin}
          onChangeText={setUserLogin}
          editable={!busy}
        />

        <Text style={styles.label}>Пароль</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, (busy || apiMissing) && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={busy || apiMissing}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Войти</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#eef1f5',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a2b45',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 20,
    fontSize: 15,
    color: '#5a6b7d',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3d4f63',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#c5d0dc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 14,
    backgroundColor: '#fafbfc',
  },
  button: {
    backgroundColor: '#1a5fb4',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#c01c28',
    marginBottom: 8,
    fontSize: 14,
  },
  warn: {
    color: '#8a4b00',
    backgroundColor: '#fff4e5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 18,
  },
});
