import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ViewStyle, TextStyle, ImageStyle, RefreshControl,
  LayoutAnimation, UIManager
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Feather } from '@expo/vector-icons';
import { syncQueue, generateUUID } from '../lib/syncQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '../lib/timeout';
import { Locale, TRANSLATIONS } from '../lib/translations';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLORS = {
  background: '#ffffff',
  card: '#f8fafc',
  primary: '#10b981',
  primaryDim: 'rgba(16, 185, 129, 0.1)',
  textMain: '#0f172a',
  textMuted: '#64748b',
  danger: '#ef4444',
  border: '#e2e8f0',
  indigo: '#3730a3',
  indigoDim: 'rgba(55, 48, 163, 0.08)',
  amber: '#92400e',
  amberDim: 'rgba(146, 64, 14, 0.08)',
  rose: '#9f1239',
  roseDim: 'rgba(159, 18, 57, 0.08)',
  blue: '#1e40af',
  blueDim: 'rgba(30, 64, 175, 0.08)'
};

interface TicketsTabProps {
  userId: string;
  fullName: string;
  language: string;
  isOnline: boolean;
}

export function TicketsTab({ userId, fullName, language, isOnline }: TicketsTabProps) {
  const t = (key: keyof typeof TRANSLATIONS['en'] | string, replaceParams?: Record<string, string | number>) => {
    const currentLangDict = TRANSLATIONS[language as Locale] || TRANSLATIONS['en'];
    let text = (currentLangDict as any)[key] || (TRANSLATIONS['en'] as any)[key] || key;
    if (replaceParams) {
      Object.entries(replaceParams).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Create ticket form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Leave Request');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Comment state
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);

  // Inventory Checkout state
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [selectedPart, setSelectedPart] = useState<any>(null);
  const [showPartList, setShowPartList] = useState(false);
  const [checkoutQty, setCheckoutQty] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);

  const toggleCheckout = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowCheckout(!showCheckout);
  };

  const commentsScrollViewRef = useRef<ScrollView>(null);

  // Sub-navigation sub-tab
  const [subTab, setSubTab] = useState<'tickets' | 'leaves'>('tickets');

  // Leaves states
  const [leavesList, setLeavesList] = useState<any[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesRefreshing, setLeavesRefreshing] = useState(false);
  
  // Create leave request form states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [leaveType, setLeaveType] = useState<'sick' | 'vacation' | 'wedding' | 'paternal' | 'maternal' | 'emergency' | 'unpaid'>('sick');
  const [reason, setReason] = useState('');

  // Create payroll dispute states
  const [disputedMonth, setDisputedMonth] = useState('');
  const [disputedAmount, setDisputedAmount] = useState('');
  const [payrollNotes, setPayrollNotes] = useState('');

  // Create equipment issue states
  const [equipmentType, setEquipmentType] = useState<'tool' | 'vehicle' | 'device' | 'other'>('device');
  const [serialNumber, setSerialNumber] = useState('');
  const [equipmentNotes, setEquipmentNotes] = useState('');

  // Fetch leaves from database + merge offline queued items
  const fetchLeaves = async () => {
    setLeavesLoading(true);
    try {
      let dbLeaves = [];
      if (!isOnline) {
        console.log('App is offline, loading leaves from cache directly...');
        const cached = await AsyncStorage.getItem('CACHED_LEAVES_' + userId);
        dbLeaves = cached ? JSON.parse(cached) : [];
      } else {
        try {
          const fetchPromise = supabase
            .from('leaves')
            .select('*')
            .eq('technician_id', userId)
            .order('created_at', { ascending: false });

          const { data, error } = await withTimeout(fetchPromise, 4000);
          if (error) throw error;
          dbLeaves = data || [];
          // Save to cache
          await AsyncStorage.setItem('CACHED_LEAVES_' + userId, JSON.stringify(dbLeaves));
        } catch (networkErr: any) {
          console.warn('Could not fetch leaves from DB, falling back to cache:', networkErr.message);
          const cached = await AsyncStorage.getItem('CACHED_LEAVES_' + userId);
          dbLeaves = cached ? JSON.parse(cached) : [];
        }
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
      setLeavesLoading(false);
      setLeavesRefreshing(false);
    }
  };

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

  const getLeaveTypeDetails = (type: string) => {
    switch (type) {
      case 'sick':
        return { label: t('sick'), color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'vacation':
        return { label: t('vacation'), color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'wedding':
        return { label: t('wedding'), color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' };
      case 'paternal':
        return { label: t('paternal'), color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)' };
      case 'maternal':
        return { label: t('maternal'), color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' };
      case 'emergency':
        return { label: t('emergency'), color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'unpaid':
      default:
        return { label: t('unpaid'), color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' };
    }
  };

  const getLeaveStatusDetails = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: t('approved'), color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'rejected':
        return { label: t('rejected'), color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
      case 'sync_pending':
        return { label: t('syncPending'), color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', isSync: true };
      case 'pending':
      default:
        return { label: t('pending'), color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
    }
  };

  const calculateLeaveDuration = (startStr: string, endStr: string) => {
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diff = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  // Fetch technician's tickets (with cache fallback)
  const fetchTickets = async () => {
    setLoading(true);
    try {
      let dbTickets = [];
      if (!isOnline) {
        console.log('App is offline, loading tickets from cache directly...');
        const cached = await AsyncStorage.getItem('CACHED_TICKETS_' + userId);
        dbTickets = cached ? JSON.parse(cached) : [];
      } else {
        try {
          const fetchPromise = supabase
            .from('tickets')
            .select(`
              *,
              assignee:profiles!assigned_to(full_name)
            `)
            .eq('employee_id', userId)
            .order('created_at', { ascending: false });

          const { data, error } = await withTimeout(fetchPromise, 4000);

          if (error) throw error;
          dbTickets = data || [];
          await AsyncStorage.setItem('CACHED_TICKETS_' + userId, JSON.stringify(dbTickets));
        } catch (e: any) {
          console.warn('Failed to load tickets from network, loading cached...', e.message);
          const cached = await AsyncStorage.getItem('CACHED_TICKETS_' + userId);
          dbTickets = cached ? JSON.parse(cached) : [];
        }
      }

      // Fetch all items from the offline sync queue
      const queue = await syncQueue.getQueue();
      const offlineTickets = queue
        .filter(item => item.type === 'ticket_submission' && item.payload.employee_id === userId)
        .map(item => ({
          id: item.payload.id,
          employee_id: userId,
          title: item.payload.title,
          category: item.payload.category,
          priority: item.payload.priority,
          description: item.payload.description,
          status: 'sync_pending',
          created_at: item.payload.created_at || item.timestamp,
          assignee: null
        }));

      setTickets([...offlineTickets, ...dbTickets]);
    } catch (e: any) {
      console.error('Error fetching tickets', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch comments for selected ticket
  const fetchComments = async (ticketId: string) => {
    setLoadingComments(true);
    try {
      let dbComments = [];
      if (!isOnline) {
        console.log('App is offline, loading ticket comments from cache directly...');
        const cached = await AsyncStorage.getItem('CACHED_COMMENTS_' + ticketId);
        dbComments = cached ? JSON.parse(cached) : [];
      } else {
        try {
          const { data, error } = await supabase
            .from('ticket_comments')
            .select(`
              *,
              author:profiles!author_id(full_name, role)
            `)
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

          if (error) throw error;
          dbComments = data || [];
          await AsyncStorage.setItem('CACHED_COMMENTS_' + ticketId, JSON.stringify(dbComments));
        } catch (e: any) {
          console.error('Failed to load comments from network, loading cached...', e);
          const cached = await AsyncStorage.getItem('CACHED_COMMENTS_' + ticketId);
          dbComments = cached ? JSON.parse(cached) : [];
        }
      }

      // Fetch all items from the offline sync queue
      const queue = await syncQueue.getQueue();
      const offlineComments = queue
        .filter(item => item.type === 'post_comment' && item.payload.ticket_id === ticketId)
        .map(item => ({
          id: item.id,
          ticket_id: item.payload.ticket_id,
          author_id: item.payload.author_id,
          content: item.payload.content,
          created_at: item.payload.created_at || item.timestamp,
          status: 'sync_pending',
          author: { full_name: fullName, role: 'technician' }
        }));

      setComments([...dbComments, ...offlineComments]);
    } catch (e: any) {
      console.error('Error in fetchComments:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  // Fetch inventory details for checkout (with cache fallback)
  const fetchInventoryItems = async () => {
    try {
      if (!isOnline) {
        console.log('App is offline, loading inventory items from cache directly...');
        const cached = await AsyncStorage.getItem('CACHED_INVENTORY_ITEMS');
        setInventoryItems(cached ? JSON.parse(cached) : []);
        return;
      }

      const fetchPromise = supabase
        .from('inventory_items')
        .select('*')
        .order('name', { ascending: true });

      const { data, error } = await withTimeout(fetchPromise, 4000);

      if (error) throw error;
      setInventoryItems(data || []);
      await AsyncStorage.setItem('CACHED_INVENTORY_ITEMS', JSON.stringify(data || []));
    } catch (e: any) {
      console.warn("Failed to load inventory items from network, loading cached:", e.message);
      try {
        const cached = await AsyncStorage.getItem('CACHED_INVENTORY_ITEMS');
        setInventoryItems(cached ? JSON.parse(cached) : []);
      } catch (cacheErr) {
        console.error("Failed to read inventory cache:", cacheErr);
      }
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchLeaves();
  }, [userId]);

  const handleSelectTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setView('detail');
    fetchComments(ticket.id);
    fetchInventoryItems(); // fetch parts lists concurrently
  };

  const handleCreateTicket = async () => {
    if (category === 'Leave Request') {
      if (!startDate || !endDate || !reason.trim()) {
        Alert.alert(t('incompleteForm'), t('fillAllFields'));
        return;
      }

      // Basic format validation: YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        Alert.alert(t('invalidDateFormat'), t('datesMustBeFormatted'));
        return;
      }

      // Logical date range check
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        Alert.alert(t('invalidDates'), t('enterValidDates'));
        return;
      }

      if (end < start) {
        Alert.alert(t('invalidDateRange'), t('endDateAfterStart'));
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
        const insertPromise = supabase.from('leaves').insert(payload);
        const { error } = await withTimeout(insertPromise, 4000);

        if (error) {
          const errMessage = error.message || '';
          const status = (error as any).status;
          const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;

          if (isNetworkError) {
            // Add to offline sync queue
            await syncQueue.addToQueue('leave_request', payload);
            Alert.alert(
              t('syncPendingAlertTitle'),
              t('offlineStoredPending')
            );
            setReason('');
            setView('list');
            setSubTab('leaves');
            fetchLeaves();
            return;
          }
          throw error;
        }

        Alert.alert(t('submissionSuccess'), t('leaveFiledSuccess'));
        setReason('');
        setView('list');
        setSubTab('leaves');
        fetchLeaves();
      } catch (err: any) {
        const errMessage = err.message || '';
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timed out') || errMessage.includes('timeout');

        if (isNetworkError) {
          await syncQueue.addToQueue('leave_request', payload);
          Alert.alert(
            t('syncPendingAlertTitle'),
            t('offlineStoredPending')
          );
          setReason('');
          setView('list');
          setSubTab('leaves');
          fetchLeaves();
        } else {
          Alert.alert(t('submissionFailed'), err.message || 'Could not submit leave request.');
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (category === 'Payroll Dispute') {
      if (!disputedMonth.trim() || !disputedAmount.trim() || !payrollNotes.trim()) {
        Alert.alert(t('validationError'), t('fillAllFields'));
        return;
      }
      const amtNum = parseFloat(disputedAmount);
      if (isNaN(amtNum) || amtNum <= 0) {
        Alert.alert(t('validationError'), t('qtyPositive'));
        return;
      }

      setSubmitting(true);
      const ticketId = generateUUID();
      const payloadDesc = JSON.stringify({
        disputed_month: disputedMonth.trim(),
        disputed_amount: amtNum,
        details: payrollNotes.trim()
      });

      const payload = {
        id: ticketId,
        employee_id: userId,
        title: `Payroll Dispute - ${disputedMonth.trim()}`,
        category: 'Payroll Dispute',
        priority: 'medium',
        description: payloadDesc,
        status: 'open',
        created_at: new Date().toISOString()
      };

      const handleOffline = async () => {
        await syncQueue.addToQueue('ticket_submission', payload);
        Alert.alert(t('syncPendingAlertTitle'), t('offlineStoredPending'));
        setDisputedMonth('');
        setDisputedAmount('');
        setPayrollNotes('');
        setView('list');
        setSubTab('tickets');
        fetchTickets();
      };

      if (!isOnline) {
        await handleOffline();
        setSubmitting(false);
        return;
      }

      try {
        const { error } = await supabase.from('tickets').insert(payload);

        if (error) {
          const errMessage = error.message || '';
          const status = (error as any).status;
          const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
          if (isNetworkError) {
            await handleOffline();
            return;
          }
          throw error;
        }

        Alert.alert(t('submissionSuccess'), t('disputeSubmittedSuccess'));
        setDisputedMonth('');
        setDisputedAmount('');
        setPayrollNotes('');
        setView('list');
        setSubTab('tickets');
        fetchTickets();
      } catch (e: any) {
        const errMessage = e.message || '';
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timed out') || errMessage.includes('timeout');
        if (isNetworkError) {
          await handleOffline();
        } else {
          Alert.alert(t('submissionFailed'), e.message);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (category === 'Equipment Issue') {
      if (!serialNumber.trim() || !equipmentNotes.trim()) {
        Alert.alert(t('validationError'), t('fillAllFields'));
        return;
      }

      setSubmitting(true);
      const ticketId = generateUUID();
      const payloadDesc = JSON.stringify({
        equipment_type: equipmentType,
        serial_number: serialNumber.trim(),
        details: equipmentNotes.trim()
      });

      const payload = {
        id: ticketId,
        employee_id: userId,
        title: `Equipment Issue - ${equipmentType.toUpperCase()} (${serialNumber.trim()})`,
        category: 'Equipment Issue',
        priority: 'high',
        description: payloadDesc,
        status: 'open',
        created_at: new Date().toISOString()
      };

      const handleOffline = async () => {
        await syncQueue.addToQueue('ticket_submission', payload);
        Alert.alert(t('syncPendingAlertTitle'), t('offlineStoredPending'));
        setSerialNumber('');
        setEquipmentNotes('');
        setView('list');
        setSubTab('tickets');
        fetchTickets();
      };

      if (!isOnline) {
        await handleOffline();
        setSubmitting(false);
        return;
      }

      try {
        const { error } = await supabase.from('tickets').insert(payload);

        if (error) {
          const errMessage = error.message || '';
          const status = (error as any).status;
          const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
          if (isNetworkError) {
            await handleOffline();
            return;
          }
          throw error;
        }

        Alert.alert(t('submissionSuccess'), t('equipmentSubmittedSuccess'));
        setSerialNumber('');
        setEquipmentNotes('');
        setView('list');
        setSubTab('tickets');
        fetchTickets();
      } catch (e: any) {
        const errMessage = e.message || '';
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timed out') || errMessage.includes('timeout');
        if (isNetworkError) {
          await handleOffline();
        } else {
          Alert.alert(t('submissionFailed'), e.message);
        }
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!title.trim() || !description.trim()) {
      Alert.alert(t('validationError'), t('fillAllFields'));
      return;
    }

    setSubmitting(true);
    const ticketId = generateUUID();
    const payload = {
      id: ticketId,
      employee_id: userId,
      title: title.trim(),
      category,
      priority,
      description: description.trim(),
      status: 'open',
      created_at: new Date().toISOString()
    };

    const handleOffline = async () => {
      await syncQueue.addToQueue('ticket_submission', payload);
      Alert.alert(t('syncPendingAlertTitle'), t('offlineStoredPending'));
      setTitle('');
      setDescription('');
      setCategory('Leave Request');
      setPriority('medium');
      setView('list');
      fetchTickets();
    };

    if (!isOnline) {
      await handleOffline();
      setSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.from('tickets').insert(payload);

      if (error) {
        const errMessage = error.message || '';
        const status = (error as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
        if (isNetworkError) {
          await handleOffline();
          return;
        }
        throw error;
      }

      Alert.alert(t('submissionSuccess'), t('ticketSubmittedSuccess'));
      setTitle('');
      setDescription('');
      setCategory('Leave Request');
      setPriority('medium');
      setView('list');
      fetchTickets();
    } catch (e: any) {
      const errMessage = e.message || '';
      const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timed out') || errMessage.includes('timeout');
      if (isNetworkError) {
        await handleOffline();
      } else {
        Alert.alert(t('submissionFailed'), e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || commentSubmitting) return;

    setCommentSubmitting(true);
    const content = commentText.trim();
    setCommentText('');

    const handleOfflineComment = async () => {
      const commentId = generateUUID();
      const payload = {
        ticket_id: selectedTicket.id,
        author_id: userId,
        content,
        created_at: new Date().toISOString()
      };

      await syncQueue.addToQueue('post_comment', payload);

      const newComment = {
        id: commentId,
        ticket_id: selectedTicket.id,
        author_id: userId,
        content,
        created_at: payload.created_at,
        status: 'sync_pending',
        author: { full_name: fullName, role: 'technician' }
      };

      // Instantly append comment to local state
      setComments(prev => [...prev, newComment]);

      // Update the local ticket updated_at time
      const nowStr = new Date().toISOString();
      setSelectedTicket((prev: any) => prev ? { ...prev, updated_at: nowStr } : null);
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, updated_at: nowStr } : t));
    };

    if (!isOnline || selectedTicket.status === 'sync_pending') {
      await handleOfflineComment();
      setCommentSubmitting(false);
      return;
    }

    try {
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: selectedTicket.id,
        author_id: userId,
        content
      });

      if (error) {
        const errMessage = error.message || '';
        const status = (error as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
        if (isNetworkError) {
          await handleOfflineComment();
          return;
        }
        throw error;
      }

      // Update local ticket updated_at
      await supabase
        .from('tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);

      fetchComments(selectedTicket.id);
    } catch (e: any) {
      const errMessage = e.message || '';
      const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timed out') || errMessage.includes('timeout');
      if (isNetworkError) {
        await handleOfflineComment();
      } else {
        Alert.alert('Comment Error', e.message);
        setCommentText(content); // restore input
      }
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCheckoutParts = async () => {
    if (!selectedPart || !checkoutQty) {
      Alert.alert(t('validationError'), t('selectPartQty'));
      return;
    }

    const qtyNum = parseInt(checkoutQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert(t('validationError'), t('qtyPositive'));
      return;
    }

    // Helper for offline queue fallback
    const handleOfflineFallback = async (itemDetails: any) => {
      if (itemDetails.quantity < qtyNum) {
        Alert.alert(t('insufficientStock'), t('onlyAvailableLocally', { qty: itemDetails.quantity, unit: itemDetails.unit, name: itemDetails.name }));
        return;
      }

      const checkoutPayload = {
        item_id: selectedPart.id,
        name: itemDetails.name,
        unit: itemDetails.unit,
        ticket_id: selectedTicket.id,
        technician_id: userId,
        quantity: qtyNum,
        notes: checkoutNotes.trim() || 'Consumed by technician during dispatch service'
      };

      await syncQueue.addToQueue('parts_checkout', checkoutPayload);

      // Decrement quantity locally
      setInventoryItems(prev => prev.map(item => item.id === selectedPart.id ? { ...item, quantity: item.quantity - qtyNum } : item));

      // Post local comments event representation
      const mockComment = {
        id: 'offline-pending-comment-' + Date.now(),
        ticket_id: selectedTicket.id,
        author_id: userId,
        content: `🔧 [System DTR Log - Offline Pending]: Technician checked out ${qtyNum} ${itemDetails.unit} of "${itemDetails.name}". Memo: ${checkoutPayload.notes}`,
        created_at: new Date().toISOString(),
        author: { full_name: fullName, role: 'technician' }
      };
      setComments(prev => [...prev, mockComment]);

      Alert.alert(t('syncPendingAlertTitle'), t('offlinePartsCheckoutSuccess'));
      setSelectedPart(null);
      setCheckoutQty('');
      setCheckoutNotes('');
      setShowCheckout(false);
    };

    try {
      // 1. Double check current stock
      const { data: item, error: fetchErr } = await supabase
        .from('inventory_items')
        .select('quantity, name, unit')
        .eq('id', selectedPart.id)
        .single();
      
      if (fetchErr) {
        const errMessage = fetchErr.message || '';
        const status = (fetchErr as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
        
        if (isNetworkError) {
          await handleOfflineFallback({ quantity: selectedPart.quantity, name: selectedPart.name, unit: selectedPart.unit });
          return;
        }
        throw fetchErr;
      }

      if (!item) {
        throw new Error('Selected part not found.');
      }

      if (item.quantity < qtyNum) {
        Alert.alert(t('insufficientStock'), t('onlyAvailable', { qty: item.quantity, unit: item.unit, name: item.name }));
        return;
      }

      // 2. Decrement stock
      const { error: updateErr } = await supabase
        .from('inventory_items')
        .update({ quantity: item.quantity - qtyNum, updated_at: new Date().toISOString() })
        .eq('id', selectedPart.id);
      
      if (updateErr) {
        const errMessage = updateErr.message || '';
        const status = (updateErr as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;

        if (isNetworkError) {
          await handleOfflineFallback({ quantity: item.quantity, name: item.name, unit: item.unit });
          return;
        }
        throw updateErr;
      }

      // 3. Log stock transaction
      const { error: txErr } = await supabase
        .from('stock_transactions')
        .insert({
          item_id: selectedPart.id,
          ticket_id: selectedTicket.id,
          technician_id: userId,
          type: 'out',
          quantity: qtyNum,
          notes: checkoutNotes.trim() || 'Consumed by technician during dispatch service'
        });
      
      if (txErr) {
        const errMessage = txErr.message || '';
        const status = (txErr as any).status;
        const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;

        if (isNetworkError) {
          await handleOfflineFallback({ quantity: item.quantity, name: item.name, unit: item.unit });
          return;
        }
        throw txErr;
      }

      // 4. Log checkout event in ticket comment thread
      await supabase.from('ticket_comments').insert({
        ticket_id: selectedTicket.id,
        author_id: userId,
        content: `🔧 [System DTR Log]: Technician checked out ${qtyNum} ${item.unit} of "${item.name}" for dispatch. Memo: ${checkoutNotes.trim() || 'None'}`
      });

      Alert.alert(t('partsCheckoutSuccess'), t('checkedOutSuccessMsg', { qty: qtyNum, unit: item.unit, name: item.name }));
      setSelectedPart(null);
      setCheckoutQty('');
      setCheckoutNotes('');
      setShowCheckout(false);

      // Refresh comments and parts levels
      fetchComments(selectedTicket.id);
      fetchInventoryItems();
    } catch (err: any) {
      Alert.alert(t('checkoutFailed'), err.message || 'An error occurred during parts checkout.');
    }
  };

  const handleCloseTicket = async () => {
    Alert.alert(
      t('closeTicketTitle'),
      t('closeTicketConfirm'),
      [
        { text: t('cancelButton'), style: 'cancel' },
        { 
          text: t('yesCloseIt'), 
          style: 'destructive',
          onPress: async () => {
            const handleOfflineClose = async () => {
              const payload = {
                ticket_id: selectedTicket.id
              };
              await syncQueue.addToQueue('close_ticket', payload);
              setSelectedTicket((prev: any) => prev ? { ...prev, status: 'closed' } : null);
              fetchTickets();
            };

            if (!isOnline || selectedTicket.status === 'sync_pending') {
              await handleOfflineClose();
              return;
            }

            try {
              const { error } = await supabase
                .from('tickets')
                .update({ status: 'closed', updated_at: new Date().toISOString() })
                .eq('id', selectedTicket.id);
              if (error) {
                const errMessage = error.message || '';
                const status = (error as any).status;
                const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500;
                if (isNetworkError) {
                  await handleOfflineClose();
                  return;
                }
                throw error;
              }

              setSelectedTicket((prev: any) => prev ? { ...prev, status: 'closed' } : null);
              fetchTickets();
            } catch (e: any) {
              const errMessage = e.message || '';
              const isNetworkError = errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timed out') || errMessage.includes('timeout');
              if (isNetworkError) {
                await handleOfflineClose();
              } else {
                Alert.alert('Error', 'Failed to close ticket: ' + e.message);
              }
            }
          }
        }
      ]
    );
  };

  // UI Format Helpers
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getCategoryTheme = (cat: string) => {
    switch (cat) {
      case 'Leave Request': return { bg: COLORS.blueDim, text: COLORS.blue, icon: 'calendar' };
      case 'Payroll Dispute': return { bg: COLORS.amberDim, text: COLORS.amber, icon: 'dollar-sign' };
      case 'Benefits Inquiry': return { bg: COLORS.indigoDim, text: COLORS.indigo, icon: 'heart' };
      case 'Equipment Issue': return { bg: COLORS.roseDim, text: COLORS.rose, icon: 'tool' };
      default: return { bg: COLORS.border, text: COLORS.textMuted, icon: 'file-text' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return COLORS.primary;
      case 'assigned': return COLORS.blue;
      case 'in_progress': return COLORS.indigo;
      case 'resolved': return COLORS.textMuted;
      case 'closed': return '#94a3b8';
      case 'sync_pending': return '#3b82f6';
      default: return COLORS.textMuted;
    }
  };

  const getDisplayDescription = (desc: string) => {
    if (!desc) return '';
    if (desc.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(desc);
        if (parsed.details) {
          return parsed.details;
        }
        return Object.entries(parsed)
          .map(([key, val]) => `${key.replace('_', ' ').toUpperCase()}: ${val}`)
          .join(' | ');
      } catch (e) {
        return desc;
      }
    }
    return desc;
  };

  const renderJsonDescription = (desc: string) => {
    try {
      const parsed = JSON.parse(desc);
      return (
        <View style={{ marginVertical: 8, gap: 6 }}>
          {Object.entries(parsed).map(([key, val]) => {
            if (key === 'details') return null;
            const label = key.replace('_', ' ').toUpperCase();
            return (
              <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderColor: COLORS.border, borderWidth: 1, padding: 8, borderRadius: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.textMuted }}>{label}</Text>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.textMain }}>
                  {key.includes('amount') ? `₱${Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : String(val)}
                </Text>
              </View>
            );
          })}
          {parsed.details && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 4 }}>Explanation</Text>
              <Text style={styles.detailDescText}>{parsed.details}</Text>
            </View>
          )}
        </View>
      );
    } catch (e) {
      return <Text style={styles.detailDescText}>{desc}</Text>;
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      {view === 'list' && (
        <View style={styles.container}>
          <View style={styles.tabHeader}>
            <View>
              <Text style={styles.title}>{t('serviceDesk')}</Text>
              <Text style={styles.subtitle}>{t('fileRequestsSubtitle')}</Text>
            </View>
            <TouchableOpacity 
              style={styles.createButton} 
              onPress={() => {
                if (subTab === 'leaves') {
                  setCategory('Leave Request');
                }
                setView('create');
              }}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Segmented Control */}
          <View style={styles.segmentedContainer}>
            <TouchableOpacity 
              style={[styles.segmentedButton, subTab === 'tickets' ? styles.segmentedActive : {}]}
              onPress={() => setSubTab('tickets')}
            >
              <Feather name="message-square" size={14} color={subTab === 'tickets' ? '#fff' : COLORS.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.segmentedText, subTab === 'tickets' ? { color: '#fff', fontWeight: 'bold' } : {}]}>
                {t('ticketsLabel')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.segmentedButton, subTab === 'leaves' ? styles.segmentedActive : {}]}
              onPress={() => setSubTab('leaves')}
            >
              <Feather name="calendar" size={14} color={subTab === 'leaves' ? '#fff' : COLORS.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.segmentedText, subTab === 'leaves' ? { color: '#fff', fontWeight: 'bold' } : {}]}>
                {t('leavesLabel')}
              </Text>
            </TouchableOpacity>
          </View>

          {subTab === 'tickets' ? (
            loading && tickets.length === 0 ? (
              <View style={styles.centered}>
                <ActivityIndicator color={COLORS.primary} size="large" />
              </View>
            ) : tickets.length === 0 ? (
              <ScrollView contentContainerStyle={styles.centeredScroll}>
                <Feather name="inbox" size={64} color={COLORS.border} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>{t('emptyTicketsTitle')}</Text>
                <Text style={styles.emptyDesc}>{t('emptyTicketsDesc')}</Text>
              </ScrollView>
            ) : (
              <ScrollView contentContainerStyle={styles.listContent} refreshControl={
                <RefreshControl refreshing={loading} onRefresh={fetchTickets} colors={[COLORS.primary]} />
              }
              >
                {tickets.map(ticket => {
                  const catTheme = getCategoryTheme(ticket.category);
                  return (
                    <TouchableOpacity 
                       key={ticket.id} 
                      style={styles.ticketCard}
                      onPress={() => handleSelectTicket(ticket)}
                    >
                      <View style={styles.cardHeader}>
                        <View style={[styles.catBadge, { backgroundColor: catTheme.bg }]}>
                          <Feather name={catTheme.icon as any} size={11} color={catTheme.text} style={{ marginRight: 4 }} />
                          <Text style={[styles.catBadgeText, { color: catTheme.text }]}>{ticket.category}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={[styles.statusDot, { backgroundColor: getStatusColor(ticket.status) }]} />
                          <Text style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>
                            {ticket.status.replace('_', ' ')}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.ticketTitle} numberOfLines={1}>{ticket.title}</Text>
                      <Text style={styles.ticketDesc} numberOfLines={2}>{getDisplayDescription(ticket.description)}</Text>

                      <View style={styles.cardFooter}>
                        <Text style={styles.footerTime}>
                          <Feather name="clock" size={10} /> {formatDate(ticket.created_at)}
                        </Text>
                        
                        {ticket.assignee && (
                          <Text style={styles.assigneeText}>
                            <Feather name="user" size={10} /> {ticket.assignee.full_name}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )
          ) : (
            leavesLoading && leavesList.length === 0 ? (
              <View style={styles.centered}>
                <ActivityIndicator color={COLORS.primary} size="large" />
              </View>
            ) : leavesList.length === 0 ? (
              <ScrollView contentContainerStyle={styles.centeredScroll}>
                <Feather name="calendar" size={64} color={COLORS.border} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>{t('emptyLeavesTitle')}</Text>
                <Text style={styles.emptyDesc}>{t('emptyLeavesDesc')}</Text>
              </ScrollView>
            ) : (
              <ScrollView 
                contentContainerStyle={styles.listContent} 
                refreshControl={<RefreshControl refreshing={leavesRefreshing} onRefresh={() => { setLeavesRefreshing(true); fetchLeaves(); }} colors={[COLORS.primary]} />}
              >
                {leavesList.map((item) => {
                  const typeDetails = getLeaveTypeDetails(item.leave_type);
                  const statusDetails = getLeaveStatusDetails(item.status);
                  const duration = calculateLeaveDuration(item.start_date, item.end_date);
                  
                  return (
                    <View key={item.id} style={styles.ticketCard}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.catBadge, { backgroundColor: typeDetails.bg }]}>
                          <Feather name="calendar" size={11} color={typeDetails.color} style={{ marginRight: 4 }} />
                          <Text style={[styles.catBadgeText, { color: typeDetails.color }]}>
                            {typeDetails.label}
                          </Text>
                        </View>
                        <View style={[styles.catBadge, { backgroundColor: statusDetails.bg }, statusDetails.isSync && { flexDirection: 'row', alignItems: 'center' }]}>
                          {statusDetails.isSync && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />}
                          <Text style={[styles.catBadgeText, { color: statusDetails.color }]}>
                            {statusDetails.label}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={styles.ticketTitle}>
                        🗓️ {item.start_date} to {item.end_date}
                      </Text>
                      
                      <Text style={[styles.ticketDesc, { marginBottom: 8 }]}>
                        {t('leaveDurationLabel', { duration, days: duration === 1 ? t('daySingular') : t('dayPlural') })}
                      </Text>

                      <View style={{ backgroundColor: 'rgba(15, 23, 42, 0.02)', padding: 12, borderRadius: 10, marginTop: 8 }}>
                        <Text style={{ color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', lineHeight: 18 }}>“{item.reason}”</Text>
                      </View>

                      {item.status === 'sync_pending' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                          <Feather name="wifi-off" size={12} color="#3b82f6" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: '600' }}>{t('offlineStoredPending')}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )
          )}
        </View>
      )}

      {view === 'create' && (
        <ScrollView contentContainerStyle={styles.createScroll}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setView('list')} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
            <Text style={styles.formTitle}>{t('newHrRequest')}</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>{t('requestCategory')}</Text>
            <View style={styles.categoriesGrid}>
              {['Leave Request', 'Payroll Dispute', 'Benefits Inquiry', 'Equipment Issue', 'Other'].map(cat => {
                const isActive = category === cat;
                const catTheme = getCategoryTheme(cat);
                
                // Get translation label
                let catLabel = cat;
                if (cat === 'Leave Request') catLabel = t('leaveRequest');
                else if (cat === 'Payroll Dispute') catLabel = t('payrollDispute');
                else if (cat === 'Benefits Inquiry') catLabel = t('benefitsInquiry');
                else if (cat === 'Equipment Issue') catLabel = t('equipmentIssue');
                else if (cat === 'Other') catLabel = t('other');

                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption, 
                      isActive ? { borderColor: catTheme.text, backgroundColor: catTheme.bg } : {}
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Feather name={catTheme.icon as any} size={14} color={isActive ? catTheme.text : COLORS.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.categoryOptionText, isActive ? { color: catTheme.text, fontWeight: 'bold' } : {}]}>
                      {catLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {category === 'Leave Request' && (
              <>
                <Text style={styles.label}>{t('leaveClassification')}</Text>
                <View style={styles.categoriesGrid}>
                  {(['sick', 'vacation', 'wedding', 'paternal', 'maternal', 'emergency', 'unpaid'] as const).map((type) => {
                    const active = leaveType === type;
                    const details = getLeaveTypeDetails(type);
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.categoryOption,
                          active ? { borderColor: details.color, backgroundColor: details.bg } : {}
                        ]}
                        onPress={() => setLeaveType(type)}
                      >
                        <Text style={[styles.categoryOptionText, active ? { color: details.color, fontWeight: 'bold' } : {}]}>
                          {details.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t('quickPresets')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <TouchableOpacity 
                    style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: COLORS.primaryDim, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }} 
                    onPress={() => applyPreset(1, 1)}
                  >
                    <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700' }}>{t('tomorrow')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: COLORS.primaryDim, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }} 
                    onPress={() => applyPreset(1, 3)}
                  >
                    <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700' }}>{t('threeDaysNextWeek')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: COLORS.primaryDim, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }} 
                    onPress={() => applyPreset(0, 1)}
                  >
                    <Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '700' }}>{t('todayOnly')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{t('startDateLabel')}</Text>
                    <TextInput
                      style={[styles.input, { marginBottom: 0 }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={COLORS.textMuted}
                      value={startDate}
                      onChangeText={setStartDate}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{t('endDateLabel')}</Text>
                    <TextInput
                      style={[styles.input, { marginBottom: 0 }]}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={COLORS.textMuted}
                      value={endDate}
                      onChangeText={setEndDate}
                    />
                  </View>
                </View>

                <Text style={styles.label}>{t('reasonLabel')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('reasonPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={reason}
                  onChangeText={setReason}
                />
              </>
            )}

            {category === 'Payroll Dispute' && (
              <>
                <Text style={styles.label}>{t('disputedMonth')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('disputeMonthPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  value={disputedMonth}
                  onChangeText={setDisputedMonth}
                />

                <Text style={styles.label}>{t('disputedAmount')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('disputeAmountPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="numeric"
                  value={disputedAmount}
                  onChangeText={setDisputedAmount}
                />

                <Text style={styles.label}>{t('explanationDiscrepancy')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('disputeErrorPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={payrollNotes}
                  onChangeText={setPayrollNotes}
                />
              </>
            )}

            {category === 'Equipment Issue' && (
              <>
                <Text style={styles.label}>{t('equipmentType')}</Text>
                <View style={styles.categoriesGrid}>
                  {(['tool', 'vehicle', 'device', 'other'] as const).map((type) => {
                    const active = equipmentType === type;
                    const label = type === 'tool' ? t('tool') : type === 'vehicle' ? t('vehicle') : type === 'device' ? t('device') : t('other');
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.categoryOption,
                          active ? { borderColor: COLORS.rose, backgroundColor: COLORS.roseDim } : {}
                        ]}
                        onPress={() => setEquipmentType(type)}
                      >
                        <Text style={[styles.categoryOptionText, active ? { color: COLORS.rose, fontWeight: 'bold' } : {}]}>
                          {label.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t('serialNumber')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('serialPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  value={serialNumber}
                  onChangeText={setSerialNumber}
                />

                <Text style={styles.label}>{t('issueDescription')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('issuePlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={equipmentNotes}
                  onChangeText={setEquipmentNotes}
                />
              </>
            )}

            {category !== 'Leave Request' && category !== 'Payroll Dispute' && category !== 'Equipment Issue' && (
              <>
                <Text style={styles.label}>{t('priorityLabel')}</Text>
                <View style={styles.priorityRow}>
                  {['low', 'medium', 'high', 'urgent'].map(p => {
                    const isActive = priority === p;
                    const label = p === 'low' ? t('low') : p === 'medium' ? t('medium') : p === 'high' ? t('high') : t('urgent');
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.priorityOption,
                          isActive ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary } : {}
                        ]}
                        onPress={() => setPriority(p)}
                      >
                        <Text style={[styles.priorityTextOption, isActive ? { color: '#fff', fontWeight: 'bold' } : {}]}>
                          {label.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>{t('summaryTitle')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('briefSummaryPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={styles.label}>{t('explainDetails')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('explainDetailsPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  value={description}
                  onChangeText={setDescription}
                />
              </>
            )}

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleCreateTicket}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Feather name="send" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>{t('submitTicket')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {view === 'detail' && selectedTicket && (
        <View style={styles.container}>
          {/* Detail Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => { setView('list'); fetchTickets(); }} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.detailTitle} numberOfLines={1}>{selectedTicket.title}</Text>
              <Text style={{ color: getStatusColor(selectedTicket.status), fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>
                ● {selectedTicket.status === 'in_progress' ? t('inProgress') : selectedTicket.status === 'open' ? t('open') : selectedTicket.status === 'assigned' ? t('assigned') : selectedTicket.status === 'resolved' ? t('resolved') : selectedTicket.status === 'closed' ? t('closed') : selectedTicket.status}
              </Text>
            </View>
            
            {selectedTicket.status !== 'closed' && (
              <TouchableOpacity onPress={handleCloseTicket} style={styles.closeTicketBtn}>
                <Feather name="check" size={16} color={COLORS.danger} style={{ marginRight: 4 }} />
                <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>{t('closeTicketButton').split(' ')[0]}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Comment stream + details scroll */}
          <ScrollView 
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            ref={commentsScrollViewRef}
            onContentSizeChange={() => commentsScrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {/* Original Request Details */}
            <View style={styles.detailDescCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.catBadge, { backgroundColor: getCategoryTheme(selectedTicket.category).bg }]}>
                  <Text style={[styles.catBadgeText, { color: getCategoryTheme(selectedTicket.category).text }]}>
                    {selectedTicket.category === 'Leave Request' ? t('leaveRequest') : selectedTicket.category === 'Payroll Dispute' ? t('payrollDispute') : selectedTicket.category === 'Benefits Inquiry' ? t('benefitsInquiry') : selectedTicket.category === 'Equipment Issue' ? t('equipmentIssue') : selectedTicket.category === 'Other' ? t('other') : selectedTicket.category}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                  {t('priorityLabel')}: <Text style={{ fontWeight: 'bold', color: COLORS.textMain }}>{(selectedTicket.priority === 'low' ? t('low') : selectedTicket.priority === 'medium' ? t('medium') : selectedTicket.priority === 'high' ? t('high') : selectedTicket.priority === 'urgent' ? t('urgent') : selectedTicket.priority).toUpperCase()}</Text>
                </Text>
              </View>
              {selectedTicket.description.trim().startsWith('{') ? (
                renderJsonDescription(selectedTicket.description)
              ) : (
                <Text style={styles.detailDescText}>{selectedTicket.description}</Text>
              )}
              <Text style={styles.detailDateText}>{t('filedOnLabel', { date: formatDate(selectedTicket.created_at) })}</Text>
            </View>

            {/* Spare Parts checkout section (Available when status is in_progress) */}
            {selectedTicket.status === 'in_progress' && (
              <View style={[styles.detailDescCard, { borderStyle: 'dashed', borderColor: COLORS.indigo }]}>
                <TouchableOpacity 
                  onPress={toggleCheckout}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.indigo, flex: 1 }}>
                    🔧 {t('partsCheckoutTitle')}
                  </Text>
                  <Feather name={showCheckout ? "chevron-up" : "chevron-down"} size={18} color={COLORS.indigo} />
                </TouchableOpacity>

                {showCheckout && (
                  <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 }}>
                    <Text style={[styles.label, { marginBottom: 6 }]}>{t('selectPart')}</Text>
                    
                    <TouchableOpacity 
                      onPress={() => setShowPartList(!showPartList)}
                      style={{ padding: 12, borderRadius: 10, backgroundColor: '#fff', marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 13, color: selectedPart ? COLORS.textMain : COLORS.textMuted }}>
                        {selectedPart ? (language === 'fil' ? `${selectedPart.name} (${selectedPart.quantity} ${selectedPart.unit} natira)` : `${selectedPart.name} (${selectedPart.quantity} ${selectedPart.unit} left)`) : `-- ${t('selectPart')} --`}
                      </Text>
                      <Feather name="chevron-down" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>

                    {showPartList && (
                      <View style={{ maxHeight: 150, borderRadius: 10, backgroundColor: '#fff', marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, padding: 4 }}>
                        <ScrollView nestedScrollEnabled style={{ flexGrow: 0 }}>
                          {inventoryItems.length === 0 ? (
                            <Text style={{ padding: 10, fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' }}>{language === 'fil' ? 'Walang makitang piyesa sa stock' : 'No parts available in stock'}</Text>
                          ) : (
                            inventoryItems.map(item => (
                              <TouchableOpacity 
                                key={item.id}
                                onPress={() => { setSelectedPart(item); setShowPartList(false); }}
                                style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: selectedPart?.id === item.id ? '#f5f3ff' : '#fff' }}
                              >
                                <Text style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textMain }}>{item.name}</Text>
                                <Text style={{ fontSize: 11, color: COLORS.textMuted }}>SKU: {item.sku} • {item.quantity} {item.unit} available</Text>
                              </TouchableOpacity>
                            ))
                          )}
                        </ScrollView>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { marginBottom: 6 }]}>{t('quantity')}</Text>
                        <TextInput
                          style={[styles.input, { marginBottom: 0 }]}
                          placeholder="1"
                          keyboardType="numeric"
                          value={checkoutQty}
                          onChangeText={setCheckoutQty}
                        />
                      </View>
                      <View style={{ flex: 2 }}>
                        <Text style={[styles.label, { marginBottom: 6 }]}>{t('checkoutNotesLabel')}</Text>
                        <TextInput
                          style={[styles.input, { marginBottom: 0 }]}
                          placeholder={t('checkoutNotesPlaceholder')}
                          value={checkoutNotes}
                          onChangeText={setCheckoutNotes}
                        />
                      </View>
                    </View>

                    <TouchableOpacity 
                      style={[styles.submitButton, { backgroundColor: COLORS.indigo }]}
                      onPress={handleCheckoutParts}
                    >
                      <Feather name="package" size={14} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{t('checkoutButton')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Comments Timeline */}
            <Text style={styles.discussionHeading}>{t('discussion')}</Text>

            {loadingComments && comments.length === 0 ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : comments.length === 0 ? (
              <Text style={styles.noCommentsText}>{t('noComments')}</Text>
            ) : (
              <View style={{ gap: 16, marginBottom: 20 }}>
                {comments.map(c => {
                  const isOwnComment = c.author_id === userId;
                  return (
                    <View 
                      key={c.id} 
                      style={[
                        styles.commentBubbleContainer, 
                        isOwnComment ? { alignSelf: 'flex-end', alignItems: 'flex-end' } : { alignSelf: 'flex-start', alignItems: 'flex-start' }
                      ]}
                    >
                      <Text style={styles.commentAuthor}>
                        {isOwnComment ? 'You' : c.author?.full_name} <Text style={{ color: COLORS.textMuted, fontWeight: 'normal' }}>({c.author?.role})</Text>
                      </Text>
                      <View 
                        style={[
                          styles.commentBubble, 
                          isOwnComment ? { backgroundColor: COLORS.primary } : { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border }
                        ]}
                      >
                        <Text style={[styles.commentText, isOwnComment ? { color: '#fff' } : { color: COLORS.textMain }]}>
                          {c.content}
                        </Text>
                      </View>
                      <Text style={styles.commentTime}>{formatDate(c.created_at)}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {/* Comment Input Composer */}
          {selectedTicket.status !== 'closed' ? (
            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                placeholder={t('chatInputPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity 
                style={[styles.composerSendBtn, !commentText.trim() ? { opacity: 0.5 } : {}]}
                onPress={handlePostComment}
                disabled={!commentText.trim() || commentSubmitting}
              >
                {commentSubmitting ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="send" size={16} color="#fff" />}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.closedFooter}>
              <Feather name="lock" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
              <Text style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: '500' }}>{language === 'fil' ? 'Ang kahilingang ito ay naresolba at naisara na.' : 'This request has been resolved and closed.'}</Text>
            </View>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// Explicit Stylesheet Casting for TypeScript Verification
const styles = {
  container: { flex: 1, backgroundColor: COLORS.background } as ViewStyle,
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' } as ViewStyle,
  centeredScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 40 } as ViewStyle,
  
  tabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 20, marginBottom: 20 } as ViewStyle,
  title: { fontSize: 32, fontWeight: '900', color: COLORS.textMain, letterSpacing: -0.5 } as TextStyle,
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 } as TextStyle,
  createButton: { backgroundColor: COLORS.primary, width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 } as ViewStyle,
  
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 8 } as TextStyle,
  emptyDesc: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 } as TextStyle,
  
  listContent: { paddingHorizontal: 24, paddingBottom: 40 } as ViewStyle,
  ticketCard: { backgroundColor: COLORS.card, borderRadius: 18, padding: 18, marginBottom: 16, borderStyle: 'solid', borderWidth: 1, borderColor: COLORS.border } as ViewStyle,
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } as ViewStyle,
  
  catBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 } as ViewStyle,
  catBadgeText: { fontSize: 11, fontWeight: 'bold' } as TextStyle,
  
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 } as ViewStyle,
  statusText: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' } as TextStyle,
  
  ticketTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 6 } as TextStyle,
  ticketDesc: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18, marginBottom: 12 } as TextStyle,
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 } as ViewStyle,
  footerTime: { fontSize: 11, color: COLORS.textMuted } as TextStyle,
  assigneeText: { fontSize: 11, color: COLORS.textMuted } as TextStyle,

  // Form styling
  createScroll: { padding: 24, paddingBottom: 60 } as ViewStyle,
  formHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 } as ViewStyle,
  backButton: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border } as ViewStyle,
  formTitle: { fontSize: 20, fontWeight: '900', color: COLORS.textMain, marginLeft: 16 } as TextStyle,
  formCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.border } as ViewStyle,
  
  label: { fontSize: 12, fontWeight: '900', color: COLORS.textMain, textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 } as TextStyle,
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 } as ViewStyle,
  categoryOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' } as ViewStyle,
  categoryOptionText: { fontSize: 12, color: COLORS.textMain } as TextStyle,
  
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 20 } as ViewStyle,
  priorityOption: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff', alignItems: 'center' } as ViewStyle,
  priorityTextOption: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' } as TextStyle,
  
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 14, color: COLORS.textMain, marginBottom: 20 } as TextStyle,
  textArea: { height: 120 } as TextStyle,
  
  submitButton: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 6 } as ViewStyle,
  submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 } as TextStyle,

  // Detail view styling
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: '#fff' } as ViewStyle,
  detailTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textMain } as TextStyle,
  closeTicketBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.15)' } as ViewStyle,
  
  detailDescCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 } as ViewStyle,
  detailDescText: { fontSize: 14, color: COLORS.textMain, lineHeight: 22, marginVertical: 8 } as TextStyle,
  detailDateText: { fontSize: 11, color: COLORS.textMuted } as TextStyle,
  
  discussionHeading: { fontSize: 12, fontWeight: '900', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 } as TextStyle,
  noCommentsText: { fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic', textAlign: 'center', marginVertical: 20 } as TextStyle,
  
  commentBubbleContainer: { maxWidth: '85%', marginBottom: 12 } as ViewStyle,
  commentAuthor: { fontSize: 10, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 4 } as TextStyle,
  commentBubble: { padding: 12, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 } as ViewStyle,
  commentText: { fontSize: 13, lineHeight: 18 } as TextStyle,
  commentTime: { fontSize: 9, color: COLORS.textMuted, marginTop: 4 } as TextStyle,
  
  composer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: '#fff', alignItems: 'flex-end', gap: 10 } as ViewStyle,
  composerInput: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.textMain, maxHeight: 100 } as TextStyle,
  composerSendBtn: { backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 } as ViewStyle,
  
  closedFooter: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' } as ViewStyle,
  
  segmentedContainer: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 4, marginHorizontal: 24, marginBottom: 16 } as ViewStyle,
  segmentedButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 } as ViewStyle,
  segmentedActive: { backgroundColor: COLORS.primary } as ViewStyle,
  segmentedText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' } as TextStyle
};
