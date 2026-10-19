import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { loginStudentPin } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [cnic, setCnic] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    setErrorMsg('');

    if (!cnic || !pin) {
      setErrorMsg('Please enter both CNIC and your 4-digit PIN.');
      return;
    }

    if (pin.length !== 4) {
      setErrorMsg('PIN must be exactly 4 digits.');
      return;
    }

    setLoading(true);

    try {
      const data = await loginStudentPin(cnic.trim(), pin.trim());
      if (data.student) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home', params: { student: data.student } }],
        });
      }
    } catch (err) {
      const status = err.response?.status;
      const responseData = err.response?.data;
      const message = responseData?.error || err.message || 'Login failed';

      if (status === 403) {
        Alert.alert(
          'Approval Pending ⏳',
          message || 'Your account is pending admin approval. Once approved, you will be able to log in.'
        );
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.card}>
          <View style={styles.headerArea}>
            <View style={styles.lockIconContainer}>
              <Text style={styles.lockIcon}>🔑</Text>
            </View>
            <Text style={styles.title}>Student PIN Authentication</Text>
            <Text style={styles.subtitle}>Enter your CNIC / B-Form and 4-Digit PIN</Text>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>B-Form / CNIC Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 35202-1234567-1"
            keyboardType="numeric"
            value={cnic}
            onChangeText={setCnic}
          />

          <Text style={styles.label}>4-Digit Security PIN</Text>
          <TextInput
            style={styles.input}
            placeholder="••••"
            keyboardType="numeric"
            secureTextEntry
            maxLength={4}
            value={pin}
            onChangeText={setPin}
          />

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            disabled={loading}
            onPress={handleLogin}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginBtnText}>Unlock & Log In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('Welcome')}
          >
            <Text style={styles.backBtnText}>← Back to Welcome Screen</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#047857',
    justifyContent: 'center',
  },
  keyboardView: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  lockIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  lockIcon: {
    fontSize: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 16,
  },
  loginBtn: {
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
