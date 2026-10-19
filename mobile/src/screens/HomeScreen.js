import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import { getStudentImageUrl } from '../services/api';

export default function HomeScreen({ route, navigation }) {
  const student = route.params?.student || {
    firstName: 'Student',
    lastName: 'Name',
    fatherName: 'Father Name',
    cnic: '00000-0000000-0',
    enrollmentProgram: 'Hifz-ul-Quran',
    city: 'Lahore',
    guardianMobile: '03000000000',
    guardianEmail: 'guardian@example.com',
    address: 'Sample Address',
    status: 'approved'
  };

  const imageUrl = getStudentImageUrl(student.pictureUrl);
  const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase();

  const handleLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Welcome' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#047857" />

      {/* Header Banner */}
      <View style={styles.header}>
        <Text style={styles.systemTitle}>The Madaris Management System</Text>
        <Text style={styles.systemSubtitle}>Student Portal Dashboard</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarSection}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}

            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>✓ {student.status?.toUpperCase() || 'APPROVED'}</Text>
            </View>
          </View>

          <Text style={styles.fullName}>
            {student.firstName} {student.lastName}
          </Text>
          <Text style={styles.programText}>{student.enrollmentProgram}</Text>

          {/* Details List */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Father Name:</Text>
              <Text style={styles.detailValue}>{student.fatherName}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>B-Form / CNIC:</Text>
              <Text style={styles.detailValue}>{student.cnic}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>City:</Text>
              <Text style={styles.detailValue}>{student.city}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Guardian Mobile:</Text>
              <Text style={styles.detailValue}>{student.guardianMobile}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Guardian Email:</Text>
              <Text style={styles.detailValue}>{student.guardianEmail}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Address:</Text>
              <Text style={styles.detailValue}>{student.address}</Text>
            </View>
          </View>
        </View>

        {/* Notice Card */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>📢 Madaris Student Notice</Text>
          <Text style={styles.noticeBody}>
            Welcome to the Madaris Management System! Your registration is confirmed. Please keep your 4-digit PIN confidential.
          </Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>🚪 Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#047857',
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  systemTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  systemSubtitle: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarSection: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#047857',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ECFDF5',
    borderWidth: 3,
    borderColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#047857',
  },
  statusBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  fullName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  programText: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 16,
  },
  detailsContainer: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
    gap: 10,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    maxWidth: '60%',
    textAlign: 'right',
  },
  noticeCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  logoutBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
