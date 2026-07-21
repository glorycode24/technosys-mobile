import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { Locale } from '../lib/translations';

interface SchedulesTabProps {
  userId: string;
  language: Locale;
  isOnline: boolean;
}

const COLORS = {
  background: '#ffffff',
  primary: '#10b981',
  textMain: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  // Color coding
  office: '#3b82f6', // Blue: Office Hours
  onsite: '#10b981', // Green: On-site
  outOfTown: '#f59e0b', // Orange: Out of town
};

export default function SchedulesTab({ userId, language, isOnline }: SchedulesTabProps) {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

      const { data, error } = await supabase
        .from('dispatch_schedules')
        .select(`
          id,
          branch_id,
          start_date,
          end_date,
          status,
          branches(name, address, latitude, longitude)
        `)
        .eq('technician_id', userId)
        .gte('end_date', startOfMonth)
        .lte('start_date', endOfMonth)
        .neq('status', 'cancelled');

      if (error) throw error;
      setSchedules(data || []);
    } catch (err: any) {
      console.warn("Failed to fetch schedules for calendar", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOnline) {
      fetchSchedules();
    } else {
      setLoading(false);
    }
  }, [currentDate, isOnline]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Pad first row
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDayEmpty} />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      // Determine what type of schedule falls on this day
      // Assuming schedules span from start_date to end_date
      let dayType = 'office'; // Default is office hours
      let daySchedule = null;

      for (const s of schedules) {
        const sStart = s.start_date.split('T')[0];
        const sEnd = s.end_date.split('T')[0];
        if (dateStr >= sStart && dateStr <= sEnd) {
          daySchedule = s;
          const branchName = s.branches?.name?.toLowerCase() || '';
          if (branchName.includes('provincial') || branchName.includes('out of town')) {
            dayType = 'outOfTown';
          } else {
            dayType = 'onsite';
          }
          break; // Stop at the first schedule found
        }
      }

      const bgColor = dayType === 'office' ? COLORS.office : dayType === 'onsite' ? COLORS.onsite : COLORS.outOfTown;

      days.push(
        <TouchableOpacity 
          key={dateStr} 
          style={[styles.calendarDay, { backgroundColor: bgColor + '1A', borderColor: bgColor }]}
          onPress={() => {
            if (daySchedule) {
               Alert.alert(
                 daySchedule.branches?.name || 'On-site Task',
                 `${daySchedule.start_date.split('T')[0]} to ${daySchedule.end_date.split('T')[0]}\n\nLocation: ${daySchedule.branches?.address}`,
                 [
                   { text: 'Close', style: 'cancel' },
                   { text: 'Map Route', onPress: () => {
                     if (daySchedule.branches?.latitude) {
                       Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${daySchedule.branches.latitude},${daySchedule.branches.longitude}`);
                     } else {
                       Alert.alert('No coordinates available');
                     }
                   }}
                 ]
               );
            } else {
               Alert.alert('Office Hours', `You are scheduled for regular Office Hours on ${dateStr}. Please clock in at the main office geofence.`);
            }
          }}
        >
          <Text style={[styles.dayText, { color: bgColor }]}>{i}</Text>
          <View style={[styles.dayDot, { backgroundColor: bgColor }]} />
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.calendarGrid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <Text key={d} style={styles.dayHeader}>{d}</Text>
        ))}
        {days}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{language === 'fil' ? 'Aking Iskedyul' : 'My Schedule'}</Text>
        <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 56, resizeMode: 'contain' }} />
      </View>
      
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: COLORS.office }]} /><Text style={styles.legendText}>Office Hours</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: COLORS.onsite }]} /><Text style={styles.legendText}>On-Site</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendColor, { backgroundColor: COLORS.outOfTown }]} /><Text style={styles.legendText}>Out of Town</Text></View>
      </View>

      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthButton}>
          <Feather name="chevron-left" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthButton}>
          <Feather name="chevron-right" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        renderCalendar()
      )}
      
      <View style={styles.footerNote}>
        <Text style={styles.footerNoteText}>
          {language === 'fil' ? 'Paalala: Ang mga araw na walang espesyal na iskedyul ay itinuturing na "Office Hours".' : 'Note: Days without a specific dispatch schedule default to "Office Hours". Tap any day to view details or navigate.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f8fafc',
    minHeight: '100%'
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6
  },
  legendText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600'
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  monthButton: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  dayHeader: {
    width: '14.28%',
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 12,
    fontSize: 12
  },
  calendarDayEmpty: {
    width: '14.28%',
    height: 50
  },
  calendarDay: {
    width: '12%',
    height: 50,
    marginHorizontal: '1.14%',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  dayText: {
    fontWeight: 'bold',
    fontSize: 15
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2
  },
  footerNote: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe'
  },
  footerNoteText: {
    color: '#1e40af',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center'
  }
});
