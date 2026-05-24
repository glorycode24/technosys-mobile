import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, TextInput, Alert, ActivityIndicator, Image, Animated } from 'react-native';
import { supabase } from '../lib/supabase';
import { Feather } from '@expo/vector-icons';

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

  React.useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [currentTab]);

  return <Animated.View style={{ flex: 1, opacity: fadeAnim }}>{children}</Animated.View>;
};

const LoginScreen = ({ onLogin }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (window?.alert) window.alert('Login Failed: ' + error.message);
    } else {
      onLogin(data.session);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { justifyContent: 'center', padding: 24 }]}>
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <Image source={require('../../assets/logo.png')} style={{ width: 120, height: 120, resizeMode: 'contain', marginBottom: 8 }} />
          <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600', letterSpacing: 2 }}>EMPLOYEE PORTAL</Text>
        </View>
        
        <View style={{ backgroundColor: COLORS.card, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 }}>
          <Text style={{ color: COLORS.textMain, marginBottom: 8, fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>Email Address</Text>
          <TextInput 
            style={styles.input}
            placeholder="employee@technocycle.com"
            placeholderTextColor={COLORS.textMuted}
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={{ color: COLORS.textMain, marginBottom: 8, fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>Password</Text>
          <TextInput 
            style={[styles.input, { marginBottom: 32 }]}
            placeholder="••••••••"
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity 
            style={{ backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Secure Login</Text>}
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
  const [hasTimedIn, setHasTimedIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'payslip' | 'profile'>('home');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchDashboardData(session.user.id);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchDashboardData(session.user.id);
    });
  }, []);

  const fetchDashboardData = async (userId: string) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (prof) setProfile(prof);

    const { data: scheds } = await supabase.from('schedules').select('*').eq('technician_id', userId).order('start_time', { ascending: true });
    if (scheds) setSchedules(scheds);

    const { data: pay } = await supabase.from('payslips').select('*').eq('technician_id', userId).eq('status', 'published').order('created_at', { ascending: false }).limit(1).single();
    if (pay) setPayslip(pay);

    const today = new Date().toISOString().split('T')[0];
    const { data: logs } = await supabase.from('time_logs')
      .select('*')
      .eq('technician_id', userId)
      .gte('created_at', `${today}T00:00:00Z`);
    
    if (logs && logs.length > 0) setHasTimedIn(true);
  };

  const handleTimeIn = async () => {
    if (!session) return;
    setTimeInLoading(true);
    const { error } = await supabase.from('time_logs').insert({
      technician_id: session.user.id,
      app_time_in: new Date().toISOString()
    });

    if (error) {
      if (window?.alert) window.alert("Time In Failed: " + error.message);
    } else {
      setHasTimedIn(true);
    }
    setTimeInLoading(false);
  };

  const formatPhp = (amount: number) => {
    if (!amount) return '₱ 0.00';
    return `₱ ${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  const vipSchedules = schedules.filter(s => s.is_vip_hook);
  const regularSchedules = schedules.filter(s => !s.is_vip_hook);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Dynamic Main Content Based on Tab */}
      <FadeInView currentTab={activeTab}>
        {activeTab === 'home' && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <View>
                <Text style={styles.greeting}>Welcome back,</Text>
                <Text style={styles.name}>{profile?.full_name || 'Technician'}</Text>
              </View>
              <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
            </View>

            <View style={{ marginBottom: 32 }}>
              {hasTimedIn ? (
                <View style={styles.timeInSuccess}>
                  <Feather name="check-circle" size={24} color={COLORS.primary} style={{ marginBottom: 8 }} />
                  <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 16 }}>App Time-In Verified</Text>
                  <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4 }}>Proceed to fingerprint terminal.</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.timeInButton} onPress={handleTimeIn} disabled={timeInLoading}>
                  {timeInLoading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Feather name="clock" size={28} color="#fff" style={{ marginBottom: 8 }} />
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20, marginBottom: 4 }}>CLOCK IN NOW</Text>
                      <Text style={{ color: '#ecfdf5', fontSize: 12 }}>Step 1: App | Step 2: Biometrics</Text>
                    </>
                  )}
                </TouchableOpacity>
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
                setSession(null); setProfile(null); setSchedules([]); setPayslip(null); setHasTimedIn(false);
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
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('payslip')}>
          <Feather name="dollar-sign" size={24} color={activeTab === 'payslip' ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.navText, { color: activeTab === 'payslip' ? COLORS.primary : COLORS.textMuted }]}>Payroll</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
          <Feather name="user" size={24} color={activeTab === 'profile' ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.navText, { color: activeTab === 'profile' ? COLORS.primary : COLORS.textMuted }]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  header: { marginBottom: 32, marginTop: 12 },
  greeting: { color: COLORS.textMuted, fontSize: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  name: { color: COLORS.textMain, fontSize: 32, fontWeight: '900', letterSpacing: -0.5 },
  input: { backgroundColor: '#ffffff', color: COLORS.textMain, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  
  timeInButton: { backgroundColor: COLORS.primary, padding: 24, borderRadius: 20, alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
  timeInSuccess: { backgroundColor: COLORS.primaryDim, padding: 24, borderRadius: 20, alignItems: 'center', borderColor: COLORS.primary, borderWidth: 1 },
  
  emptyText: { color: COLORS.textMuted, fontStyle: 'italic', marginBottom: 16 },
  
  vipCard: { backgroundColor: 'rgba(6, 182, 212, 0.1)', borderColor: '#06b6d4', borderWidth: 1, borderRadius: 16, padding: 20, marginBottom: 16 },
  vipBadge: { backgroundColor: '#06b6d4', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, marginBottom: 12 },
  vipBadgeText: { color: '#083344', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  vipTitle: { color: '#cffafe', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  vipTime: { color: '#67e8f9', fontSize: 14, marginBottom: 4 },
  vipLocation: { color: '#67e8f9', fontSize: 14 },
  
  payslipCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { color: COLORS.textMain, fontSize: 20, fontWeight: '900', marginBottom: 4, letterSpacing: -0.5 },
  period: { color: COLORS.textMuted, fontSize: 14, marginBottom: 20 },
  netPayBox: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
  netPayLabel: { color: '#ecfdf5', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 },
  netPayAmount: { color: '#fff', fontSize: 32, fontWeight: '900' },
  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 20 },
  deductionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  deductionLabel: { color: COLORS.textMuted, fontSize: 15 },
  grossAmount: { color: COLORS.textMain, fontSize: 15, fontWeight: 'bold' },
  deductionAmount: { color: COLORS.danger, fontSize: 15, fontWeight: 'bold' },

  sectionTitleMain: { color: COLORS.textMain, fontSize: 14, fontWeight: 'bold', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 },
  regularCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  regularTitle: { color: COLORS.textMain, fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  regularTime: { color: COLORS.textMuted, fontSize: 14, marginBottom: 4 },
  regularLocation: { color: COLORS.textMuted, fontSize: 14 },

  bottomNav: { flexDirection: 'row', backgroundColor: COLORS.card, paddingBottom: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border, justifyContent: 'space-around' },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 11, fontWeight: '600', marginTop: 4 }
});
