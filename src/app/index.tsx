import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput, Alert, ActivityIndicator, Image, Animated, Platform, ViewStyle, TextStyle, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { Feather } from '@expo/vector-icons';
import { useGeofence } from '../hooks/useGeofence';
import { TicketsTab } from '../components/TicketsTab';
import { syncQueue } from '../lib/syncQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '../lib/timeout';


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

  const handleLogin = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      Alert.alert('Login Failed', error.message);
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
  const [profile, setProfile] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [payslip, setPayslip] = useState<any>(null);
  const [timeInLoading, setTimeInLoading] = useState(false);
  const [timeOutLoading, setTimeOutLoading] = useState(false);
  const [activeTimeLog, setActiveTimeLog] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'payslip' | 'profile' | 'tickets'>('home');
  const geofence = useGeofence();

  // Leaves alerts and refreshing states
  const [recentLeaveAlerts, setRecentLeaveAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Load recent alerts
  const loadRecentAlerts = async (userId: string) => {
    try {
      const stored = await AsyncStorage.getItem('UNREAD_LEAVE_ALERTS_' + userId);
      if (stored) {
        setRecentLeaveAlerts(JSON.parse(stored));
      } else {
        setRecentLeaveAlerts([]);
      }
    } catch (err) {
      console.error('Failed to load recent leave alerts:', err);
    }
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
    // 1. Fetch auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchDashboardData(session.user.id);
        loadRecentAlerts(session.user.id);
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchDashboardData(session.user.id);
        loadRecentAlerts(session.user.id);
      } else {
        setRecentLeaveAlerts([]);
      }
    });

    // 2. Play opening transition animation
    Animated.sequence([
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
      ]),
      Animated.delay(1000), // Hold for 1 second
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSplashVisible(false);
    });
  }, []);

  // Offline sync loop
  useEffect(() => {
    checkQueueStatus();

    const interval = setInterval(async () => {
      const queue = await syncQueue.getQueue();
      if (queue.length > 0) {
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

  const fetchDashboardData = async (userId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const fetchProfilePromise = supabase.from('profiles').select('*').eq('id', userId).single();
      const fetchSchedulesPromise = supabase.from('schedules').select('*').eq('technician_id', userId).order('start_time', { ascending: true });
      const fetchPayslipsPromise = supabase.from('payslips').select('*').eq('technician_id', userId).eq('status', 'published').order('created_at', { ascending: false }).limit(1).single();
      const fetchTimeLogsPromise = supabase.from('time_logs')
        .select('*')
        .eq('technician_id', userId)
        .gte('created_at', `${today}T00:00:00Z`)
        .order('created_at', { ascending: false });
      const fetchLeavesPromise = supabase.from('leaves')
        .select('*')
        .eq('technician_id', userId)
        .order('created_at', { ascending: false });

      const [profResult, schedsResult, payslipsResult, logsResult, leavesResult] = await withTimeout(
        Promise.all([fetchProfilePromise, fetchSchedulesPromise, fetchPayslipsPromise, fetchTimeLogsPromise, fetchLeavesPromise]),
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
      if (leavesResult.error && isNetworkErr(leavesResult.error)) throw leavesResult.error;

      const prof = profResult.data;
      const scheds = schedsResult.data || [];
      const pay = payslipsResult.data;
      const logs = logsResult.data || [];
      const leaves = leavesResult.data || [];

      if (prof) setProfile(prof);
      setSchedules(scheds);
      setPayslip(pay);

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
        cachedAt: new Date().toISOString()
      };
      await AsyncStorage.setItem('CACHED_DASHBOARD_' + userId, JSON.stringify(dashboardCache));
    } catch (e: any) {
      console.warn("Failed to load dashboard data from network, trying cache:", e.message);
      try {
        const cached = await AsyncStorage.getItem('CACHED_DASHBOARD_' + userId);
        if (cached) {
          const dashboardCache = JSON.parse(cached);
          if (dashboardCache.profile) setProfile(dashboardCache.profile);
          setSchedules(dashboardCache.schedules || []);
          setPayslip(dashboardCache.payslip);
          
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
    }
  };

  const handleTimeIn = async () => {
    if (!session) return;
    setTimeInLoading(true);

    try {
      // Step 1: Check geofence
      const locationResult = await geofence.checkLocation();

      if (!locationResult || locationResult.status !== 'inside') {
        setTimeInLoading(false);
        Alert.alert(
          'Location Verification Failed',
          locationResult?.error || 'Could not verify your location. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      const timeInPayload = {
        technician_id: session.user.id,
        app_time_in: new Date().toISOString(),
        latitude: locationResult.latitude,
        longitude: locationResult.longitude,
        geofence_status: 'inside',
        is_mocked: locationResult.isMocked || false,
        gps_accuracy: locationResult.gpsAccuracy || null
      };

      // Step 2: Insert time log with coordinates
      const { error } = await supabase.from('time_logs').insert(timeInPayload);

      if (error) {
        const errMessage = error.message || '';
        const status = (error as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
        
        if (isNetworkError) {
          // Store in offline sync queue
          await syncQueue.addToQueue('time_in', timeInPayload);
          // Set mock time log locally so user is clocked in
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
          Alert.alert('Offline Mode Active', 'Logged Clock-In locally. It will synchronize once you regain connectivity.');
          checkQueueStatus();
          return;
        }
        throw error;
      }

      // Refresh dashboard to pull active log
      await fetchDashboardData(session.user.id);
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
      // Step 1: Check geofence
      const locationResult = await geofence.checkLocation();

      if (!locationResult || locationResult.status !== 'inside') {
        setTimeOutLoading(false);
        Alert.alert(
          'Location Verification Failed',
          locationResult?.error || 'Could not verify your location. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Step 2: Calculate total hours
      const timeOutTime = new Date().toISOString();
      const timeInMs = new Date(activeTimeLog.app_time_in).getTime();
      const timeOutMs = new Date(timeOutTime).getTime();
      const diffHours = Number(((timeOutMs - timeInMs) / (1000 * 60 * 60)).toFixed(2));

      const isOfflinePending = activeTimeLog.is_offline_pending;

      if (isOfflinePending) {
        // Find the queued time_in item and merge clock-out details
        const queue = await syncQueue.getQueue();
        const timeInItemIndex = queue.findIndex(item => item.type === 'time_in' && item.payload.app_time_in === activeTimeLog.app_time_in);
        
        if (timeInItemIndex !== -1) {
          queue[timeInItemIndex].payload.app_time_out = timeOutTime;
          queue[timeInItemIndex].payload.total_hours = diffHours;
          await AsyncStorage.setItem('OFFLINE_TRANSACTION_QUEUE', JSON.stringify(queue));
        } else {
          // Fallback queue
          await syncQueue.addToQueue('time_out', {
            log_id: activeTimeLog.id,
            app_time_out: timeOutTime,
            total_hours: diffHours
          });
        }
        
        setActiveTimeLog((prev: any) => ({
          ...prev,
          app_time_out: timeOutTime,
          total_hours: diffHours
        }));
        Alert.alert('Offline Mode Active', `Logged Clock-Out locally. Worked ${diffHours} hrs. Will sync on reconnection.`);
        checkQueueStatus();
        return;
      }

      // Step 3: Update time log with coordinates, app_time_out and total_hours
      const { error } = await supabase.from('time_logs')
        .update({
          app_time_out: timeOutTime,
          total_hours: diffHours
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
            total_hours: diffHours
          });
          setActiveTimeLog((prev: any) => ({
            ...prev,
            app_time_out: timeOutTime,
            total_hours: diffHours
          }));
          Alert.alert('Offline Mode Active', `Logged Clock-Out locally. Worked ${diffHours} hrs. Will sync on reconnection.`);
          checkQueueStatus();
          return;
        }
        throw error;
      }

      Alert.alert('Time-Out Verified', `Shift completed. Total hours: ${diffHours} hrs.`);
      await fetchDashboardData(session.user.id);
    } catch (e: any) {
      Alert.alert('Time Out Failed', e.message || 'An error occurred.');
    } finally {
      setTimeOutLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!session) return;
    setRefreshing(true);
    await fetchDashboardData(session.user.id);
    setRefreshing(false);
  };

  const handleDismissAlert = async (id: string) => {
    if (!session) return;
    try {
      const updated = recentLeaveAlerts.filter((a: any) => a.id !== id);
      setRecentLeaveAlerts(updated);
      await AsyncStorage.setItem('UNREAD_LEAVE_ALERTS_' + session.user.id, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
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
              Offline Mode: {offlineQueueCount} sync request{offlineQueueCount > 1 ? 's' : ''} pending...
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
                  <Text style={styles.greeting}>Welcome back,</Text>
                  <Text style={styles.name}>{profile?.full_name || 'Technician'}</Text>
                </View>
                <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
              </View>

              {recentLeaveAlerts.map((alert: any) => (
                <View 
                  key={alert.id} 
                  style={[
                    styles.alertCard, 
                    alert.type === 'approved' ? styles.alertCardApproved : styles.alertCardRejected
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1, paddingRight: 8 }}>
                    <View style={[
                      styles.alertIconContainer, 
                      alert.type === 'approved' ? styles.alertIconContainerApproved : styles.alertIconContainerRejected
                    ]}>
                      <Feather 
                        name={alert.type === 'approved' ? 'check-circle' : 'x-circle'} 
                        size={20} 
                        color={alert.type === 'approved' ? '#10b981' : '#ef4444'} 
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[
                        styles.alertTitle, 
                        alert.type === 'approved' ? styles.alertTitleApproved : styles.alertTitleRejected
                      ]}>
                        {alert.type === 'approved' ? 'Leave Request Approved' : 'Leave Request Rejected'}
                      </Text>
                      <Text style={[
                        styles.alertText, 
                        alert.type === 'approved' ? styles.alertTextApproved : styles.alertTextRejected
                      ]}>
                        Your leave request for {alert.startDate} to {alert.endDate} has been {alert.type}.
                        {alert.reason ? ` Reason: "${alert.reason}"` : ''}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={styles.alertCloseButton} 
                    onPress={() => handleDismissAlert(alert.id)}
                  >
                    <Feather 
                      name="x" 
                      size={16} 
                      color={alert.type === 'approved' ? '#047857' : '#b91c1c'} 
                    />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={{ marginBottom: 32 }}>
                {!activeTimeLog && (
                  <TouchableOpacity style={styles.timeInButton} onPress={handleTimeIn} disabled={timeInLoading}>
                    {timeInLoading ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Feather name="map-pin" size={28} color="#fff" style={{ marginBottom: 8 }} />
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 4 }}>CLOCK IN NOW</Text>
                        <Text style={{ color: '#ecfdf5', fontSize: 12 }}>📍 Location will be verified</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {activeTimeLog && !activeTimeLog.app_time_out && (
                  <View>
                    <View style={styles.timeInSuccess}>
                      <Feather name="check-circle" size={22} color={COLORS.primary} style={{ marginBottom: 6 }} />
                      <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 15 }}>✅ Clock-In Verified</Text>
                      <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 2 }}>
                        Logged at {new Date(activeTimeLog.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, marginBottom: 2 }}>CLOCK OUT NOW</Text>
                          <Text style={{ color: '#fee2e2', fontSize: 11 }}>📍 Location will be verified</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {activeTimeLog && activeTimeLog.app_time_out && (
                  <View style={[styles.timeInSuccess, { borderColor: COLORS.textMuted, backgroundColor: '#f1f5f9' }]}>
                    <Feather name="lock" size={22} color={COLORS.textMuted} style={{ marginBottom: 6 }} />
                    <Text style={{ color: COLORS.textMain, fontWeight: 'bold', fontSize: 15 }}>🔒 Shift Completed Today</Text>
                    <Text style={{ color: COLORS.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                      Worked {activeTimeLog.total_hours} hrs ({new Date(activeTimeLog.app_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activeTimeLog.app_time_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionTitleMain}>Priority Dispatch</Text>
              {vipSchedules.length === 0 && <Text style={styles.emptyText}>No VIP hooks active.</Text>}
              {vipSchedules.map(sched => (
                <View key={sched.id} style={styles.vipCard}>
                  <View style={styles.vipBadge}>
                    <Text style={styles.vipBadgeText}>URGENT</Text>
                  </View>
                  <Text style={styles.vipTitle}>{sched.client_name}</Text>
                  <Text style={styles.vipTime}>{formatTime(sched.start_time)} - {formatTime(sched.end_time)}</Text>
                  <Text style={styles.vipLocation}><Feather name="map-pin" size={12}/> {sched.location}</Text>
                </View>
              ))}

              <Text style={[styles.sectionTitleMain, { marginTop: 24 }]}>Standard Schedule</Text>
              {regularSchedules.length === 0 && <Text style={styles.emptyText}>No standard schedules today.</Text>}
              {regularSchedules.map(sched => (
                <View key={sched.id} style={styles.regularCard}>
                  <Text style={styles.regularTitle}>{sched.client_name}</Text>
                  <Text style={styles.regularTime}>{formatTime(sched.start_time)} - {formatTime(sched.end_time)}</Text>
                  <Text style={styles.regularLocation}><Feather name="map-pin" size={12}/> {sched.location}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {activeTab === 'payslip' && (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={styles.name}>My Earnings</Text>
                <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
              </View>
              {payslip ? (
                <View style={styles.payslipCard}>
                  <Text style={styles.sectionTitle}>Latest Payslip</Text>
                  <Text style={styles.period}>Generated: {payslip.period_start}</Text>
                  
                  <View style={styles.netPayBox}>
                    <Text style={styles.netPayLabel}>Net Take-Home Pay</Text>
                    <Text style={styles.netPayAmount}>{formatPhp(payslip.net_pay)}</Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.deductionRow}>
                    <Text style={styles.deductionLabel}>Base Salary</Text>
                    <Text style={styles.grossAmount}>{formatPhp(payslip.gross_pay)}</Text>
                  </View>
                  <View style={styles.deductionRow}>
                    <Text style={styles.deductionLabel}>SSS Contribution</Text>
                    <Text style={styles.deductionAmount}>- {formatPhp(payslip.sss_deduction)}</Text>
                  </View>
                  <View style={styles.deductionRow}>
                    <Text style={styles.deductionLabel}>PhilHealth</Text>
                    <Text style={styles.deductionAmount}>- {formatPhp(payslip.philhealth_deduction)}</Text>
                  </View>
                  <View style={styles.deductionRow}>
                    <Text style={styles.deductionLabel}>Pag-IBIG</Text>
                    <Text style={styles.deductionAmount}>- {formatPhp(payslip.pagibig_deduction)}</Text>
                  </View>
                </View>
              ) : (
                 <View style={[styles.payslipCard, { alignItems: 'center', paddingVertical: 60 }]}>
                   <Feather name="file-text" size={48} color={COLORS.border} style={{ marginBottom: 16 }} />
                   <Text style={{ color: COLORS.textMuted }}>No published payslips found.</Text>
                 </View>
              )}
            </ScrollView>
          )}

          {activeTab === 'tickets' && (
            <TicketsTab userId={session.user.id} fullName={profile?.full_name || 'Technician'} />
          )}




          {activeTab === 'profile' && (
            <ScrollView contentContainerStyle={styles.content}>
               <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={styles.name}>Profile & Settings</Text>
                <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
              </View>
              <View style={styles.regularCard}>
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                  <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryDim, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Text style={{ color: COLORS.primary, fontSize: 32, fontWeight: 'bold' }}>{profile?.full_name?.charAt(0) || 'T'}</Text>
                  </View>
                  <Text style={{ color: COLORS.textMain, fontSize: 20, fontWeight: 'bold' }}>{profile?.full_name}</Text>
                  <Text style={{ color: COLORS.primary, fontSize: 14 }}>{profile?.role === 'technician' ? 'Field Technician' : 'Staff'}</Text>
                </View>

                <TouchableOpacity onPress={async () => {
                  setSession(null); setProfile(null); setSchedules([]); setPayslip(null); setActiveTimeLog(null);
                  try { await supabase.auth.signOut(); } catch(e) {}
                }} style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(244, 63, 94, 0.2)', flexDirection: 'row', justifyContent: 'center' }}>
                  <Feather name="log-out" size={20} color={COLORS.danger} style={{ marginRight: 8 }} />
                  <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 16 }}>Log Out</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </FadeInView>

        {/* FIXED BOTTOM NAVIGATION BAR */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
            <Feather name="home" size={24} color={activeTab === 'home' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'home' ? COLORS.primary : COLORS.textMuted }]}>Home</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'home' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('tickets')}>
            <View style={{ position: 'relative' }}>
              <Feather name="message-square" size={24} color={activeTab === 'tickets' ? COLORS.primary : COLORS.textMuted} />
              {recentLeaveAlerts.length > 0 && (
                <View style={styles.navBadge} />
              )}
            </View>
            <Text style={[styles.navText, { color: activeTab === 'tickets' ? COLORS.primary : COLORS.textMuted }]}>Support</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'tickets' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>


          
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('payslip')}>
            <Feather name="dollar-sign" size={24} color={activeTab === 'payslip' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'payslip' ? COLORS.primary : COLORS.textMuted }]}>Payroll</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'payslip' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
            <Feather name="user" size={24} color={activeTab === 'profile' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'profile' ? COLORS.primary : COLORS.textMuted }]}>Profile</Text>
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
