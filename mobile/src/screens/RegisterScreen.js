import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { registerStudent } from '../services/api';

const ENROLLMENT_PROGRAMS = [
  'Hifz-ul-Quran (حفظ القرآن)',
  'Dars-e-Nizami (درس نظامی)',
  'Tajweed & Qiraat (تجوید وقراءت)',
  'Nazra Quran (ناظرہ قرآن)',
  'Islamic Studies (مطالعہ اسلام)'
];

export default function RegisterScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [cnic, setCnic] = useState('');
  const [guardianMobile, setGuardianMobile] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [enrollmentProgram, setEnrollmentProgram] = useState(ENROLLMENT_PROGRAMS[0]);
  const [image, setImage] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Image Picker Handler
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll permissions are required to upload student photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0]);
      }
    } catch (err) {
      Alert.alert('Image Picker Error', err.message);
    }
  };

  // Form Submission Handler
  const handleSubmit = async () => {
    setErrorMsg('');

    // Field Validations
    if (!firstName || !lastName || !fatherName || !cnic || !guardianMobile || !guardianEmail || !pin || !confirmPin || !address || !city) {
      setErrorMsg('Please fill in all mandatory fields.');
      return;
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setErrorMsg('PIN must be exactly 4 numeric digits.');
      return;
    }

    if (pin !== confirmPin) {
      setErrorMsg('PIN and Confirm PIN do not match.');
      return;
    }

    setLoading(true);

    try {
      // Build FormData payload
      const formData = new FormData();
      formData.append('firstName', firstName.trim());
      formData.append('lastName', lastName.trim());
      formData.append('fatherName', fatherName.trim());
      formData.append('cnic', cnic.trim());
      formData.append('guardianMobile', guardianMobile.trim());
      formData.append('guardianEmail', guardianEmail.trim());
      formData.append('pin', pin);
      formData.append('confirmPin', confirmPin);
      formData.append('address', address.trim());
      formData.append('city', city.trim());
      formData.append('enrollmentProgram', enrollmentProgram);

      if (image && image.uri) {
        const uriParts = image.uri.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        formData.append('picture', {
          uri: Platform.OS === 'ios' ? image.uri.replace('file://', '') : image.uri,
          name: `student_${Date.now()}.${fileType}`,
          type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`
        });
      }

      const response = await registerStudent(formData);

      Alert.alert(
        'Registration Submitted! ⏳',
        response.message || 'Your application has been received and is awaiting admin approval.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Welcome')
          }
        ]
      );
    } catch (err) {
      const serverErr = err.response?.data?.error || err.message || 'Failed to submit registration';
      setErrorMsg(serverErr);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.formTitle}>Student Registration</Text>
          <Text style={styles.formSubtitle}>Fill out student details for Madaris enrollment</Text>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          {/* Student Photo Picker */}
          <View style={styles.photoContainer}>
            <TouchableOpacity style={styles.photoPicker} onPress={handlePickImage}>
              {image ? (
                <Image source={{ uri: image.uri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoIcon}>📷</Text>
                  <Text style={styles.photoText}>Tap to Upload Picture</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Personal Info */}
          <Text style={styles.sectionHeader}>Personal Information</Text>

          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Muhammad"
            value={firstName}
            onChangeText={setFirstName}
          />

          <Text style={styles.label}>Last Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ali"
            value={lastName}
            onChangeText={setLastName}
          />

          <Text style={styles.label}>Father Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Ahmad Khan"
            value={fatherName}
            onChangeText={setFatherName}
          />

          <Text style={styles.label}>B-Form / CNIC Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 35202-1234567-1"
            keyboardType="numeric"
            value={cnic}
            onChangeText={setCnic}
          />

          {/* Contact Info */}
          <Text style={styles.sectionHeader}>Guardian Details</Text>

          <Text style={styles.label}>Guardian Mobile No *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 03001234567"
            keyboardType="phone-pad"
            value={guardianMobile}
            onChangeText={setGuardianMobile}
          />

          <Text style={styles.label}>Guardian Email Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. guardian@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={guardianEmail}
            onChangeText={setGuardianEmail}
          />

          {/* Security PIN */}
          <Text style={styles.sectionHeader}>Security Credentials</Text>

          <View style={styles.row}>
            <View style={[styles.col, { marginRight: 8 }]}>
              <Text style={styles.label}>4-Digit PIN *</Text>
              <TextInput
                style={styles.input}
                placeholder="1234"
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                value={pin}
                onChangeText={setPin}
              />
            </View>

            <View style={[styles.col, { marginLeft: 8 }]}>
              <Text style={styles.label}>Confirm PIN *</Text>
              <TextInput
                style={styles.input}
                placeholder="1234"
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                value={confirmPin}
                onChangeText={setConfirmPin}
              />
            </View>
          </View>

          {/* Location & Program */}
          <Text style={styles.sectionHeader}>Enrollment Details</Text>

          <Text style={styles.label}>City *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Lahore, Karachi, Islamabad"
            value={city}
            onChangeText={setCity}
          />

          <Text style={styles.label}>Residential Address *</Text>
          <TextInput
            style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
            placeholder="Complete street address"
            multiline
            value={address}
            onChangeText={setAddress}
          />

          <Text style={styles.label}>Enrollment Program *</Text>
          <View style={styles.programSelector}>
            {ENROLLMENT_PROGRAMS.map((prog) => (
              <TouchableOpacity
                key={prog}
                style={[
                  styles.programChip,
                  enrollmentProgram === prog && styles.programChipSelected
                ]}
                onPress={() => setEnrollmentProgram(prog)}
              >
                <Text
                  style={[
                    styles.programChipText,
                    enrollmentProgram === prog && styles.programChipTextSelected
                  ]}
                >
                  {prog}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            disabled={loading}
            onPress={handleSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Registration Application</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  formSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  photoPicker: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#047857',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
  },
  photoIcon: {
    fontSize: 28,
  },
  photoText: {
    fontSize: 9,
    color: '#475569',
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#047857',
    marginTop: 16,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  col: {
    flex: 1,
  },
  programSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  programChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  programChipSelected: {
    backgroundColor: '#047857',
  },
  programChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  programChipTextSelected: {
    color: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
