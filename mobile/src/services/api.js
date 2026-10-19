import axios from 'axios';
import { Platform } from 'react-native';

// For Android Emulator, localhost is 10.0.2.2.
// For Physical Device, replace with your local PC IP (e.g. 192.168.1.100)
export const DEFAULT_HOST = Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';

let currentBaseUrl = DEFAULT_HOST;

export const setCustomBaseUrl = (url) => {
  if (url && url.trim()) {
    currentBaseUrl = url.trim().replace(/\/$/, '');
  }
};

export const getBaseUrl = () => currentBaseUrl;

// Resolve static upload picture URL
export const getStudentImageUrl = (pictureUrl) => {
  if (!pictureUrl) return null;
  if (pictureUrl.startsWith('http://') || pictureUrl.startsWith('https://')) {
    return pictureUrl;
  }
  return `${currentBaseUrl}${pictureUrl}`;
};

// Register Student API call with Multipart FormData
export const registerStudent = async (formData) => {
  const url = `${currentBaseUrl}/api/auth/register`;
  const response = await axios.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 15000
  });
  return response.data;
};

// Login Student with CNIC and PIN
export const loginStudentPin = async (cnic, pin) => {
  const url = `${currentBaseUrl}/api/auth/login-pin`;
  const response = await axios.post(
    url,
    { cnic, pin },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    }
  );
  return response.data;
};
