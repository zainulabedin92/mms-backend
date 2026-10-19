import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image
} from 'react-native';

export default function WelcomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#047857" />
      
      {/* Hero / Header Banner */}
      <View style={styles.heroSection}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🕌</Text>
        </View>
        <Text style={styles.mainTitle}>Madaris Management System</Text>
        <Text style={styles.acronymText}>(MMS)</Text>
        <Text style={styles.subtitle}>
          Official Student Registration & Portal Application
        </Text>
      </View>

      {/* Main Content Area */}
      <View style={styles.contentSection}>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Welcome to MMS Portal</Text>
          <Text style={styles.infoDesc}>
            New students can register online. Existing approved students can log in securely using their CNIC and 4-digit PIN.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.primaryButtonText}>📝  Register New Student</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.secondaryButtonText}>🔑  Student Login (PIN)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          Madaris Management System © 2026 • Secure Portal
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#047857',
  },
  heroSection: {
    flex: 2.2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconText: {
    fontSize: 42,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  acronymText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#A7F3D0',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#D1FAE5',
    textAlign: 'center',
    marginTop: 8,
  },
  contentSection: {
    flex: 2,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    justifyContent: 'space-between',
  },
  infoBox: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  infoDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: '#047857',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#047857',
  },
  secondaryButtonText: {
    color: '#047857',
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 10,
  },
});
