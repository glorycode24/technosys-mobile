import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput, Alert, ActivityIndicator, Image, Animated, Platform, ViewStyle, TextStyle, RefreshControl, Modal, Linking } from 'react-native';
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

  // Documents / Forms states
  const [docsModalVisible, setDocsModalVisible] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docsSearchQuery, setDocsSearchQuery] = useState('');

  // Holidays Calendar states
  const [holidays, setHolidays] = useState<any[]>([]);
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());
  const [selectedDateString, setSelectedDateString] = useState<string | null>(null);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    if (session) {
      await fetchDashboardData(session.user.id);
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
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncQueueItems, setSyncQueueItems] = useState<any[]>([]);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [syncingNow, setSyncingNow] = useState(false);

  const loadSyncData = async () => {
    const queue = await syncQueue.getQueue();
    const history = await syncQueue.getHistory();
    setSyncQueueItems(queue);
    setSyncHistory(history);
    setOfflineQueueCount(queue.length);
  };

  const handleForceSync = async () => {
    if (syncingNow) return;
    setSyncingNow(true);
    try {
      const res = await syncQueue.syncPendingQueue((item) => {
        if (item.type === 'time_in' || item.type === 'time_out') {
          if (session) fetchDashboardData(session.user.id);
        }
      });
      await loadSyncData();
      if (res.syncedCount > 0) {
        Alert.alert('Sync Successful', `Synchronized ${res.syncedCount} offline transaction(s) with database.`);
      } else if (res.success) {
        Alert.alert('Sync Center', 'No pending items to sync or all items already synced.');
      } else {
        Alert.alert('Sync Failed', 'Could not sync queue. Please check your internet connection.');
      }
    } catch (e: any) {
      Alert.alert('Sync Error', e.message || 'An error occurred during sync.');
    } finally {
      setSyncingNow(false);
    }
  };

  const handleClearHistory = async () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all sync history logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            await syncQueue.clearHistory();
            await loadSyncData();
          }
        }
      ]
    );
  };

  const getQueueItemLabel = (type: string) => {
    switch (type) {
      case 'time_in':
        return 'Clock In';
      case 'time_out':
        return 'Clock Out';
      case 'leave_request':
        return 'Leave Request';
      case 'parts_checkout':
        return 'Parts Checkout';
      default:
        return type;
    }
  };

  const getQueueItemDetails = (item: any) => {
    if (item.type === 'time_in') {
      return `Time: ${new Date(item.payload.app_time_in).toLocaleTimeString()}\nLat/Lng: ${Number(item.payload.latitude).toFixed(4)}, ${Number(item.payload.longitude).toFixed(4)}`;
    }
    if (item.type === 'time_out') {
      return `Worked: ${item.payload.total_hours} hrs`;
    }
    if (item.type === 'leave_request') {
      return `Dates: ${item.payload.start_date} to ${item.payload.end_date}\nReason: ${item.payload.reason}`;
    }
    if (item.type === 'parts_checkout') {
      return `Qty: ${item.payload.quantity}\nMemo: ${item.payload.notes || 'None'}`;
    }
    return JSON.stringify(item.payload);
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
    loadSyncData();

    const interval = setInterval(async () => {
      const queue = await syncQueue.getQueue();
      if (queue.length > 0) {
        console.log('Background checking connection to sync queue...');
        const res = await syncQueue.syncPendingQueue((item) => {
          if (item.type === 'time_in' || item.type === 'time_out') {
            if (session) fetchDashboardData(session.user.id);
          }
        });
        loadSyncData();
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
      const fetchSchedulesPromise = supabase.from('schedules')
        .select(`
          *,
          technician:profiles!technician_id(full_name, role),
          senior_partner:profiles!senior_partner_id(full_name, role)
        `)
        .or(`technician_id.eq.${userId},senior_partner_id.eq.${userId}`)
        .order('start_time', { ascending: true });
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
      const fetchHolidaysPromise = supabase.from('holidays')
        .select('*')
        .eq('is_active', true)
        .order('holiday_date', { ascending: true });

      const [profResult, schedsResult, payslipsResult, logsResult, leavesResult, holidaysResult] = await withTimeout(
        Promise.all([fetchProfilePromise, fetchSchedulesPromise, fetchPayslipsPromise, fetchTimeLogsPromise, fetchLeavesPromise, fetchHolidaysPromise]),
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
      if (holidaysResult.error && isNetworkErr(holidaysResult.error)) throw holidaysResult.error;

      const prof = profResult.data;
      const scheds = schedsResult.data || [];
      const pay = payslipsResult.data;
      const logs = logsResult.data || [];
      const leaves = leavesResult.data || [];
      const hols = holidaysResult.data || [];

      if (prof) setProfile(prof);
      setSchedules(scheds);
      setPayslip(pay);
      setHolidays(hols);

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
        cachedAt: new Date().toISOString(),
        holidays: hols
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
          setHolidays(dashboardCache.holidays || []);
          
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

    // Check if employee is on approved leave today
    try {
      const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const { data: activeLeaves, error: leaveCheckErr } = await supabase
        .from('leaves')
        .select('start_date, end_date, leave_type')
        .eq('technician_id', session.user.id)
        .eq('status', 'approved')
        .lte('start_date', todayDate)
        .gte('end_date', todayDate);

      if (leaveCheckErr) {
        // Log but don't block — if the check fails (RLS, network), allow clock-in to proceed
        // The server-side time_logs RLS will still protect data integrity
        console.warn('Leave conflict check failed (non-fatal):', leaveCheckErr.message, 'code:', leaveCheckErr.code);
      } else if (activeLeaves && activeLeaves.length > 0) {
        const leave = activeLeaves[0];
        Alert.alert(
          'Clock-In Blocked',
          `You have an approved ${leave.leave_type} leave covering today (${leave.start_date} to ${leave.end_date}). You cannot clock in while on leave. Please contact your admin if this is an error.`
        );
        setTimeInLoading(false);
        return;
      }
    } catch (leaveCheckException) {
      console.warn('Leave conflict check threw unexpectedly (non-fatal):', leaveCheckException);
    }

    try {
      // Find today's active schedule for DTR mode validation
      const nowTime = new Date();
      const activeSched = schedules.find(s => {
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        return nowTime >= start && nowTime <= end;
      }) || schedules[0]; // Fallback to first schedule if none covers this exact second

      const trackingMode = activeSched?.attendance_tracking_mode || 'pacita_hq';

      // Step 1: Check geofence
      const locationResult = await geofence.checkLocation();

      let canClockIn = false;
      let finalGeofenceStatus = 'unknown';

      if (trackingMode === 'pacita_hq') {
        if (locationResult && locationResult.status === 'inside') {
          canClockIn = true;
          finalGeofenceStatus = 'inside';
        } else {
          setTimeInLoading(false);
          Alert.alert(
            'Location Verification Failed',
            locationResult?.error || 'You must be at Pacita HQ or QC Branch office to clock in.',
            [{ text: 'OK' }]
          );
          return;
        }
      } else if (trackingMode === 'direct_on_site') {
        if (locationResult && (locationResult.status === 'inside' || locationResult.status === 'outside')) {
          canClockIn = true;
          finalGeofenceStatus = locationResult.status === 'inside' ? 'inside' : 'outside_override';
        } else {
          setTimeInLoading(false);
          Alert.alert(
            'Location Check Failed',
            locationResult?.error || 'Could not verify GPS coordinates for Direct On-site clock-in.',
            [{ text: 'OK' }]
          );
          return;
        }
      } else if (trackingMode === 'out_of_town') {
        canClockIn = true;
        if (locationResult && (locationResult.status === 'inside' || locationResult.status === 'outside')) {
          finalGeofenceStatus = locationResult.status === 'inside' ? 'inside' : 'outside_override';
        } else {
          finalGeofenceStatus = 'unknown';
        }
      }

      const hasLocationData = locationResult && (locationResult.status === 'inside' || locationResult.status === 'outside');
      const timeInPayload = {
        technician_id: session.user.id,
        app_time_in: new Date().toISOString(),
        latitude: hasLocationData ? locationResult.latitude : null,
        longitude: hasLocationData ? locationResult.longitude : null,
        geofence_status: finalGeofenceStatus,
        is_mocked: hasLocationData ? (locationResult.isMocked || false) : false,
        gps_accuracy: hasLocationData ? (locationResult.gpsAccuracy || null) : null
      };

      // Step 2: Insert time log with coordinates
      const { error } = await supabase.from('time_logs').insert(timeInPayload);

      if (error) {
        const errMessage = error.message || '';
        const status = (error as any).status || (error as any).code;
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
            geofence_status: timeInPayload.geofence_status,
            is_offline_pending: true
          };
          setActiveTimeLog(mockLog);
          Alert.alert('Offline Mode Active', 'Logged Clock-In locally. It will synchronize once you regain connectivity.');
          loadSyncData();
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
      // Find today's active schedule for DTR mode validation
      const nowTime = new Date();
      const activeSched = schedules.find(s => {
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        return nowTime >= start && nowTime <= end;
      }) || schedules[0];

      const trackingMode = activeSched?.attendance_tracking_mode || 'pacita_hq';

      // Step 1: Check geofence
      const locationResult = await geofence.checkLocation();

      let canClockOut = false;

      if (trackingMode === 'pacita_hq') {
        if (locationResult && locationResult.status === 'inside') {
          canClockOut = true;
        } else {
          setTimeOutLoading(false);
          Alert.alert(
            'Location Verification Failed',
            locationResult?.error || 'You must be at Pacita HQ or QC Branch office to clock out.',
            [{ text: 'OK' }]
          );
          return;
        }
      } else if (trackingMode === 'direct_on_site') {
        if (locationResult && (locationResult.status === 'inside' || locationResult.status === 'outside')) {
          canClockOut = true;
        } else {
          setTimeOutLoading(false);
          Alert.alert(
            'Location Check Failed',
            locationResult?.error || 'Could not verify GPS coordinates for Direct On-site clock-out.',
            [{ text: 'OK' }]
          );
          return;
        }
      } else if (trackingMode === 'out_of_town') {
        canClockOut = true;
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
        loadSyncData();
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
          loadSyncData();
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

  const formatTime = (isoString: string | null | undefined) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error.message);
      } else {
        const userBranchId = profile?.branch_id;
        const filtered = (data || []).filter((doc: any) => {
          return !doc.branch_id || doc.branch_id === userBranchId;
        });
        setDocuments(filtered);
      }
    } catch (err) {
      console.error('Exception fetching documents:', err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getHolidayForDate = (dateStr: string) => {
    return holidays.find(h => h.holiday_date === dateStr);
  };

  const handlePrevMonth = () => {
    setCurrentCalendarDate(prev => {
      const year = prev.getFullYear();
      const month = prev.getMonth();
      return new Date(year, month - 1, 1);
    });
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(prev => {
      const year = prev.getFullYear();
      const month = prev.getMonth();
      return new Date(year, month + 1, 1);
    });
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
          <TouchableOpacity 
            style={styles.offlineBanner} 
            onPress={() => {
              loadSyncData();
              setSyncModalVisible(true);
            }}
          >
            <Feather name="wifi-off" size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.offlineBannerText}>
              Offline Mode: {offlineQueueCount} sync request{offlineQueueCount > 1 ? 's' : ''} pending (Tap to view)
            </Text>
          </TouchableOpacity>
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View style={styles.vipBadge}>
                      <Text style={styles.vipBadgeText}>URGENT</Text>
                    </View>
                    <View style={{ backgroundColor: 'rgba(6, 182, 212, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: '#083344', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {sched.attendance_tracking_mode ? sched.attendance_tracking_mode.replace(/_/g, ' ') : 'Pacita HQ'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.vipTitle}>{sched.client_name}</Text>
                  <Text style={styles.vipTime}>
                    {formatTime(sched.start_time)}
                    {sched.end_time ? ` - ${formatTime(sched.end_time)}` : ' (Open-Ended)'}
                  </Text>
                  <Text style={styles.vipLocation}><Feather name="map-pin" size={12}/> {sched.location}</Text>
                  {sched.senior_partner_id && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#cffafe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' }}>
                      <Feather name="users" size={12} color="#0891b2" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#0891b2', fontSize: 12, fontWeight: '700' }}>
                        {profile?.role === 'helper' 
                          ? `Lead Tech: ${sched.senior_partner?.full_name}` 
                          : `Helper: ${sched.technician?.full_name}`}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              <Text style={[styles.sectionTitleMain, { marginTop: 24 }]}>Standard Schedule</Text>
              {regularSchedules.length === 0 && <Text style={styles.emptyText}>No standard schedules today.</Text>}
              {regularSchedules.map(sched => (
                <View key={sched.id} style={styles.regularCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.regularTitle}>{sched.client_name}</Text>
                    <View style={{ backgroundColor: 'rgba(0, 0, 0, 0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {sched.attendance_tracking_mode ? sched.attendance_tracking_mode.replace(/_/g, ' ') : 'Pacita HQ'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.regularTime}>
                    {formatTime(sched.start_time)}
                    {sched.end_time ? ` - ${formatTime(sched.end_time)}` : ' (Open-Ended)'}
                  </Text>
                  <Text style={styles.regularLocation}><Feather name="map-pin" size={12}/> {sched.location}</Text>
                  {sched.senior_partner_id && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' }}>
                      <Feather name="users" size={12} color="#64748b" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#475569', fontSize: 12, fontWeight: '700' }}>
                        {profile?.role === 'helper' 
                          ? `Lead Tech: ${sched.senior_partner?.full_name}` 
                          : `Helper: ${sched.technician?.full_name}`}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {/* HOLIDAYS CALENDAR SECTION */}
              <Text style={[styles.sectionTitleMain, { marginTop: 32 }]}>Holiday & Payroll Calendar</Text>
              <View style={styles.calendarCard}>
                {/* Month switcher header */}
                <View style={styles.calendarHeader}>
                  <TouchableOpacity onPress={handlePrevMonth} style={styles.monthNavBtn}>
                    <Feather name="chevron-left" size={20} color={COLORS.textMain} />
                  </TouchableOpacity>
                  <Text style={styles.calendarHeaderTitle}>
                    {currentCalendarDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity onPress={handleNextMonth} style={styles.monthNavBtn}>
                    <Feather name="chevron-right" size={20} color={COLORS.textMain} />
                  </TouchableOpacity>
                </View>

                {/* Weekdays Row */}
                <View style={styles.weekdaysRow}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <Text key={idx} style={styles.weekdayText}>{day}</Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {(() => {
                    const year = currentCalendarDate.getFullYear();
                    const month = currentCalendarDate.getMonth();
                    const daysInMonth = getDaysInMonth(year, month);
                    const firstDayIndex = getFirstDayOfMonth(year, month);

                    const cells = [];
                    // Padding cells
                    for (let i = 0; i < firstDayIndex; i++) {
                      cells.push(<View key={`pad-${i}`} style={styles.calendarCellEmpty} />);
                    }

                    // Active days
                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const holiday = getHolidayForDate(dateStr);
                      const isSelected = selectedDateString === dateStr;

                      const todayObj = new Date();
                      const isToday = todayObj.getFullYear() === year && 
                                      todayObj.getMonth() === month && 
                                      todayObj.getDate() === day;

                      let cellStyle: any[] = [styles.calendarCell];
                      let textStyle: any[] = [styles.calendarCellText];

                      if (holiday) {
                        if (Number(holiday.multiplier) >= 2.00) {
                          cellStyle.push(styles.calendarCellRegularHoliday);
                          textStyle.push(styles.calendarCellTextHoliday);
                        } else {
                          cellStyle.push(styles.calendarCellSpecialHoliday);
                          textStyle.push(styles.calendarCellTextHoliday);
                        }
                      } else if (isToday) {
                        cellStyle.push(styles.calendarCellToday);
                        textStyle.push(styles.calendarCellTextToday);
                      }

                      if (isSelected) {
                        cellStyle.push(styles.calendarCellSelected);
                      }

                      cells.push(
                        <TouchableOpacity
                          key={`day-${day}`}
                          style={cellStyle}
                          onPress={() => setSelectedDateString(dateStr)}
                        >
                          <Text style={textStyle}>{day}</Text>
                          {holiday && (
                            <View style={[
                              styles.holidayDot,
                              { backgroundColor: Number(holiday.multiplier) >= 2.00 ? COLORS.primary : '#d97706' }
                            ]} />
                          )}
                        </TouchableOpacity>
                      );
                    }

                    return cells;
                  })()}
                </View>
              </View>

              {/* Selected date multiplier details */}
              {selectedDateString && (() => {
                const holiday = getHolidayForDate(selectedDateString);
                const displayDate = new Date(selectedDateString).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                });
                const hasBaseSalary = profile?.base_salary && Number(profile.base_salary) > 0;
                const baseSalary = hasBaseSalary ? Number(profile.base_salary) : 0;
                const dailyRate = Number((baseSalary / 22).toFixed(2));
                const multiplier = holiday ? Number(holiday.multiplier) : 1.00;
                const expectedPay = Number((dailyRate * multiplier).toFixed(2));

                return (
                  <View style={styles.multiplierDetailCard}>
                    <View style={styles.multiplierDetailHeader}>
                      <Text style={styles.multiplierDetailDate}>{displayDate}</Text>
                      <TouchableOpacity onPress={() => setSelectedDateString(null)}>
                        <Feather name="x" size={16} color={COLORS.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {holiday ? (
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                          <View style={[
                            styles.holidayBadge,
                            { backgroundColor: multiplier >= 2.00 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }
                          ]}>
                            <Text style={[
                              styles.holidayBadgeText,
                              { color: multiplier >= 2.00 ? COLORS.primary : '#d97706' }
                            ]}>
                              {holiday.name} ({multiplier.toFixed(2)}x)
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.multiplierDesc}>
                          This is a designated company holiday. Working on this day qualifies for a {((multiplier - 1) * 100).toFixed(0)}% salary multiplier premium ({multiplier.toFixed(2)}x base rate).
                        </Text>
                      </View>
                    ) : (
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                          <View style={[styles.holidayBadge, { backgroundColor: 'rgba(100, 116, 139, 0.1)' }]}>
                            <Text style={[styles.holidayBadgeText, { color: COLORS.textMuted }]}>
                              Standard Working Day (1.00x)
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.multiplierDesc}>
                          Standard working day. Hours worked on this day are calculated at regular standard base pay.
                        </Text>
                      </View>
                    )}

                    <View style={styles.divider} />

                    <Text style={styles.calculatorTitle}>Estimated Holiday Pay</Text>
                    {hasBaseSalary ? (
                      <View>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Monthly Base Salary:</Text>
                          <Text style={styles.calcValue}>₱ {baseSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Est. Daily Base Rate (Base ÷ 22 days):</Text>
                          <Text style={styles.calcValue}>₱ {dailyRate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={styles.calcRow}>
                          <Text style={styles.calcLabel}>Salary Multiplier Coefficient:</Text>
                          <Text style={styles.calcValue}>{multiplier.toFixed(2)}x</Text>
                        </View>
                        <View style={[styles.calcRow, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10 }]}>
                          <Text style={[styles.calcLabel, { fontWeight: '800', color: COLORS.textMain }]}>Expected Holiday Pay Rate:</Text>
                          <Text style={[styles.calcValue, { fontWeight: '800', color: COLORS.primary }]}>
                            ₱ {expectedPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                        <Text style={styles.rateCalculationTip}>
                          * Formula: ₱ {dailyRate.toLocaleString('en-US', { minimumFractionDigits: 2 })} × {multiplier.toFixed(2)} = ₱ {expectedPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}. This is an estimate based on standard 22 working days per month. Actual payroll calculations may vary.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginTop: 4 }}>
                        <Text style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 16 }}>
                          ⚠️ Base salary is not set in your employee profile. Set your base salary in the administrator panel to see estimated daily rate calculator details.
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* UPCOMING HOLIDAYS AGENDA VIEW */}
              <View style={styles.upcomingHolidaysCard}>
                <Text style={styles.upcomingHolidaysTitle}>Upcoming Holidays</Text>
                {(() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const upcoming = holidays
                    .filter(h => h.holiday_date >= todayStr)
                    .slice(0, 2);

                  if (upcoming.length === 0) {
                    return (
                      <Text style={{ fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' }}>
                        No upcoming holidays scheduled.
                      </Text>
                    );
                  }

                  return upcoming.map(h => {
                    const hDate = new Date(h.holiday_date);
                    const formattedDate = hDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                    const mult = Number(h.multiplier);

                    return (
                      <View key={h.id} style={styles.upcomingHolidayRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.upcomingHolidayName}>{h.name}</Text>
                          <Text style={styles.upcomingHolidayDate}>{formattedDate}</Text>
                        </View>
                        <View style={[
                          styles.upcomingHolidayMultiplier,
                          { backgroundColor: mult >= 2.00 ? COLORS.primaryDim : 'rgba(245, 158, 11, 0.1)' }
                        ]}>
                          <Text style={[
                            styles.upcomingHolidayMultiplierText,
                            { color: mult >= 2.00 ? COLORS.primary : '#d97706' }
                          ]}>
                            {mult.toFixed(2)}x
                          </Text>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Feather name="file-text" size={20} color={COLORS.primary} />
                    <Text style={styles.sectionTitle}>Latest Payslip</Text>
                  </View>
                  <Text style={styles.period}>Period: {payslip.period_start} to {payslip.period_end}</Text>
                  
                  <View style={styles.netPayBox}>
                    <Text style={styles.netPayLabel}>Net Take-Home Pay</Text>
                    <Text style={styles.netPayAmount}>{formatPhp(payslip.net_pay)}</Text>
                  </View>

                  {/* Section: Earnings & Benefits */}
                  <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.primary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                    Earnings & Benefits
                  </Text>
                  
                  <View style={styles.deductionRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Feather name="briefcase" size={14} color={COLORS.textMuted} />
                      <Text style={styles.deductionLabel}>Base Salary</Text>
                    </View>
                    <Text style={styles.grossAmount}>{formatPhp(payslip.gross_pay)}</Text>
                  </View>

                  <View style={styles.divider} />

                  {/* Section: Statutory Deductions */}
                  <Text style={{ fontSize: 12, fontWeight: '800', color: COLORS.danger, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                    Deductions
                  </Text>

                  <View style={styles.deductionRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Feather name="shield" size={14} color={COLORS.textMuted} />
                      <Text style={styles.deductionLabel}>SSS Contribution</Text>
                    </View>
                    <Text style={styles.deductionAmount}>- {formatPhp(payslip.sss_deduction)}</Text>
                  </View>

                  <View style={styles.deductionRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Feather name="activity" size={14} color={COLORS.textMuted} />
                      <Text style={styles.deductionLabel}>PhilHealth</Text>
                    </View>
                    <Text style={styles.deductionAmount}>- {formatPhp(payslip.philhealth_deduction)}</Text>
                  </View>

                  <View style={styles.deductionRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Feather name="home" size={14} color={COLORS.textMuted} />
                      <Text style={styles.deductionLabel}>Pag-IBIG</Text>
                    </View>
                    <Text style={styles.deductionAmount}>- {formatPhp(payslip.pagibig_deduction)}</Text>
                  </View>

                  <View style={styles.divider} />

                  {/* Breakdown summary */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.textMain }}>Total Deductions</Text>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.danger }}>
                      - {formatPhp(Number(payslip.sss_deduction) + Number(payslip.philhealth_deduction) + Number(payslip.pagibig_deduction))}
                    </Text>
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

                <TouchableOpacity 
                  onPress={() => {
                    fetchDocuments();
                    setDocsModalVisible(true);
                  }} 
                  style={{ backgroundColor: COLORS.card, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'center', marginBottom: 12 }}
                >
                  <Feather name="file-text" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={{ color: COLORS.textMain, fontWeight: 'bold', fontSize: 16 }}>Forms & Documents</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => {
                    loadSyncData();
                    setSyncModalVisible(true);
                  }} 
                  style={{ backgroundColor: COLORS.card, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'center', marginBottom: 12 }}
                >
                  <Feather name="refresh-cw" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={{ color: COLORS.textMain, fontWeight: 'bold', fontSize: 16 }}>Offline Sync Center</Text>
                </TouchableOpacity>

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
      
      {/* FORMS & DOCUMENTS MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={docsModalVisible}
        onRequestClose={() => setDocsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="file-text" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Forms & Documents</Text>
              </View>
              <TouchableOpacity onPress={() => setDocsModalVisible(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Feather name="search" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search documents by name or category..."
                placeholderTextColor={COLORS.textMuted}
                value={docsSearchQuery}
                onChangeText={setDocsSearchQuery}
              />
              {docsSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setDocsSearchQuery('')}>
                  <Feather name="x-circle" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView 
              contentContainerStyle={styles.modalScrollContent}
              refreshControl={
                <RefreshControl
                  refreshing={loadingDocs}
                  onRefresh={fetchDocuments}
                  colors={[COLORS.primary]}
                  tintColor={COLORS.primary}
                />
              }
            >
              {loadingDocs && documents.length === 0 ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 24 }} />
              ) : (
                (() => {
                  const filtered = documents.filter((doc: any) => {
                    const query = docsSearchQuery.toLowerCase();
                    return doc.name.toLowerCase().includes(query) || doc.category.toLowerCase().includes(query);
                  });

                  if (filtered.length === 0) {
                    return (
                      <View style={styles.emptySyncState}>
                        <Feather name="file" size={24} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                        <Text style={styles.emptySyncText}>No documents found.</Text>
                      </View>
                    );
                  }

                  return filtered.map((doc: any) => {
                    let tagColor = 'rgba(100, 116, 139, 0.1)';
                    let textColor = COLORS.textMuted;
                    if (doc.category === 'Leave Form') {
                      tagColor = 'rgba(16, 185, 129, 0.1)';
                      textColor = COLORS.primary;
                    } else if (doc.category === 'Resignation Form') {
                      tagColor = 'rgba(245, 158, 11, 0.1)';
                      textColor = '#f59e0b';
                    } else if (doc.category === 'Company Policy') {
                      tagColor = 'rgba(239, 68, 68, 0.1)';
                      textColor = COLORS.danger;
                    } else if (doc.category === 'Handbook') {
                      tagColor = 'rgba(139, 92, 246, 0.1)';
                      textColor = '#8b5cf6';
                    }

                    return (
                      <View key={doc.id} style={styles.docCard}>
                        <View style={styles.docInfo}>
                          <Text style={styles.docName} numberOfLines={2}>{doc.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 }}>
                            <View style={[styles.docCategoryTag, { backgroundColor: tagColor }]}>
                              <Text style={[styles.docCategoryText, { color: textColor }]}>{doc.category}</Text>
                            </View>
                            <Text style={styles.docSizeText}>{formatBytes(doc.file_size)}</Text>
                          </View>
                        </View>
                        <TouchableOpacity 
                          style={styles.docDownloadBtn} 
                          onPress={async () => {
                            try {
                              const supported = await Linking.canOpenURL(doc.file_url);
                              if (supported) {
                                await Linking.openURL(doc.file_url);
                              } else {
                                Alert.alert('Error', 'Cannot open the file URL: ' + doc.file_url);
                              }
                            } catch (err: any) {
                              Alert.alert('Download Error', err.message || 'Failed to open file.');
                            }
                          }}
                        >
                          <Feather name="download" size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                      </View>
                    );
                  });
                })()
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* OFFLINE SYNC CENTER MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={syncModalVisible}
        onRequestClose={() => setSyncModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="refresh-cw" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Offline Sync Center</Text>
              </View>
              <TouchableOpacity onPress={() => setSyncModalVisible(false)} style={styles.modalCloseButton}>
                <Feather name="x" size={20} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <Text style={styles.syncSectionHeader}>Pending Sync Queue ({syncQueueItems.length})</Text>
              {syncQueueItems.length === 0 ? (
                <View style={styles.emptySyncState}>
                  <Feather name="check-circle" size={24} color={COLORS.primary} style={{ marginBottom: 8 }} />
                  <Text style={styles.emptySyncText}>No pending transactions.</Text>
                </View>
              ) : (
                syncQueueItems.map((item) => (
                  <View key={item.id} style={styles.syncItemCard}>
                    <View style={styles.syncItemRow}>
                      <Text style={styles.syncItemTitle}>{getQueueItemLabel(item.type)}</Text>
                      <View style={[styles.syncBadge, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                        <Text style={[styles.syncBadgeText, { color: '#f59e0b' }]}>Pending</Text>
                      </View>
                    </View>
                    <Text style={styles.syncItemDetails}>{getQueueItemDetails(item)}</Text>
                    <Text style={styles.syncItemTime}>Created: {new Date(item.timestamp).toLocaleString()}</Text>
                  </View>
                ))
              )}

              <Text style={[styles.syncSectionHeader, { marginTop: 24 }]}>Sync History Logs ({syncHistory.length})</Text>
              {syncHistory.length === 0 ? (
                <View style={styles.emptySyncState}>
                  <Feather name="list" size={24} color={COLORS.textMuted} style={{ marginBottom: 8 }} />
                  <Text style={styles.emptySyncText}>No history logs found.</Text>
                </View>
              ) : (
                syncHistory.map((item, idx) => (
                  <View key={item.id || idx} style={styles.syncItemCard}>
                    <View style={styles.syncItemRow}>
                      <Text style={styles.syncItemTitle}>{getQueueItemLabel(item.type)}</Text>
                      <View style={[
                        styles.syncBadge,
                        { backgroundColor: item.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
                      ]}>
                        <Text style={[
                          styles.syncBadgeText,
                          { color: item.status === 'success' ? COLORS.primary : COLORS.danger }
                        ]}>
                          {item.status === 'success' ? 'Success' : 'Failed'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.syncItemDetails}>{getQueueItemDetails(item)}</Text>
                    {item.errorMsg && (
                      <View style={styles.syncErrorContainer}>
                        <Feather name="alert-circle" size={12} color={COLORS.danger} style={{ marginRight: 4, marginTop: 2 }} />
                        <Text style={styles.syncErrorText}>{item.errorMsg}</Text>
                      </View>
                    )}
                    <Text style={styles.syncItemTime}>Synced: {new Date(item.syncedAt).toLocaleString()}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.syncButton, syncingNow && styles.disabledButton]} 
                onPress={handleForceSync}
                disabled={syncingNow}
              >
                {syncingNow ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="refresh-cw" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.syncButtonText}>Force Sync Now</Text>
                  </>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.clearButton, syncHistory.length === 0 && styles.disabledButton]} 
                onPress={handleClearHistory}
                disabled={syncHistory.length === 0}
              >
                <Feather name="trash-2" size={16} color={syncHistory.length === 0 ? COLORS.textMuted : COLORS.danger} style={{ marginRight: 8 }} />
                <Text style={[styles.clearButtonText, { color: syncHistory.length === 0 ? COLORS.textMuted : COLORS.danger }]}>Clear History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  } as ViewStyle,
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  } as ViewStyle,
  modalContent: {
    width: '100%',
    height: '85%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  } as ViewStyle,
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  } as ViewStyle,
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.5,
  } as TextStyle,
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
  } as ViewStyle,
  modalScrollContent: {
    padding: 24,
    paddingBottom: 40,
  } as ViewStyle,
  syncSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  } as TextStyle,
  emptySyncState: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  emptySyncText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,
  syncItemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  } as ViewStyle,
  syncItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  } as ViewStyle,
  syncItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  } as TextStyle,
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  } as ViewStyle,
  syncBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
  syncItemDetails: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 6,
  } as TextStyle,
  syncItemTime: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  } as TextStyle,
  syncErrorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
  } as ViewStyle,
  syncErrorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.danger,
    lineHeight: 16,
    fontWeight: '600',
  } as TextStyle,
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: '#ffffff',
    gap: 12,
  } as ViewStyle,
  syncButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  } as ViewStyle,
  syncButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  } as TextStyle,
  clearButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  clearButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
  } as TextStyle,
  disabledButton: {
    opacity: 0.5,
    shadowOpacity: 0,
  } as ViewStyle,
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginHorizontal: 24,
    marginTop: 16,
    height: 44,
  } as ViewStyle,
  searchInput: {
    flex: 1,
    color: COLORS.textMain,
    fontSize: 14,
    padding: 0,
  } as TextStyle,
  docCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  docInfo: {
    flex: 1,
    marginRight: 12,
  } as ViewStyle,
  docName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  } as TextStyle,
  docCategoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  } as ViewStyle,
  docCategoryText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
  docSizeText: {
    fontSize: 11,
    color: COLORS.textMuted,
  } as TextStyle,
  docDownloadBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  } as ViewStyle,
  calendarCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  } as ViewStyle,
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  } as ViewStyle,
  calendarHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
    letterSpacing: -0.5,
  } as TextStyle,
  monthNavBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: COLORS.border,
  } as ViewStyle,
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
    marginBottom: 8,
  } as ViewStyle,
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  } as TextStyle,
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  } as ViewStyle,
  calendarCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderRadius: 20,
    position: 'relative',
  } as ViewStyle,
  calendarCellEmpty: {
    width: '14.28%',
    height: 40,
  } as ViewStyle,
  calendarCellText: {
    fontSize: 13,
    color: COLORS.textMain,
    fontWeight: '600',
  } as TextStyle,
  calendarCellRegularHoliday: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  } as ViewStyle,
  calendarCellSpecialHoliday: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  } as ViewStyle,
  calendarCellToday: {
    borderWidth: 1.5,
    borderColor: COLORS.textMain,
  } as ViewStyle,
  calendarCellSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  } as ViewStyle,
  calendarCellTextHoliday: {
    fontWeight: '800',
  } as TextStyle,
  calendarCellTextToday: {
    fontWeight: '800',
  } as TextStyle,
  holidayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 4,
  } as ViewStyle,
  multiplierDetailCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  } as ViewStyle,
  multiplierDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  } as ViewStyle,
  multiplierDetailDate: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMain,
  } as TextStyle,
  holidayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  } as ViewStyle,
  holidayBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as TextStyle,
  multiplierDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  } as TextStyle,
  calculatorTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 10,
  } as TextStyle,
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  } as ViewStyle,
  calcLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  } as TextStyle,
  calcValue: {
    fontSize: 13,
    color: COLORS.textMain,
    fontWeight: '600',
  } as TextStyle,
  rateCalculationTip: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 15,
  } as TextStyle,
  upcomingHolidaysCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 32,
  } as ViewStyle,
  upcomingHolidaysTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: 12,
  } as TextStyle,
  upcomingHolidayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  } as ViewStyle,
  upcomingHolidayName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  } as TextStyle,
  upcomingHolidayDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  } as TextStyle,
  upcomingHolidayMultiplier: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  } as ViewStyle,
  upcomingHolidayMultiplierText: {
    fontSize: 11,
    fontWeight: '800',
  } as TextStyle,
});
