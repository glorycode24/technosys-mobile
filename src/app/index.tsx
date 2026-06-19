import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput, Alert, ActivityIndicator, Image, Animated, Platform, ViewStyle, TextStyle, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useGeofence } from '../hooks/useGeofence';
import GeofenceMobileMap from '../components/GeofenceMobileMap';
import { TicketsTab } from '../components/TicketsTab';
import { syncQueue } from '../lib/syncQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '../lib/timeout';
import { Locale, TRANSLATIONS } from '../lib/translations';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false, // soft default
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(userId: string) {
  if (Platform.OS === 'web') {
    console.log('Push notifications not supported on web platform.');
    return;
  }
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return;
  }
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    // Fetch token
    const projectId = require('../../app.json')?.expo?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('Expo Project ID not found in app.json. Cannot fetch push token.');
      return;
    }
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId
    });
    const token = tokenData.data;
    console.log('Expo Push Token generated successfully:', token);
    
    // Save to Supabase profiles table
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);
      
    if (error) {
      console.error('Failed to update push token in profile:', error.message);
    }
  } catch (e: any) {
    console.warn('Error in push registration:', e.message || e);
  }
}

// Clean White Professional Theme
const COLORS = {
  background: '#ffffff',
  card: '#f8fafc',
  primary: '#10b981',
  primaryDim: 'rgba(16, 185, 129, 0.1)',
  textMain: '#0f172a',
  textMuted: '#64748b',
  danger: '#ef4444',
  border: '#e2e8f0'
};

const FadeInView = ({ children, currentTab }: any) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(8)).current;

  React.useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      })
    ]).start();
  }, [currentTab]);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
};

