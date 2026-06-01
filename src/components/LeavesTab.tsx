import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '../lib/supabase';
import { Feather } from '@expo/vector-icons';
import { syncQueue } from '../lib/syncQueue';

// Matching theme constants from index.tsx
const COLORS = {
  background: '#ffffff',
  card: '#f8fafc',
  primary: '#10b981',
  primaryDim: 'rgba(16, 185, 129, 0.1)',
  textMain: '#0f172a',
  textMuted: '#64748b',
  danger: '#ef4444',
  border: '#e2e8f0',
  warning: '#f59e0b',
  info: '#3b82f6'
};

interface LeavesTabProps {
  userId: string;
  fullName: string;
}

export function LeavesTab({ userId, fullName }: LeavesTabProps) {
  const [leavesList, setLeavesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState<'sick' | 'vacation' | 'emergency' | 'unpaid'>('sick');
  const [reason, setReason] = useState('');

  // Fetch leaves from database + merge offline queued items
  const fetchLeaves = async () => {
    try {
      // 1. Fetch DB leaves
      const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('technician_id', userId)
        .order('created_at', { ascending: false });

      let dbLeaves = data || [];
      if (error) {
        console.warn('Could not fetch leaves from DB (probably offline):', error.message);
        dbLeaves = [];
      }

      // 2. Fetch offline queue items
      const queue = await syncQueue.getQueue();
      const offlineLeaves = queue
        .filter(item => item.type === 'leave_request' && item.payload.technician_id === userId)
        .map(item => ({
          id: 'offline-' + item.id,
          technician_id: userId,
          start_date: item.payload.start_date,
          end_date: item.payload.end_date,
          leave_type: item.payload.leave_type,
          reason: item.payload.reason,
          status: 'sync_pending',
          created_at: item.timestamp
        }));

      // Merge: Offline items go to the top
      setLeavesList([...offlineLeaves, ...dbLeaves]);
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [userId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaves();
  };

  // Preset Date Autocompleters
  const applyPreset = (daysAhead: number, duration: number) => {
    const today = new Date();
    
    const start = new Date(today);
    start.setDate(today.getDate() + daysAhead);
    
    const end = new Date(start);
    end.setDate(start.getDate() + duration - 1);

    const format = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    setStartDate(format(start));
    setEndDate(format(end));
  };

  // Submit Leave Request
  const handleSubmit = async () => {
    if (!startDate || !endDate || !reason.trim()) {
      Alert.alert('Incomplete Form', 'Please fill in all fields.');
      return;
    }

    // Basic format validation: YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      Alert.alert('Invalid Date Format', 'Dates must be formatted as YYYY-MM-DD.');
      return;
    }

    // Logical date range check
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      Alert.alert('Invalid Dates', 'Please enter valid date values.');
      return;
    }

    if (end < start) {
      Alert.alert('Invalid Date Range', 'End Date must be on or after Start Date.');
      return;
    }

    const payload = {
      technician_id: userId,
      start_date: startDate,
      end_date: endDate,
      leave_type: leaveType,
      reason: reason.trim()
    };

    setSubmitting(true);

    try {
      const { error } = await supabase.from('leaves').insert(payload);

      if (error) {
        const errMessage = error.message || '';
        const status = (error as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;

        if (isNetworkError) {
          // Add to offline sync queue
          await syncQueue.addToQueue('leave_request', payload);
          Alert.alert(
            'Offline Mode Active',
            'Your leave request has been saved locally. It will synchronize automatically once you are connected to the network.'
          );
          // Reset form
          setReason('');
          fetchLeaves();
          return;
        }
        throw error;
      }

      Alert.alert('Success', 'Leave request filed successfully.');
      setReason('');
      fetchLeaves();
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Could not submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helpers for Badges
  const getLeaveTypeDetails = (type: string) => {
    switch (type) {
      case 'sick':
        return { label: 'Sick', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'vacation':
        return { label: 'Vacation', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'emergency':
        return { label: 'Emergency', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'unpaid':
      default:
        return { label: 'Unpaid', color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' };
    }
  };

  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: 'Approved', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'rejected':
        return { label: 'Rejected', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
      case 'sync_pending':
        return { label: 'Sync Pending', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', isSync: true };
      case 'pending':
      default:
        return { label: 'Pending', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
    }
  };

  const calculateDuration = (startStr: string, endStr: string) => {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diff = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>File Leave Request</Text>
        <Text style={styles.subtitle}>Technician Onboarding Portal</Text>
      </View>

      {/* LEAVE FILING FORM */}
      <View style={styles.card}>
        <Text style={styles.label}>Leave Classification</Text>
        <View style={styles.pillContainer}>
          {(['sick', 'vacation', 'emergency', 'unpaid'] as const).map((type) => {
            const active = leaveType === type;
            const details = getLeaveTypeDetails(type);
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.pillButton,
                  active ? { backgroundColor: details.color } : { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1 }
                ]}
                onPress={() => setLeaveType(type)}
              >
                <Text style={[styles.pillText, active ? { color: '#fff' } : { color: COLORS.textMain }]}>
                  {details.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date presets helper */}
        <Text style={styles.label}>Quick Presets</Text>
        <View style={styles.presetsContainer}>
          <TouchableOpacity style={styles.presetButton} onPress={() => applyPreset(1, 1)}>
            <Text style={styles.presetText}>Tomorrow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetButton} onPress={() => applyPreset(1, 3)}>
            <Text style={styles.presetText}>3 Days (Next Week)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetButton} onPress={() => applyPreset(0, 1)}>
            <Text style={styles.presetText}>Today Only</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Start Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>End Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
              value={endDate}
              onChangeText={setEndDate}
            />
          </View>
        </View>

        <Text style={styles.label}>Reason / Handover Notes</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          placeholder="Please describe the reason for your leave request..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={3}
          value={reason}
          onChangeText={setReason}
        />

        <TouchableOpacity 
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="send" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>File Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* REQUESTS LIST */}
      <Text style={styles.sectionHeader}>Leave Applications Log</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      ) : leavesList.length === 0 ? (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 40 }]}>
          <Feather name="calendar" size={32} color={COLORS.border} style={{ marginBottom: 12 }} />
          <Text style={{ color: COLORS.textMuted, fontStyle: 'italic' }}>No leave requests found.</Text>
        </View>
      ) : (
        leavesList.map((item) => {
          const typeDetails = getLeaveTypeDetails(item.leave_type);
          const statusDetails = getStatusDetails(item.status);
          const duration = calculateDuration(item.start_date, item.end_date);
          
          return (
            <View key={item.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={[styles.badge, { backgroundColor: typeDetails.bg }]}>
                  <Text style={[styles.badgeText, { color: typeDetails.color }]}>
                    {typeDetails.label} Leave
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusDetails.bg }, statusDetails.isSync && { flexDirection: 'row', alignItems: 'center' }]}>
                  {statusDetails.isSync && <ActivityIndicator size="small" color={COLORS.info} style={{ marginRight: 4 }} />}
                  <Text style={[styles.badgeText, { color: statusDetails.color }]}>
                    {statusDetails.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.logDates}>
                🗓️ {item.start_date} to {item.end_date}
              </Text>
              
              <Text style={styles.logDuration}>
                Duration: <Text style={{ fontWeight: '800', color: COLORS.textMain }}>{duration} {duration === 1 ? 'day' : 'days'}</Text>
              </Text>

              <View style={styles.reasonBox}>
                <Text style={styles.reasonText}>"{item.reason}"</Text>
              </View>

              {item.status === 'sync_pending' && (
                <View style={styles.syncWarning}>
                  <Feather name="wifi-off" size={12} color={COLORS.info} style={{ marginRight: 6 }} />
                  <Text style={styles.syncWarningText}>Stored locally. Waiting for network connection.</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingBottom: 40
  },
  header: {
    marginBottom: 24,
    marginTop: 12
  },
  title: {
    color: COLORS.textMain,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5
  },
  subtitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 2
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10
  },
  label: {
    color: COLORS.textMain,
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  pillButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pillText: {
    fontSize: 13,
    fontWeight: 'bold'
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  presetButton: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderColor: COLORS.primaryDim,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  presetText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700'
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 4
  },
  col: {
    flex: 1
  },
  input: {
    backgroundColor: '#ffffff',
    color: COLORS.textMain,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 14
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top'
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15
  },
  sectionHeader: {
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  logCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  logDates: {
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  logDuration: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 8
  },
  reasonBox: {
    backgroundColor: '#ffffff',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10
  },
  reasonText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontStyle: 'italic'
  },
  syncWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10
  },
  syncWarningText: {
    color: COLORS.info,
    fontSize: 11,
    fontWeight: '600'
  }
});