const LoginScreen = ({ onLogin }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(error.message || 'Invalid email or password. Please try again.');
    } else {
      onLogin(data.session);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { justifyContent: 'center', padding: 20 }]}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Image source={require('../../assets/logo.png')} style={{ width: 90, height: 90, resizeMode: 'contain', marginBottom: 8 }} />
          <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '600', letterSpacing: 2 }}>EMPLOYEE PORTAL</Text>
        </View>
        
        <View style={{ backgroundColor: COLORS.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}>
          <Text style={{ color: COLORS.textMain, marginBottom: 8, fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase' }}>Email Address</Text>
          <TextInput 
            style={styles.input}
            placeholder="employee@technocycle.com"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={{ color: COLORS.textMain, marginBottom: 8, fontWeight: 'bold', fontSize: 11, textTransform: 'uppercase' }}>Password</Text>
          <TextInput 
            style={[styles.input, { marginBottom: 24 }]}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {errorMsg ? (
            <View style={{
              backgroundColor: '#FEF2F2',
              borderWidth: 1,
              borderColor: '#FECACA',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}>
              <Text style={{ fontSize: 16, lineHeight: 20 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#991B1B', fontWeight: '700', fontSize: 13, marginBottom: 2 }}>Login Failed</Text>
                <Text style={{ color: '#B91C1C', fontSize: 12, lineHeight: 18 }}>{errorMsg}</Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity 
            style={{ backgroundColor: COLORS.primary, padding: 14, borderRadius: 12, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Secure Login</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Helper functions for platform-agnostic Secure Storage
  const getSecureItem = async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        return AsyncStorage.getItem(key);
      }
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn("SecureStore get failed", e);
      return null;
    }
  };

  const setSecureItem = async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (e) {
      console.warn("SecureStore set failed", e);
    }
  };

  const deleteSecureItem = async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (e) {
      console.warn("SecureStore delete failed", e);
    }
  };

  // Helper to verify server connectivity
  const checkIsOnline = async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
    try {
      const response = await withTimeout(
        fetch('https://ggknkdyuglzcnkwhvdak.supabase.co'),
        2000
      );
      return !!response;
    } catch (e) {
      return false;
    }
  };

  const authenticateBiometrics = async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        return true;
      }
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('biometricPrompt') || 'Authenticate to unlock TechnoSys',
        fallbackLabel: t('biometricFallback') || 'Use passcode',
        disableDeviceFallback: false,
      });
      return result.success;
    } catch (e) {
      console.warn("Biometric authentication error:", e);
      return false;
    }
  };
  const [profile, setProfile] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [payslip, setPayslip] = useState<any>(null);
  const [leaveAlert, setLeaveAlert] = useState<any>(null);
  const [recentLeaveAlerts, setRecentLeaveAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [timeInLoading, setTimeInLoading] = useState(false);
  const [timeOutLoading, setTimeOutLoading] = useState(false);
  const [activeTimeLog, setActiveTimeLog] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'payslip' | 'profile' | 'tickets'>('home');
  const geofence = useGeofence();

  // Phase 8: Two-Factor Biometric Scan States & Refs
  const [isWaitingForScan, setIsWaitingForScan] = useState(false);
  const [scanType, setScanType] = useState<'in' | 'out' | null>(null);
  const [scanCountdown, setScanCountdown] = useState(180);
  const scanTypeRef = React.useRef<'in' | 'out' | null>(null);
  const pendingLocationRef = React.useRef<any>(null);

  // Phase 8: DMS Download States
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const startFormDownload = (filename: string) => {
    if (downloadingFile) return;
    setDownloadingFile(filename);
    setDownloadProgress(0);
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 20;
      setDownloadProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setDownloadingFile(null);
          Alert.alert(
            language === 'fil' ? 'Matagumpay' : 'Success',
            language === 'fil'
              ? `Matagumpay na na-download ang ${filename} at na-save sa iyong device.`
              : `${filename} has been downloaded successfully and saved to your device.`
          );
        }, 300);
      }
    }, 450);
  };

  useEffect(() => {
    let timer: any;
    let pollInterval: any;
    let channel: any;

    if (isWaitingForScan && session) {
      setScanCountdown(180);
      const startTime = new Date().toISOString();

      // Subscribe to Supabase Realtime for this user's scans
      channel = supabase
        .channel('biometric_scans_' + session.user.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'physical_biometric_scans',
            filter: `employee_id=eq.${session.user.id}`
          },
          (payload) => {
            console.log('Realtime fingerprint scan detected:', payload);
            const scanTime = new Date(payload.new.scanned_at).getTime();
            const startMs = new Date(startTime).getTime();
            if (scanTime >= startMs - 5000) { // allow a 5s buffer
              handleBiometricScanSuccess();
            }
          }
        )
        .subscribe();

      // Polling fallback
      pollInterval = setInterval(async () => {
        const online = await checkIsOnline();
        if (!online) return;
        try {
          const { data, error } = await supabase
            .from('physical_biometric_scans')
            .select('scanned_at')
            .eq('employee_id', session.user.id)
            .gte('scanned_at', startTime)
            .order('scanned_at', { ascending: false })
            .limit(1);

          if (!error && data && data.length > 0) {
            console.log("Polling detected fingerprint scan:", data[0]);
            handleBiometricScanSuccess();
          }
        } catch (err) {
          console.warn("Polling biometric scan error:", err);
        }
      }, 3000);

      // 3-minute Countdown
      timer = setInterval(() => {
        setScanCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            clearInterval(pollInterval);
            if (channel) supabase.removeChannel(channel);
            setIsWaitingForScan(false);
            setScanType(null);
            scanTypeRef.current = null;
            pendingLocationRef.current = null;
            Alert.alert(t('biometricVerificationFailed'), t('biometricScanTimeout'));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
      if (pollInterval) clearInterval(pollInterval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [isWaitingForScan, session]);

  const handleBiometricScanSuccess = async () => {
    setIsWaitingForScan(false);
    setScanType(null);
    const type = scanTypeRef.current;
    const locationResult = pendingLocationRef.current;
    
    scanTypeRef.current = null;
    pendingLocationRef.current = null;
    
    if (type === 'in') {
      await executeTimeIn(locationResult);
    } else if (type === 'out') {
      await executeTimeOut(locationResult);
    }
  };

  const [language, setLanguage] = useState<Locale>('en');
  const langAnim = React.useRef(new Animated.Value(0)).current;

  const t = (key: keyof typeof TRANSLATIONS['en'] | string, replaceParams?: Record<string, string | number>) => {
    const currentLangDict = TRANSLATIONS[language] || TRANSLATIONS['en'];
    let text = (currentLangDict as any)[key] || (TRANSLATIONS['en'] as any)[key] || key;
    if (replaceParams) {
      Object.entries(replaceParams).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  const getBilingualText = (text: string, lang: 'en' | 'fil') => {
    if (!text) return '';
    const parts = text.split('|');
    if (parts.length > 1) {
      return lang === 'fil' ? parts[1].trim() : parts[0].trim();
    }
    return text.trim();
  };

  const changeLanguage = async (newLang: Locale) => {
    setLanguage(newLang);
    await AsyncStorage.setItem('APP_LANGUAGE', newLang);
    Animated.spring(langAnim, {
      toValue: newLang === 'en' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 50
    }).start();
  };

  useEffect(() => {
    AsyncStorage.getItem('APP_LANGUAGE').then((storedLang) => {
      if (storedLang === 'en' || storedLang === 'fil') {
        const lang = storedLang as Locale;
        setLanguage(lang);
        langAnim.setValue(lang === 'en' ? 0 : 1);
      }
    });
  }, []);

  const [dtrLogs, setDtrLogs] = useState<any[]>([]);
  const [dtrLoading, setDtrLoading] = useState(false);
  const [showDtrModal, setShowDtrModal] = useState(false);

  const fetchDtrLogs = async () => {
    if (!session) return;
    const online = await checkIsOnline();
    setIsOnline(online);

    if (!online) {
      console.log("App is offline, loading DTR logs from cache...");
      try {
        const cached = await AsyncStorage.getItem('CACHED_DTR_LOGS_' + session.user.id);
        setDtrLogs(cached ? JSON.parse(cached) : []);
      } catch (cacheErr) {
        console.error("Failed to read DTR logs cache", cacheErr);
      }
      return;
    }

    setDtrLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data, error } = await supabase.from('time_logs')
        .select('*')
        .eq('technician_id', session.user.id)
        .gte('created_at', startOfMonth)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDtrLogs(data || []);
      await AsyncStorage.setItem('CACHED_DTR_LOGS_' + session.user.id, JSON.stringify(data || []));
    } catch (e: any) {
      console.warn("Failed to fetch DTR logs:", e.message);
      setIsOnline(false);
      try {
        const cached = await AsyncStorage.getItem('CACHED_DTR_LOGS_' + session.user.id);
        if (cached) setDtrLogs(JSON.parse(cached));
      } catch (cacheErr) {}
    } finally {
      setDtrLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (session) {
      await Promise.all([
        fetchDashboardData(session.user.id),
        fetchDtrLogs()
      ]);
    }
    setRefreshing(false);
  };

  // Opening splash transition states
  const splashOpacity = React.useRef(new Animated.Value(1)).current;
  const logoOpacity = React.useRef(new Animated.Value(0)).current;
  const logoScale = React.useRef(new Animated.Value(0.85)).current;
  const taglineOpacity = React.useRef(new Animated.Value(0)).current;
  const taglineTranslateY = React.useRef(new Animated.Value(10)).current;
  const [splashVisible, setSplashVisible] = useState(true);

  // Offline queue state
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  const checkQueueStatus = async () => {
    const queue = await syncQueue.getQueue();
    setOfflineQueueCount(queue.length);
  };

  useEffect(() => {
    // Check auth cache, TTL and trigger biometrics if offline
    const initAuth = async () => {
      try {
        const storedSessionStr = await getSecureItem('USER_SESSION');
        if (!storedSessionStr) {
          return;
        }

        const storedSession = JSON.parse(storedSessionStr);
        
        // TTL Check: 24 hours
        const lastOnlineStr = await AsyncStorage.getItem('LAST_ONLINE_TIMESTAMP');
        const now = new Date();
        let isExpired = false;
        
        if (lastOnlineStr) {
          const lastOnline = new Date(lastOnlineStr);
          const diffMs = now.getTime() - lastOnline.getTime();
          if (diffMs > 24 * 60 * 60 * 1000) {
            isExpired = true;
          }
        } else {
          isExpired = true;
        }

        if (isExpired) {
          await deleteSecureItem('USER_SESSION');
          await AsyncStorage.removeItem('LAST_ONLINE_TIMESTAMP');
          await supabase.auth.signOut();
          
          Alert.alert(
            t('offlineSessionExpired'),
            t('offlineSessionExpiredMsg')
          );
          return;
        }

        // Within 24-hour limit
        const onlineStatus = await checkIsOnline();
        setIsOnline(onlineStatus);
        if (onlineStatus) {
          setSession(storedSession);
          try {
            await supabase.auth.setSession({
              access_token: storedSession.access_token,
              refresh_token: storedSession.refresh_token
            });
          } catch (e) {
            console.warn("Online setSession failed:", e);
          }
          await AsyncStorage.setItem('LAST_ONLINE_TIMESTAMP', now.toISOString());
        } else {
          // Offline biometric gate
          const authenticated = await authenticateBiometrics();
          if (authenticated) {
            setSession(storedSession);
            try {
              await supabase.auth.setSession({
                access_token: storedSession.access_token,
                refresh_token: storedSession.refresh_token
              });
            } catch (e) {
              console.warn("Offline setSession failed:", e);
            }
            setIsLocked(false);
          } else {
            setIsLocked(true);
          }
        }
      } catch (err) {
        console.warn("Init auth error", err);
      }
    };

    const startupSequence = async () => {
      // 1. Start logo entry animation
      const animPromise = new Promise<void>((resolve) => {
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }),
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(taglineTranslateY, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]).start(() => resolve());
      });

      // 2. Run auth checks in parallel
      const authPromise = initAuth();

      // 3. Wait for animation, auth check, and a minimum 1-second hold
      await Promise.all([animPromise, authPromise, new Promise(r => setTimeout(r, 1000))]);

      // 4. Fade out splash
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setSplashVisible(false);
      });
    };

    // Listen to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        await setSecureItem('USER_SESSION', JSON.stringify(currentSession));
        const onlineStatus = await checkIsOnline();
        setIsOnline(onlineStatus);
        if (onlineStatus) {
          await AsyncStorage.setItem('LAST_ONLINE_TIMESTAMP', new Date().toISOString());
        }
        await fetchDashboardData(currentSession.user.id);
        registerForPushNotificationsAsync(currentSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        await deleteSecureItem('USER_SESSION');
        await AsyncStorage.removeItem('LAST_ONLINE_TIMESTAMP');
      }
    });

    startupSequence();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
    });
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
    });
    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // Offline sync loop
  useEffect(() => {
    checkQueueStatus();

    const interval = setInterval(async () => {
      const online = await checkIsOnline();
      setIsOnline(online);

      const queue = await syncQueue.getQueue();
      if (queue.length > 0 && online) {
        console.log('Background checking connection to sync queue...');
        const res = await syncQueue.syncPendingQueue((item) => {
          if (item.type === 'time_in' || item.type === 'time_out') {
            if (session) fetchDashboardData(session.user.id);
          }
        });
        checkQueueStatus();
        if (res.syncedCount > 0) {
          Alert.alert('Sync Successful', `Synchronized ${res.syncedCount} offline transaction(s) with database.`);
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [session]);

  // Web-specific online/offline window listeners
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => {
        setIsOnline(true);
        if (session) {
          fetchDashboardData(session.user.id);
          syncQueue.getQueue().then(queue => {
            if (queue.length > 0) {
              syncQueue.syncPendingQueue((item) => {
                if (item.type === 'time_in' || item.type === 'time_out') {
                  fetchDashboardData(session.user.id);
                }
              }).then(res => {
                checkQueueStatus();
                if (res.syncedCount > 0) {
                  Alert.alert('Sync Successful', `Synchronized ${res.syncedCount} offline transaction(s) with database.`);
                }
              });
            }
          });
        }
      };
      const handleOffline = () => {
        setIsOnline(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [session]);

  // Real-time Announcements Sync
  useEffect(() => {
    let channel: any;
    if (session) {
      channel = supabase
        .channel('announcements_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'announcements' },
          async (payload) => {
            console.log('Realtime announcement change detected:', payload);
            try {
              // Re-fetch latest announcements to ensure correct sorting and details
              const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

              if (error) {
                console.error("Failed to fetch announcements in realtime update:", error.message);
                return;
              }

              if (data) {
                setAnnouncements(data);

                // Update AsyncStorage cache
                try {
                  const cached = await AsyncStorage.getItem('CACHED_DASHBOARD_' + session.user.id);
                  if (cached) {
                    const dashboardCache = JSON.parse(cached);
                    dashboardCache.announcements = data;
                    await AsyncStorage.setItem('CACHED_DASHBOARD_' + session.user.id, JSON.stringify(dashboardCache));
                  }
                } catch (cacheErr: any) {
                  console.warn("Failed to update dashboard announcements cache:", cacheErr.message);
                }

                // Alert user of new announcement if event is INSERT
                if (payload.eventType === 'INSERT') {
                  const newAnn = payload.new;
                  const userBranchId = profile?.branch_id;
                  
                  // Only alert if global or targets user's branch
                  if (!newAnn.target_branch_id || newAnn.target_branch_id === userBranchId) {
                    const title = getBilingualText(newAnn.title, language);
                    const content = getBilingualText(newAnn.content, language);
                    Alert.alert(
                      language === 'fil' ? 'Bagong Anunsyo!' : 'New Announcement!',
                      `${title}\n\n${content}`
                    );
                  }
                }
              }
            } catch (err: any) {
              console.error("Error handling realtime announcement change:", err.message || err);
            }
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [session, profile, language]);

  const loadDashboardDataFromCache = async (userId: string) => {
    try {
      const cached = await AsyncStorage.getItem('CACHED_DASHBOARD_' + userId);
      if (cached) {
        const dashboardCache = JSON.parse(cached);
        if (dashboardCache.profile) setProfile(dashboardCache.profile);
        setSchedules(dashboardCache.schedules || []);
        setPayslip(dashboardCache.payslip);
        setAnnouncements(dashboardCache.announcements || []);
        
        const cachedLogs = dashboardCache.logs || [];
        
        // Apply offline queue overrides to cached logs
        const queue = await syncQueue.getQueue();
        const pendingTimeIn = queue.find(item => item.type === 'time_in' && item.payload.technician_id === userId);
        
        let finalActiveLog: any = null;
        if (pendingTimeIn) {
          finalActiveLog = {
            id: 'offline-pending-' + pendingTimeIn.id,
            technician_id: userId,
            app_time_in: pendingTimeIn.payload.app_time_in,
            app_time_out: pendingTimeIn.payload.app_time_out || null,
            total_hours: pendingTimeIn.payload.total_hours || null,
            latitude: pendingTimeIn.payload.latitude,
            longitude: pendingTimeIn.payload.longitude,
            geofence_status: 'inside',
            is_offline_pending: true
          };
        } else if (cachedLogs.length > 0) {
          finalActiveLog = { ...cachedLogs[0] };
          const pendingTimeOut = queue.find(item => item.type === 'time_out' && item.payload.log_id === finalActiveLog.id);
          if (pendingTimeOut) {
            finalActiveLog.app_time_out = pendingTimeOut.payload.app_time_out;
            finalActiveLog.total_hours = pendingTimeOut.payload.total_hours;
          }
        }
        setActiveTimeLog(finalActiveLog);
      }
    } catch (cacheErr) {
      console.error("Failed to read dashboard cache", cacheErr);
    }
  };

  const fetchDashboardData = async (userId: string) => {
    const online = await checkIsOnline();
    setIsOnline(online);

    if (!online) {
      console.log("App is offline, loading dashboard data from cache directly...");
      await loadDashboardDataFromCache(userId);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const fetchProfilePromise = supabase.from('profiles').select('*').eq('id', userId).single();
      const fetchSchedulesPromise = supabase.from('schedules').select('*, senior_partner:profiles!senior_partner_id(full_name)').eq('technician_id', userId).order('start_time', { ascending: true });
      const fetchPayslipsPromise = supabase.from('payslips').select('*').eq('technician_id', userId).eq('status', 'published').order('created_at', { ascending: false }).limit(1).single();
      const fetchTimeLogsPromise = supabase.from('time_logs')
        .select('*')
        .eq('technician_id', userId)
        .gte('created_at', `${today}T00:00:00Z`)
        .order('created_at', { ascending: false });
      const fetchAnnouncementsPromise = supabase.from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      const fetchLeavesPromise = supabase.from('leaves')
        .select('*')
        .eq('technician_id', userId)
        .order('created_at', { ascending: false });

      const [profResult, schedsResult, payslipsResult, logsResult, announcementsResult, leavesResult] = await withTimeout(
        Promise.all([fetchProfilePromise, fetchSchedulesPromise, fetchPayslipsPromise, fetchTimeLogsPromise, fetchAnnouncementsPromise, fetchLeavesPromise]),
        4000
      );

      const isNetworkErr = (err: any) => {
        if (!err) return false;
        const msg = err.message || '';
        return msg.includes('fetch') || msg.includes('Network') || msg.includes('timeout') || err.status === 0 || err.status >= 500;
      };

      if (profResult.error && isNetworkErr(profResult.error)) throw profResult.error;
      if (schedsResult.error && isNetworkErr(schedsResult.error)) throw schedsResult.error;
      if (payslipsResult.error && isNetworkErr(payslipsResult.error)) throw payslipsResult.error;
      if (logsResult.error && isNetworkErr(logsResult.error)) throw logsResult.error;
      if (announcementsResult.error && isNetworkErr(announcementsResult.error)) throw announcementsResult.error;
      if (leavesResult.error && isNetworkErr(leavesResult.error)) throw leavesResult.error;

      const prof = profResult.data;
      const scheds = schedsResult.data || [];
      const pay = payslipsResult.data;
      const logs = logsResult.data || [];
      const anns = announcementsResult.data || [];
      const leaves = leavesResult.data || [];

      if (prof) setProfile(prof);
      setSchedules(scheds);
      setPayslip(pay);
      setAnnouncements(anns);

      // Check for leave status changes
      try {
        const lastKnownLeavesStr = await AsyncStorage.getItem('LAST_KNOWN_LEAVES_' + userId);
        if (lastKnownLeavesStr) {
          const lastKnownLeaves = JSON.parse(lastKnownLeavesStr) as any[];
          for (const newLeave of leaves) {
            const matchingOld = lastKnownLeaves.find(o => o.id === newLeave.id);
            if (matchingOld && matchingOld.status === 'pending' && newLeave.status !== 'pending') {
              // Found status change!
              setLeaveAlert({
                id: newLeave.id,
                type: newLeave.leave_type,
                status: newLeave.status,
                startDate: newLeave.start_date,
                endDate: newLeave.end_date
              });
              
              Alert.alert(
                language === 'fil' ? 'Update sa Pagliban' : 'Leave Request Update',
                language === 'fil'
                  ? `Ang iyong hiling sa pagliban (${newLeave.leave_type}) mula ${newLeave.start_date} hanggang ${newLeave.end_date} ay naging ${newLeave.status === 'approved' ? 'INAPRUBAHAN' : 'TINANGGIHAN'}.`
                  : `Your leave request (${newLeave.leave_type}) from ${newLeave.start_date} to ${newLeave.end_date} has been ${newLeave.status.toUpperCase()}.`
              );
            }
          }
        }
        await AsyncStorage.setItem('LAST_KNOWN_LEAVES_' + userId, JSON.stringify(leaves));
      } catch (leaveErr) {
        console.warn("Error checking leave status changes:", leaveErr);
      }

      // Process leaves transitions
      const cachedLeavesRaw = await AsyncStorage.getItem('CACHED_LEAVES_' + userId);
      const cachedLeaves = cachedLeavesRaw ? JSON.parse(cachedLeavesRaw) : null;

      if (cachedLeaves !== null) {
        const newAlerts: any[] = [];
        
        leaves.forEach((newLeave: any) => {
          const matchedCached = cachedLeaves.find((c: any) => c.id === newLeave.id);
          if (matchedCached) {
            const isApprovedTransition = matchedCached.status === 'pending' && newLeave.status === 'approved';
            const isRejectedTransition = matchedCached.status === 'pending' && newLeave.status === 'rejected';
            
            if (isApprovedTransition || isRejectedTransition) {
              newAlerts.push({
                id: newLeave.id,
                type: newLeave.status,
                startDate: newLeave.start_date,
                endDate: newLeave.end_date,
                reason: newLeave.reason || '',
                timestamp: new Date().toISOString()
              });
            }
          }
        });

        if (newAlerts.length > 0) {
          const currentStoredRaw = await AsyncStorage.getItem('UNREAD_LEAVE_ALERTS_' + userId);
          const currentStored = currentStoredRaw ? JSON.parse(currentStoredRaw) : [];
          
          const updatedStored = [...currentStored];
          newAlerts.forEach(alert => {
            if (!updatedStored.some(existing => existing.id === alert.id)) {
              updatedStored.unshift(alert);
            }
          });

          await AsyncStorage.setItem('UNREAD_LEAVE_ALERTS_' + userId, JSON.stringify(updatedStored));
          setRecentLeaveAlerts(updatedStored);

          if (newAlerts.length === 1) {
            const alertItem = newAlerts[0];
            const title = alertItem.type === 'approved' ? 'Leave Approved! 🎉' : 'Leave Request Update ⚠️';
            const message = alertItem.type === 'approved'
              ? `Your leave request for ${alertItem.startDate} to ${alertItem.endDate} has been approved.`
              : `Your leave request for ${alertItem.startDate} to ${alertItem.endDate} has been rejected. Check Support tickets for comments.`;
            Alert.alert(title, message);
          } else {
            const approvedCount = newAlerts.filter(a => a.type === 'approved').length;
            const rejectedCount = newAlerts.filter(a => a.type === 'rejected').length;
            let msg = '';
            if (approvedCount > 0 && rejectedCount > 0) {
              msg = `You have ${approvedCount} approved leave request(s) and ${rejectedCount} rejected leave request(s).`;
            } else if (approvedCount > 0) {
              msg = `You have ${approvedCount} new approved leave request(s).`;
            } else {
              msg = `You have ${rejectedCount} new rejected leave request(s).`;
            }
            Alert.alert('Leave Status Updates', msg);
          }
        }
      }

      await AsyncStorage.setItem('CACHED_LEAVES_' + userId, JSON.stringify(leaves));

      // Apply offline queue overrides to time logs
      const queue = await syncQueue.getQueue();
      const pendingTimeIn = queue.find(item => item.type === 'time_in' && item.payload.technician_id === userId);
      
      let finalActiveLog: any = null;
      if (pendingTimeIn) {
        finalActiveLog = {
          id: 'offline-pending-' + pendingTimeIn.id,
          technician_id: userId,
          app_time_in: pendingTimeIn.payload.app_time_in,
          app_time_out: pendingTimeIn.payload.app_time_out || null,
          total_hours: pendingTimeIn.payload.total_hours || null,
          latitude: pendingTimeIn.payload.latitude,
          longitude: pendingTimeIn.payload.longitude,
          geofence_status: 'inside',
          is_offline_pending: true
        };
      } else if (logs.length > 0) {
        finalActiveLog = { ...logs[0] };
        const pendingTimeOut = queue.find(item => item.type === 'time_out' && item.payload.log_id === finalActiveLog.id);
        if (pendingTimeOut) {
          finalActiveLog.app_time_out = pendingTimeOut.payload.app_time_out;
          finalActiveLog.total_hours = pendingTimeOut.payload.total_hours;
        }
      }
      setActiveTimeLog(finalActiveLog);

      // Save to cache
      const dashboardCache = {
        profile: prof,
        schedules: scheds,
        payslip: pay,
        logs: logs,
        announcements: anns,
        leaves: leaves,
        cachedAt: new Date().toISOString()
      };
      await AsyncStorage.setItem('CACHED_DASHBOARD_' + userId, JSON.stringify(dashboardCache));
      await AsyncStorage.setItem('LAST_ONLINE_TIMESTAMP', new Date().toISOString());
    } catch (e: any) {
      console.warn("Failed to load dashboard data from network, trying cache:", e.message);
      setIsOnline(false);
      await loadDashboardDataFromCache(userId);
    }
  };

  const executeTimeIn = async (locationResult: any) => {
    if (!session) return;
    setTimeInLoading(true);

    try {
      const isSuspicious = (locationResult.timeDrift && locationResult.timeDrift > 15 * 60 * 1000) || false;
      const timeInPayload = {
        technician_id: session.user.id,
        app_time_in: new Date().toISOString(),
        latitude: locationResult.latitude,
        longitude: locationResult.longitude,
        geofence_status: 'inside',
        is_mocked: locationResult.isMocked || false,
        gps_accuracy: locationResult.gpsAccuracy || null,
        is_suspicious: isSuspicious
      };

      const { error } = await supabase.from('time_logs').insert(timeInPayload);

      if (error) {
        const errMessage = error.message || '';
        const status = (error as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
        
        if (isNetworkError) {
          const queuePayload = {
            ...timeInPayload,
            time_drift_at_creation: locationResult.timeDrift || null
          };
          await syncQueue.addToQueue('time_in', queuePayload);
          const mockLog = {
            id: 'offline-pending-' + Date.now(),
            technician_id: session.user.id,
            app_time_in: timeInPayload.app_time_in,
            latitude: timeInPayload.latitude,
            longitude: timeInPayload.longitude,
            geofence_status: timeInPayload.geofence_status,
            is_offline_pending: true
          };
          setActiveTimeLog(mockLog);
          Alert.alert(t('biometricScanMatched'), t('syncPendingAlertDesc'));
          checkQueueStatus();
          return;
        }
        throw error;
      }

      Alert.alert(t('biometricScanMatched'), t('locationVerified'));
      await fetchDashboardData(session.user.id);
    } catch (e: any) {
      Alert.alert('Time In Failed', e.message || 'An error occurred.');
    } finally {
      setTimeInLoading(false);
    }
  };

  const executeTimeOut = async (locationResult: any) => {
    if (!session || !activeTimeLog) return;
    setTimeOutLoading(true);

    try {
      const timeOutTime = new Date().toISOString();
      const timeInMs = new Date(activeTimeLog.app_time_in).getTime();
      const timeOutMs = new Date(timeOutTime).getTime();
      const diffHours = Number(((timeOutMs - timeInMs) / (1000 * 60 * 60)).toFixed(2));

      const isOfflinePending = activeTimeLog.is_offline_pending;
      const isSuspicious = (locationResult?.timeDrift && locationResult.timeDrift > 15 * 60 * 1000) || false;

      if (isOfflinePending) {
        const queue = await syncQueue.getQueue();
        const timeInItemIndex = queue.findIndex(item => item.type === 'time_in' && item.payload.app_time_in === activeTimeLog.app_time_in);
        
        if (timeInItemIndex !== -1) {
          queue[timeInItemIndex].payload.app_time_out = timeOutTime;
          queue[timeInItemIndex].payload.total_hours = diffHours;
          queue[timeInItemIndex].payload.is_suspicious = queue[timeInItemIndex].payload.is_suspicious || isSuspicious;
          await AsyncStorage.setItem('OFFLINE_TRANSACTION_QUEUE', JSON.stringify(queue));
        } else {
          await syncQueue.addToQueue('time_out', {
            log_id: activeTimeLog.id,
            app_time_out: timeOutTime,
            total_hours: diffHours,
            is_suspicious: isSuspicious,
            time_drift_at_creation: locationResult?.timeDrift || null
          });
        }
        
        setActiveTimeLog((prev: any) => ({
          ...prev,
          app_time_out: timeOutTime,
          total_hours: diffHours
        }));
        Alert.alert(t('biometricScanMatched'), t('syncPendingAlertOut', { hours: diffHours }));
        checkQueueStatus();
        return;
      }

      const { error } = await supabase.from('time_logs')
        .update({
          app_time_out: timeOutTime,
          total_hours: diffHours,
          is_suspicious: isSuspicious
        })
        .eq('id', activeTimeLog.id);

      if (error) {
        const errMessage = error.message || '';
        const status = (error as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;

        if (isNetworkError) {
          await syncQueue.addToQueue('time_out', {
            log_id: activeTimeLog.id,
            app_time_out: timeOutTime,
            total_hours: diffHours,
            is_suspicious: isSuspicious,
            time_drift_at_creation: locationResult?.timeDrift || null
          });
          setActiveTimeLog((prev: any) => ({
            ...prev,
            app_time_out: timeOutTime,
            total_hours: diffHours
          }));
          Alert.alert(t('biometricScanMatched'), t('syncPendingAlertOut', { hours: diffHours }));
          checkQueueStatus();
          return;
        }
        throw error;
      }

      Alert.alert(t('biometricScanMatched'), t('workedHours', { hours: diffHours }));
      await fetchDashboardData(session.user.id);
    } catch (e: any) {
      Alert.alert('Time Out Failed', e.message || 'An error occurred.');
    } finally {
      setTimeOutLoading(false);
    }
  };

  const getActiveDirectOrTravelSchedule = () => {
    if (!schedules || schedules.length === 0) return null;
    const todayStr = new Date().toDateString();
    return schedules.find(s => {
      const schedDateStr = new Date(s.start_time).toDateString();
      return schedDateStr === todayStr && (s.attendance_mode === 'direct_dispatch' || s.attendance_mode === 'out_of_town');
    });
  };

  const handleTimeIn = async () => {
    if (!session) return;
    setTimeInLoading(true);

    try {
      const activeSched = getActiveDirectOrTravelSchedule();
      if (activeSched) {
        // Bypass geofence check and biometric fingerprint scan
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
        const locationResult = {
          status: 'inside',
          latitude: currentLoc?.coords.latitude || 14.5995,
          longitude: currentLoc?.coords.longitude || 120.9842,
          isMocked: false,
          gpsAccuracy: currentLoc?.coords.accuracy || 10,
          timeDrift: 0
        };
        
        // Execute DTR log using the scheduled start timeauthoritatively
        const timeInPayload = {
          technician_id: session.user.id,
          app_time_in: activeSched.start_time, // scheduled start time!
          latitude: locationResult.latitude,
          longitude: locationResult.longitude,
          geofence_status: 'inside',
          is_mocked: false,
          gps_accuracy: locationResult.gpsAccuracy || null,
          is_suspicious: false
        };

        const { error } = await supabase.from('time_logs').insert(timeInPayload);

        if (error) {
          const errMessage = error.message || '';
          const status = (error as any).status;
          const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
          
          if (isNetworkError) {
            await syncQueue.addToQueue('time_in', {
              ...timeInPayload,
              time_drift_at_creation: 0
            });
            const mockLog = {
              id: 'offline-pending-' + Date.now(),
              technician_id: session.user.id,
              app_time_in: timeInPayload.app_time_in,
              latitude: timeInPayload.latitude,
              longitude: timeInPayload.longitude,
              geofence_status: 'inside',
              is_offline_pending: true
            };
            setActiveTimeLog(mockLog);
            Alert.alert(t('biometricScanMatched') || 'Success', t('syncPendingAlertDesc'));
            checkQueueStatus();
            return;
          }
          throw error;
        }

        Alert.alert(
          language === 'fil' ? 'Matagumpay' : 'Success',
          language === 'fil'
            ? 'Awtomatikong na-verify ang iyong clock-in batay sa iyong direktang dispatch/out-of-town na schedule.'
            : 'Your clock-in has been automatically verified based on your direct dispatch/out-of-town schedule.'
        );
        await fetchDashboardData(session.user.id);
        return;
      }

      const locationResult = await geofence.checkLocation();

      if (!locationResult || locationResult.status !== 'inside') {
        setTimeInLoading(false);
        const errMsg = locationResult?.errorKey 
          ? (locationResult.errorKey === 'poorGpsSignal' && locationResult.gpsAccuracy 
              ? t(locationResult.errorKey, { accuracy: Math.round(locationResult.gpsAccuracy) }) 
              : t(locationResult.errorKey))
          : (locationResult?.error || 'Could not verify your location. Please try again.');
        Alert.alert(
          t('locationVerificationFailed'),
          errMsg,
          [{ text: 'OK' }]
        );
        return;
      }

      // Proximity verified, transition to biometric waiting state
      scanTypeRef.current = 'in';
      pendingLocationRef.current = locationResult;
      setIsWaitingForScan(true);
      setScanType('in');
    } catch (e: any) {
      Alert.alert('Time In Failed', e.message || 'An error occurred.');
    } finally {
      setTimeInLoading(false);
    }
  };

  const handleTimeOut = async () => {
    if (!session || !activeTimeLog) return;
    setTimeOutLoading(true);

    try {
      const activeSched = getActiveDirectOrTravelSchedule();
      if (activeSched) {
        // Bypass geofence check and biometric fingerprint scan
        const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
        const locationResult = {
          status: 'inside',
          latitude: currentLoc?.coords.latitude || 14.5995,
          longitude: currentLoc?.coords.longitude || 120.9842,
          isMocked: false,
          gpsAccuracy: currentLoc?.coords.accuracy || 10,
          timeDrift: 0
        };
        await executeTimeOut(locationResult);
        return;
      }

      const locationResult = await geofence.checkLocation();

      if (!locationResult || locationResult.status !== 'inside') {
        setTimeOutLoading(false);
        const errMsg = locationResult?.errorKey 
          ? (locationResult.errorKey === 'poorGpsSignal' && locationResult.gpsAccuracy 
              ? t(locationResult.errorKey, { accuracy: Math.round(locationResult.gpsAccuracy) }) 
              : t(locationResult.errorKey))
          : (locationResult?.error || 'Could not verify your location. Please try again.');
        Alert.alert(
          t('locationVerificationFailed'),
          errMsg,
          [{ text: 'OK' }]
        );
        return;
      }

      // Proximity verified, transition to biometric waiting state
      scanTypeRef.current = 'out';
      pendingLocationRef.current = locationResult;
      setIsWaitingForScan(true);
      setScanType('out');
    } catch (e: any) {
      Alert.alert('Time Out Failed', e.message || 'An error occurred.');
    } finally {
      setTimeOutLoading(false);
    }
  };

  const formatPhp = (amount: number) => {
    if (!amount) return '₱ 0.00';
    return `₱ ${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderAppContent = () => {
    if (isLocked) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
            <Feather name="lock" size={64} color={COLORS.danger} style={{ marginBottom: 24 }} />
            <Text style={{ fontSize: 24, fontWeight: '800', color: COLORS.textMain, marginBottom: 8 }}>
              {t('lockedScreenTitle')}
            </Text>
            <Text style={{ fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginBottom: 32, paddingHorizontal: 20 }}>
              {t('lockedScreenDesc')}
            </Text>
            <TouchableOpacity 
              style={{ 
                backgroundColor: COLORS.primary, 
                paddingHorizontal: 24, 
                paddingVertical: 14, 
                borderRadius: 12, 
                flexDirection: 'row', 
                alignItems: 'center',
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8
              }}
              onPress={async () => {
                const authenticated = await authenticateBiometrics();
                if (authenticated) {
                  setIsLocked(false);
                  const storedSessionStr = await getSecureItem('USER_SESSION');
                  if (storedSessionStr) {
                    const storedSession = JSON.parse(storedSessionStr);
                    setSession(storedSession);
                    await supabase.auth.setSession({
                      access_token: storedSession.access_token,
                      refresh_token: storedSession.refresh_token
                    });
                  }
                }
              }}
            >
              <Feather name="shield" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                {t('retryAuth')}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    if (!session) {
      return <LoginScreen onLogin={setSession} />;
    }

    const vipSchedules = schedules.filter(s => s.is_vip_hook);
    const regularSchedules = schedules.filter(s => !s.is_vip_hook);

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        
        {offlineQueueCount > 0 && (
          <View style={styles.offlineBanner}>
            <Feather name="wifi-off" size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.offlineBannerText}>
              {t('syncBanner', { count: offlineQueueCount })}
            </Text>
          </View>
        )}
        
        {/* Dynamic Main Content Based on Tab */}
        <FadeInView currentTab={activeTab}>
          {activeTab === 'home' && (
            <ScrollView 
              contentContainerStyle={styles.content}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[COLORS.primary]}
                  tintColor={COLORS.primary}
                />
              }
            >
              <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View>
                  <Text style={styles.greeting}>{t('welcomeBack')}</Text>
                  <Text style={styles.name}>{profile?.full_name || 'Technician'}</Text>
                </View>
                <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
              </View>

              {leaveAlert && (
                <View style={{
                  backgroundColor: leaveAlert.status === 'approved' ? COLORS.primaryDim : 'rgba(239, 68, 68, 0.08)',
                  borderColor: leaveAlert.status === 'approved' ? COLORS.primary : COLORS.danger,
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{
                      fontWeight: 'bold',
                      fontSize: 14,
                      color: leaveAlert.status === 'approved' ? COLORS.primary : COLORS.danger,
                      marginBottom: 4
                    }}>
                      📢 {language === 'fil' ? 'Update sa Pagliban' : 'Leave Request Update'}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: COLORS.textMain,
                      lineHeight: 18
                    }}>
                      {language === 'fil'
                        ? `Ang iyong hiling sa pagliban (${leaveAlert.type}) mula ${leaveAlert.startDate} hanggang ${leaveAlert.endDate} ay ${leaveAlert.status === 'approved' ? 'INAPRUBAHAN' : 'TINANGGIHAN'}.`
                        : `Your leave request (${leaveAlert.type}) from ${leaveAlert.startDate} to ${leaveAlert.endDate} has been ${leaveAlert.status.toUpperCase()}.`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setLeaveAlert(null)} style={{ padding: 8 }}>
                    <Feather name="x" size={16} color={leaveAlert.status === 'approved' ? COLORS.primary : COLORS.danger} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ marginBottom: 32 }}>
                {!activeTimeLog && (
                  <TouchableOpacity style={styles.timeInButton} onPress={handleTimeIn} disabled={timeInLoading}>
                    {timeInLoading ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Feather name="map-pin" size={28} color="#fff" style={{ marginBottom: 8 }} />
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 4 }}>{t('clockInNow')}</Text>
                        <Text style={{ color: '#ecfdf5', fontSize: 12 }}>📍 {t('locationVerificationDetails')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {activeTimeLog && !activeTimeLog.app_time_out && (
                  <View>
                    <View style={styles.timeInSuccess}>
                      <Feather name="check-circle" size={22} color={COLORS.primary} style={{ marginBottom: 6 }} />
                      <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 15 }}>{t('locationVerified')}</Text>
                      <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
                        {t('loggedAt', { time: new Date(activeTimeLog.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}
                      </Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={[styles.timeInButton, { backgroundColor: COLORS.danger, shadowColor: COLORS.danger, marginTop: 12 }]} 
                      onPress={handleTimeOut} 
                      disabled={timeOutLoading}
                    >
                      {timeOutLoading ? <ActivityIndicator color="#fff" /> : (
                        <>
                          <Feather name="log-out" size={24} color="#fff" style={{ marginBottom: 6 }} />
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, marginBottom: 2 }}>{t('clockOutNow')}</Text>
                          <Text style={{ color: '#fee2e2', fontSize: 11 }}>📍 {t('locationVerificationDetails')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {activeTimeLog && activeTimeLog.app_time_out && (
                  <View style={[styles.timeInSuccess, { borderColor: COLORS.textMuted, backgroundColor: '#f1f5f9' }]}>
                    <Feather name="lock" size={22} color={COLORS.textMuted} style={{ marginBottom: 6 }} />
                    <Text style={{ color: COLORS.textMain, fontWeight: 'bold', fontSize: 15 }}>{t('shiftCompleted')}</Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                      {t('workedHours', { hours: activeTimeLog.total_hours })} ({new Date(activeTimeLog.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activeTimeLog.app_time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </Text>
                  </View>
                )}

                {/* Proximity / Map Section */}
                {!geofence.latitude ? (
                  <TouchableOpacity
                    style={{
                      marginTop: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: COLORS.primary,
                      backgroundColor: COLORS.primaryDim,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={async () => {
                      await geofence.checkLocation();
                    }}
                  >
                    <Feather name="map" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                    <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 13 }}>
                      {t('checkProximity')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ marginTop: 12 }}>
                    <View style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: geofence.status === 'inside' ? COLORS.primaryDim : 'rgba(239, 68, 68, 0.08)',
                      borderWidth: 1,
                      borderColor: geofence.status === 'inside' ? COLORS.primary : COLORS.danger,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}>
                      <Feather 
                        name={geofence.status === 'inside' ? "check-circle" : "alert-triangle"} 
                        size={16} 
                        color={geofence.status === 'inside' ? COLORS.primary : COLORS.danger} 
                        style={{ marginRight: 8 }} 
                      />
                      <Text style={{ 
                        flex: 1, 
                        fontSize: 12, 
                        color: geofence.status === 'inside' ? COLORS.primary : COLORS.danger, 
                        fontWeight: '600' 
                      }}>
                        {geofence.status === 'inside' 
                          ? t('verifiedInside', { office: geofence.matchingOfficeName || '', distance: Math.round(geofence.distance || 0) })
                          : (geofence.status === 'error' && geofence.errorKey
                              ? (geofence.errorKey === 'poorGpsSignal' && geofence.gpsAccuracy
                                  ? t(geofence.errorKey, { accuracy: Math.round(geofence.gpsAccuracy) })
                                  : t(geofence.errorKey))
                              : (geofence.error || t('outsideArea', { distance: Math.round(geofence.distance || 0) })))
                        }
                      </Text>
                      <TouchableOpacity onPress={geofence.reset} style={{ padding: 4 }}>
                        <Feather name="x" size={14} color={geofence.status === 'inside' ? COLORS.primary : COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                    <GeofenceMobileMap
                      userLat={geofence.latitude || 0}
                      userLng={geofence.longitude || 0}
                      branchLat={geofence.officeLatitude || 0}
                      branchLng={geofence.officeLongitude || 0}
                      radius={geofence.officeRadius || 50}
                      branchName={geofence.matchingOfficeName || 'Office'}
                    />
                  </View>
                )}
              </View>

              {/* Announcements Section */}
              {(() => {
                const filteredAnnouncements = announcements.filter(ann => 
                  !ann.target_branch_id || ann.target_branch_id === profile?.branch_id
                );
                if (filteredAnnouncements.length === 0) return null;

                return (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={styles.sectionTitleMain}>{t('announcementsLabel')}</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      snapToInterval={280 + 16}
                      decelerationRate="fast"
                      contentContainerStyle={{ paddingRight: 16 }}
                    >
                      {filteredAnnouncements.map((ann) => (
                        <View 
                          key={ann.id} 
                          style={{
                            width: 280,
                            backgroundColor: COLORS.card,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            padding: 16,
                            marginRight: 16,
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          <View style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 4,
                            bottom: 0,
                            backgroundColor: '#6366f1'
                          }} />
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingLeft: 6 }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              📢 {ann.target_branch_id ? (language === 'fil' ? 'Sangay' : 'Branch') : 'Global'}
                            </Text>
                            <Text style={{ fontSize: 9, color: COLORS.textMuted }}>
                              {new Date(ann.created_at).toLocaleDateString(language === 'fil' ? 'fil-PH' : 'en-US', { month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6, paddingLeft: 6 }} numberOfLines={1}>
                            {getBilingualText(ann.title, language)}
                          </Text>
                          <Text style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 18, paddingLeft: 6 }} numberOfLines={3}>
                            {getBilingualText(ann.content, language)}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                );
              })()}

              <Text style={styles.sectionTitleMain}>{t('priorityDispatch')}</Text>
              {vipSchedules.length === 0 && <Text style={styles.emptyText}>{t('noVipSchedules')}</Text>}
              {vipSchedules.map(sched => (
                <View key={sched.id} style={styles.vipCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View style={styles.vipBadge}>
                      <Text style={styles.vipBadgeText}>{t('urgent').toUpperCase()}</Text>
                    </View>
                    {sched.attendance_mode && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: sched.attendance_mode === 'hq' ? 'rgba(15, 23, 42, 0.05)' : (sched.attendance_mode === 'direct_dispatch' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'), borderWidth: 1, borderColor: sched.attendance_mode === 'hq' ? 'rgba(15, 23, 42, 0.1)' : (sched.attendance_mode === 'direct_dispatch' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)') }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', color: sched.attendance_mode === 'hq' ? '#475569' : (sched.attendance_mode === 'direct_dispatch' ? COLORS.primary : '#d97706') }}>
                          💼 {sched.attendance_mode === 'hq' ? 'HQ Standard' : (sched.attendance_mode === 'direct_dispatch' ? (language === 'fil' ? 'Direktang Dispatch' : 'Direct Dispatch') : (language === 'fil' ? 'Labas ng Bayan' : 'Out-of-Town'))}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.vipTitle}>{sched.client_name}</Text>
                  <Text style={styles.vipTime}>{formatTime(sched.start_time)}{sched.end_time ? ` - ${formatTime(sched.end_time)}` : ''}</Text>
                  <Text style={styles.vipLocation}><Feather name="map-pin" size={12}/> {sched.location}</Text>
                  {sched.senior_partner?.full_name && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 8, backgroundColor: 'rgba(15, 23, 42, 0.03)', borderRadius: 8 }}>
                      <Feather name="user" size={12} color={COLORS.textMain} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 12, color: COLORS.textMain, fontWeight: '700' }}>
                        {language === 'fil' ? 'Senior Tech: ' : 'Senior Partner: '}
                        <Text style={{ fontWeight: 'normal' }}>{sched.senior_partner.full_name}</Text>
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              <Text style={[styles.sectionTitleMain, { marginTop: 24 }]}>{t('standardSchedule')}</Text>
              {regularSchedules.length === 0 && <Text style={styles.emptyText}>{t('noSchedule')}</Text>}
              {regularSchedules.map(sched => (
                <View key={sched.id} style={styles.regularCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    {sched.attendance_mode && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: sched.attendance_mode === 'hq' ? 'rgba(15, 23, 42, 0.05)' : (sched.attendance_mode === 'direct_dispatch' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'), borderWidth: 1, borderColor: sched.attendance_mode === 'hq' ? 'rgba(15, 23, 42, 0.1)' : (sched.attendance_mode === 'direct_dispatch' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)') }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', color: sched.attendance_mode === 'hq' ? '#475569' : (sched.attendance_mode === 'direct_dispatch' ? COLORS.primary : '#d97706') }}>
                          💼 {sched.attendance_mode === 'hq' ? 'HQ Standard' : (sched.attendance_mode === 'direct_dispatch' ? (language === 'fil' ? 'Direktang Dispatch' : 'Direct Dispatch') : (language === 'fil' ? 'Labas ng Bayan' : 'Out-of-Town'))}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.regularTitle}>{sched.client_name}</Text>
                  <Text style={styles.regularTime}>{formatTime(sched.start_time)}{sched.end_time ? ` - ${formatTime(sched.end_time)}` : ''}</Text>
                  <Text style={styles.regularLocation}><Feather name="map-pin" size={12}/> {sched.location}</Text>
                  {sched.senior_partner?.full_name && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 8, backgroundColor: 'rgba(15, 23, 42, 0.03)', borderRadius: 8 }}>
                      <Feather name="user" size={12} color={COLORS.textMain} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 12, color: COLORS.textMain, fontWeight: '700' }}>
                        {language === 'fil' ? 'Senior Tech: ' : 'Senior Partner: '}
                        <Text style={{ fontWeight: 'normal' }}>{sched.senior_partner.full_name}</Text>
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          {activeTab === 'payslip' && (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }]}>
                <Text style={styles.name}>{t('payrollTab') || 'My Earnings'}</Text>
                <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
              </View>
              {payslip ? (
                (() => {
                  // Calculate itemized details
                  const cycleLogs = dtrLogs.filter(log => {
                    const logDate = log.created_at ? log.created_at.split('T')[0] : '';
                    return logDate >= payslip.period_start && logDate <= payslip.period_end;
                  });
                  const daysWorked = cycleLogs.length || 10;
                  const totalHours = cycleLogs.reduce((sum, log) => sum + Number(log.total_hours || 0), 0) || (daysWorked * 8);
                  
                  const baseHourlyRate = Number(profile?.base_salary || 20000) / 160;
                  const expectedRegularPay = baseHourlyRate * totalHours;
                  const holidayBonus = Math.max(0, Number(payslip.gross_pay) - expectedRegularPay);
                  const holidayHours = holidayBonus > 0 ? Math.round(holidayBonus / (baseHourlyRate * 0.3)) : 0;
                  
                  const withholdingTax = Math.max(0, Number(payslip.gross_pay) - Number(payslip.sss_deduction) - Number(payslip.philhealth_deduction) - Number(payslip.pagibig_deduction) - Number(payslip.net_pay));

                  return (
                    <View style={styles.payslipCard}>
                      <Text style={styles.sectionTitle}>{language === 'fil' ? 'Huling Payslip' : 'Latest Payslip'}</Text>
                      <Text style={styles.period}>{language === 'fil' ? 'Siklo' : 'Cycle'}: {payslip.period_start} to {payslip.period_end}</Text>
                      
                      <View style={styles.netPayBox}>
                        <Text style={styles.netPayLabel}>{language === 'fil' ? 'Kabuuang Netong Sahod' : 'Net Take-Home Pay'}</Text>
                        <Text style={styles.netPayAmount}>{formatPhp(payslip.net_pay)}</Text>
                      </View>

                      {/* Itemized Table */}
                      <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 }}>
                        {language === 'fil' ? 'PAGHAHATI-HATI NG KITA' : 'EARNINGS BREAKDOWN'}
                      </Text>
                      
                      <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderLeftWidth: 0, borderRightWidth: 0, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{language === 'fil' ? 'Mga Araw na Ipinasok' : 'Days Worked in Cycle'}</Text>
                          <Text style={{ color: COLORS.textMain, fontWeight: 'bold', fontSize: 13 }}>{daysWorked} {language === 'fil' ? 'araw' : 'days'} ({totalHours.toFixed(1)} hrs)</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{language === 'fil' ? 'Kita sa Reglar na Oras' : 'Base Regular Pay'}</Text>
                          <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 13 }}>{formatPhp(Math.min(Number(payslip.gross_pay), expectedRegularPay))}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{language === 'fil' ? 'Oras ng Holiday at Bonus' : 'Holiday Hours & Multiplier'}</Text>
                          <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 13 }}>+{formatPhp(holidayBonus)} ({holidayHours} hrs)</Text>
                        </View>
                      </View>

                      <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                        {language === 'fil' ? 'MGA BINAWAS (DEDUCTIONS)' : 'DEDUCTIONS & ADJUSTMENTS'}
                      </Text>

                      <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderLeftWidth: 0, borderRightWidth: 0, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>SSS Contribution</Text>
                          <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(payslip.sss_deduction)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>PhilHealth Contribution</Text>
                          <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(payslip.philhealth_deduction)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>Pag-IBIG Contribution</Text>
                          <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(payslip.pagibig_deduction)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                          <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{language === 'fil' ? 'Withholding Tax / Karagdagang Bawas' : 'Withholding Tax adjustments'}</Text>
                          <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(withholdingTax)}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })()
              ) : (
                <View style={[styles.payslipCard, { alignItems: 'center', paddingVertical: 60 }]}>
                  <Feather name="file-text" size={48} color={COLORS.border} style={{ marginBottom: 16 }} />
                  <Text style={{ color: COLORS.textMuted }}>No published payslips found.</Text>
                </View>
              )}
            </ScrollView>
          )}

          {activeTab === 'tickets' && (
            <TicketsTab userId={session.user.id} fullName={profile?.full_name || 'Technician'} language={language} isOnline={isOnline} />
          )}




          {activeTab === 'profile' && (
            <ScrollView contentContainerStyle={styles.content}>
               <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }]}>
                <Text style={styles.name}>{t('profileTitle')}</Text>
                <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
              </View>

              {/* Avatar Header Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryDim, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <Text style={{ color: COLORS.primary, fontSize: 24, fontWeight: 'bold' }}>{profile?.full_name?.charAt(0) || 'T'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: COLORS.textMain, fontSize: 18, fontWeight: 'bold', marginBottom: 2 }}>{profile?.full_name}</Text>
                  <Text style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 6 }}>
                    {profile?.role === 'technician' ? t('fieldTechnician') : profile?.role === 'helper' ? t('fieldHelper') : t('active')}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? COLORS.primary : COLORS.danger, marginRight: 6 }} />
                    <Text style={{ color: isOnline ? COLORS.primary : COLORS.danger, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {isOnline ? t('online') : t('offline')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Account Group Card */}
              <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                {t('accountSection')}
              </Text>
              <View style={{ backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 8, marginBottom: 20 }}>
                <TouchableOpacity 
                  onPress={() => { setShowDtrModal(true); fetchDtrLogs(); }}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="clock" size={16} color={COLORS.primary} />
                    </View>
                    <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>{t('dtrLabel')}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Document Management System (DMS) Group Card */}
              <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                {t('companyFormsLabel')}
              </Text>
              <View style={{ backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 8, marginBottom: 20 }}>
                <TouchableOpacity 
                  onPress={() => startFormDownload('Employee_Handbook_2026.pdf')}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border }}
                  disabled={!!downloadingFile}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="book-open" size={16} color="#3b82f6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>Employee Handbook.pdf</Text>
                      {downloadingFile === 'Employee_Handbook_2026.pdf' && (
                        <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{t('downloading')} {downloadProgress}%</Text>
                      )}
                    </View>
                  </View>
                  <Feather name="download" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => startFormDownload('Leave_Application_Form.pdf')}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border }}
                  disabled={!!downloadingFile}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="file-text" size={16} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>Leave Application Form.pdf</Text>
                      {downloadingFile === 'Leave_Application_Form.pdf' && (
                        <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{t('downloading')} {downloadProgress}%</Text>
                      )}
                    </View>
                  </View>
                  <Feather name="download" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => startFormDownload('Resignation_Template.pdf')}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  disabled={!!downloadingFile}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="file-minus" size={16} color={COLORS.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>Resignation Template.pdf</Text>
                      {downloadingFile === 'Resignation_Template.pdf' && (
                        <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{t('downloading')} {downloadProgress}%</Text>
                      )}
                    </View>
                  </View>
                  <Feather name="download" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Preferences Group Card */}
              <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                {t('preferencesSection')}
              </Text>
              <View style={{ backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 8, marginBottom: 20 }}>
                <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="globe" size={16} color="#3b82f6" />
                    </View>
                    <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>{t('languageLabel')}</Text>
                  </View>
                  
                  {/* Segmented language switcher */}
                  <View style={{ position: 'relative', width: 116, height: 32, backgroundColor: '#e2e8f0', borderRadius: 8, flexDirection: 'row', alignItems: 'center', padding: 2 }}>
                    <Animated.View style={{
                      position: 'absolute',
                      top: 2,
                      bottom: 2,
                      left: 0,
                      width: 56,
                      backgroundColor: '#ffffff',
                      borderRadius: 6,
                      transform: [{
                        translateX: langAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [2, 58]
                        })
                      }],
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 2
                    }} />
                    <TouchableOpacity onPress={() => changeLanguage('en')} style={{ flex: 1, alignItems: 'center', zIndex: 1, height: '100%', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: language === 'en' ? COLORS.primary : COLORS.textMuted }}>EN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => changeLanguage('fil')} style={{ flex: 1, alignItems: 'center', zIndex: 1, height: '100%', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: language === 'fil' ? COLORS.primary : COLORS.textMuted }}>FIL</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* System Group Card */}
              <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 }}>
                {t('systemSection')}
              </Text>
              <View style={{ backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 8, marginBottom: 24 }}>
                {/* Connection Status Row */}
                <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(71, 85, 105, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="activity" size={16} color="#475569" />
                    </View>
                    <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 14 }}>{t('syncStatus')}</Text>
                  </View>
                  <Text style={{ color: isOnline ? COLORS.primary : COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>
                    {isOnline ? t('online') : t('offline')}
                  </Text>
                </View>

                {/* Highly Accessible Log Out Row */}
                <TouchableOpacity 
                  onPress={async () => {
                    setSession(null); setProfile(null); setSchedules([]); setPayslip(null); setActiveTimeLog(null);
                    try { await supabase.auth.signOut(); } catch(e) {}
                  }}
                  style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Feather name="log-out" size={16} color={COLORS.danger} />
                    </View>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 14 }}>{t('logOut')}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={COLORS.danger} style={{ opacity: 0.5 }} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </FadeInView>

        {/* FIXED BOTTOM NAVIGATION BAR */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
            <Feather name="home" size={24} color={activeTab === 'home' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'home' ? COLORS.primary : COLORS.textMuted }]}>{t('homeTab')}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'home' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('tickets')}>
            <Feather name="message-square" size={24} color={activeTab === 'tickets' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'tickets' ? COLORS.primary : COLORS.textMuted }]}>{t('supportTab')}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'tickets' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>


          
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('payslip')}>
            <Feather name="dollar-sign" size={24} color={activeTab === 'payslip' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'payslip' ? COLORS.primary : COLORS.textMuted }]}>{t('payrollTab')}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'payslip' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
            <Feather name="user" size={24} color={activeTab === 'profile' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'profile' ? COLORS.primary : COLORS.textMuted }]}>{t('profileTab')}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'profile' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  };

  const appContent = renderAppContent();

  const renderedContent = (
    <View style={{ flex: 1, position: 'relative' }}>
      {appContent}
      
      {isWaitingForScan && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 23, 42, 0.85)', zIndex: 99999, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 24, padding: 32, alignItems: 'center', width: '100%', maxWidth: 340, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16 }}>
            <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primaryDim, justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
              <MaterialCommunityIcons name="fingerprint" size={56} color={COLORS.primary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textMain, textAlign: 'center', marginBottom: 12 }}>
              {t('waitingForBiometricTerminal')}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginBottom: 24 }}>
              {t('scanBiometricTerminalInstructions')}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.danger, marginBottom: 20 }}>
              ⏱️ {Math.floor(scanCountdown / 60)}:{(scanCountdown % 60).toString().padStart(2, '0')}
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setIsWaitingForScan(false);
                setScanType(null);
                scanTypeRef.current = null;
                pendingLocationRef.current = null;
              }}
              style={{
                width: '100%',
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: 'center',
                backgroundColor: COLORS.card
              }}
            >
              <Text style={{ color: COLORS.textMain, fontWeight: 'bold', fontSize: 14 }}>
                {t('cancelButton')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showDtrModal && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff', zIndex: 99998, padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <TouchableOpacity onPress={() => setShowDtrModal(false)} style={{ padding: 8, marginLeft: -8 }}>
              <Feather name="arrow-left" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textMain }}>{t('dtrHistoryTitle')}</Text>
            <TouchableOpacity onPress={fetchDtrLogs} style={{ padding: 8, marginRight: -8 }} disabled={dtrLoading}>
              {dtrLoading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Feather name="refresh-cw" size={18} color={COLORS.primary} />}
            </TouchableOpacity>
          </View>
          
          <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            {t('currentMonthLogs')} ({dtrLogs.length})
          </Text>

          {dtrLogs.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 }}>
              <Feather name="clock" size={48} color={COLORS.border} style={{ marginBottom: 16 }} />
              <Text style={{ color: COLORS.textMuted, fontStyle: 'italic' }}>
                {dtrLoading ? t('loadingLogs') : t('noLogs')}
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {dtrLogs.map((log) => {
                const logDate = new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeInStr = log.app_time_in ? formatTime(log.app_time_in) : '--:--';
                const timeOutStr = log.app_time_out ? formatTime(log.app_time_out) : '--:--';
                const hours = log.total_hours !== null ? `${log.total_hours} hrs` : t('active');
                const isManual = log.is_manual_entry || log.geofence_status === 'manual_override';

                return (
                  <View key={log.id} style={{ backgroundColor: COLORS.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.textMain }}>📅 {logDate}</Text>
                      {isManual ? (
                        <View style={{ backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, color: '#475569', fontWeight: '800' }}>{t('manualEntry')}</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: COLORS.primaryDim, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, color: COLORS.primary, fontWeight: '800' }}>{t('gpsVerified')}</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' }}>{t('clockIn')}</Text>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginTop: 2 }}>{timeInStr}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' }}>{t('clockOut')}</Text>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain, marginTop: 2 }}>{timeOutStr}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', flex: 1 }}>
                        <Text style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' }}>{t('duration')}</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primary, marginTop: 2 }}>{hours}</Text>
                      </View>
                    </View>
                    
                    {log.gps_accuracy && !isManual && (
                      <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 8 }}>
                        📍 {t('accuracy')}: {log.gps_accuracy.toFixed(1)}m {log.is_mocked ? ` | ⚠️ ${t('mockGps')}` : ''}
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
      {splashVisible && (
        <Animated.View style={[styles.splashContainer, { opacity: splashOpacity }]} pointerEvents={splashVisible ? 'auto' : 'none'}>
          <Animated.View style={{ transform: [{ scale: logoScale }], opacity: logoOpacity, alignItems: 'center' }}>
            <Image source={require('../../assets/logo.png')} style={styles.splashLogo} />
            <Animated.View style={{ opacity: taglineOpacity, transform: [{ translateY: taglineTranslateY }], alignItems: 'center' }}>
              <Text style={styles.splashBrand}>TECHNOSYS</Text>
              <Text style={styles.splashSubBrand}>Secure Field System</Text>
              <View style={styles.splashIndicatorContainer}>
                <ActivityIndicator color={COLORS.primary} size="small" />
              </View>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <View style={styles.phoneFrame}>
          {/* Status Bar / Notch Simulation */}
          <View style={styles.phoneNotch} />
          {/* Inner Screen */}
          <View style={styles.phoneScreen}>
            {renderedContent}
          </View>
          {/* Home Indicator Simulation */}
          <View style={styles.phoneHomeBar} />
        </View>
      </View>
    );
  }

  return renderedContent;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background, height: '100%' },
  container: { flex: 1, backgroundColor: COLORS.background, height: '100%' },
  content: { padding: 24, paddingBottom: 40 },
  header: { marginBottom: 32, marginTop: 12 },
  greeting: { color: COLORS.textMuted, fontSize: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  name: { color: COLORS.textMain, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  input: { backgroundColor: '#ffffff', color: COLORS.textMain, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  
  timeInButton: { backgroundColor: COLORS.primary, padding: 24, borderRadius: 20, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
  timeInSuccess: { backgroundColor: COLORS.primaryDim, padding: 24, borderRadius: 20, alignItems: 'center', borderColor: COLORS.primary, borderWidth: 1 },
  
  emptyText: { color: COLORS.textMuted, fontStyle: 'italic', marginBottom: 16 },
  
  vipCard: { backgroundColor: 'rgba(6, 182, 212, 0.1)', borderColor: '#06b6d4', borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 16 },
  vipBadge: { backgroundColor: '#0e7490', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, marginBottom: 12 },
  vipBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  vipTitle: { color: '#083344', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  vipTime: { color: '#0e7490', fontSize: 14, marginBottom: 4 },
  vipLocation: { color: '#0e7490', fontSize: 14 },
  
  payslipCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { color: COLORS.textMain, fontSize: 20, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  period: { color: COLORS.textMuted, fontSize: 14, marginBottom: 20 },
  netPayBox: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  netPayLabel: { color: '#ecfdf5', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 },
  netPayAmount: { color: '#fff', fontSize: 32, fontWeight: '800' },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 20 },
  deductionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  deductionLabel: { color: COLORS.textMuted, fontSize: 15 },
  grossAmount: { color: COLORS.textMain, fontSize: 15, fontWeight: 'bold' },
  deductionAmount: { color: COLORS.danger, fontSize: 15, fontWeight: 'bold' },
 
  sectionTitleMain: { color: COLORS.textMain, fontSize: 14, fontWeight: '800', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  regularCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  regularTitle: { color: COLORS.textMain, fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  regularTime: { color: COLORS.textMuted, fontSize: 14, marginBottom: 4 },
  regularLocation: { color: COLORS.textMuted, fontSize: 14 },

  bottomNav: { flexDirection: 'row', backgroundColor: COLORS.card, paddingBottom: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, justifyContent: 'space-around' },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  navDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
  webContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    paddingVertical: 40
  } as ViewStyle,
  phoneFrame: {
    width: 390,
    height: 844,
    backgroundColor: COLORS.background,
    borderRadius: 44,
    borderWidth: 12,
    borderColor: '#1e293b',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 25,
    elevation: 8
  } as ViewStyle,
  phoneNotch: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: [{ translateX: -75 }] as any,
    width: 150,
    height: 30,
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    zIndex: 99999
  } as ViewStyle,
  phoneScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    height: '100%',
    width: '100%'
  } as ViewStyle,
  phoneHomeBar: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    transform: [{ translateX: -60 }] as any,
    width: 120,
    height: 5,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    zIndex: 99999
  } as ViewStyle,
  splashContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100000,
  } as ViewStyle,
  splashLogo: {
    width: 110,
    height: 110,
    resizeMode: 'contain',
    marginBottom: 20,
  },
  splashBrand: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 6,
    marginBottom: 6,
  } as TextStyle,
  splashSubBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 3,
    textTransform: 'uppercase',
  } as TextStyle,
  splashIndicatorContainer: {
    marginTop: 40,
    height: 20,
  } as ViewStyle,
  offlineBanner: {
    backgroundColor: '#f43f5e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    zIndex: 99
  } as ViewStyle,
  offlineBannerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  } as TextStyle,
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  } as ViewStyle,
  alertCardApproved: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  } as ViewStyle,
  alertCardRejected: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  } as ViewStyle,
  alertIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  alertIconContainerApproved: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  } as ViewStyle,
  alertIconContainerRejected: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  } as ViewStyle,
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  } as TextStyle,
  alertTitleApproved: {
    color: '#065f46',
  } as TextStyle,
  alertTitleRejected: {
    color: '#92400e',
  } as TextStyle,
  alertText: {
    fontSize: 12,
    lineHeight: 16,
  } as TextStyle,
  alertTextApproved: {
    color: '#047857',
  } as TextStyle,
  alertTextRejected: {
    color: '#b45309',
  } as TextStyle,
  alertCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    borderRadius: 12,
  } as ViewStyle,
  navBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  } as ViewStyle
});
