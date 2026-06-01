import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ViewStyle, TextStyle, ImageStyle, RefreshControl,
  LayoutAnimation, UIManager
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Feather } from '@expo/vector-icons';
import { syncQueue } from '../lib/syncQueue';

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
}

export function TicketsTab({ userId, fullName }: TicketsTabProps) {
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

  // Fetch technician's tickets
  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          assignee:profiles!assigned_to(full_name)
        `)
        .eq('employee_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (e: any) {
      Alert.alert('Error', 'Failed to load tickets: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch comments for selected ticket
  const fetchComments = async (ticketId: string) => {
    setLoadingComments(true);
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
      setComments(data || []);
    } catch (e: any) {
      console.error('Failed to load comments', e);
    } finally {
      setLoadingComments(false);
    }
  };

  // Fetch inventory details for checkout
  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (e: any) {
      console.error("Failed to load inventory items:", e);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSelectTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setView('detail');
    fetchComments(ticket.id);
    fetchInventoryItems(); // fetch parts lists concurrently
  };

  const handleCreateTicket = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Validation Error', 'Please enter a summary and details.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('tickets').insert({
        employee_id: userId,
        title: title.trim(),
        category,
        priority,
        description: description.trim(),
        status: 'open'
      });

      if (error) throw error;

      Alert.alert('Success', 'Your HR service request has been submitted.');
      setTitle('');
      setDescription('');
      setCategory('Leave Request');
      setPriority('medium');
      setView('list');
      fetchTickets();
    } catch (e: any) {
      Alert.alert('Submission Failed', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || commentSubmitting) return;

    setCommentSubmitting(true);
    const content = commentText.trim();
    setCommentText('');

    try {
      const { error } = await supabase.from('ticket_comments').insert({
        ticket_id: selectedTicket.id,
        author_id: userId,
        content
      });

      if (error) throw error;

      // Update local ticket updated_at
      await supabase
        .from('tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedTicket.id);

      fetchComments(selectedTicket.id);
    } catch (e: any) {
      Alert.alert('Comment Error', e.message);
      setCommentText(content); // restore input
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCheckoutParts = async () => {
    if (!selectedPart || !checkoutQty) {
      Alert.alert('Validation Error', 'Please select a part and enter a quantity.');
      return;
    }

    const qtyNum = parseInt(checkoutQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Validation Error', 'Quantity must be greater than zero.');
      return;
    }

    // Helper for offline queue fallback
    const handleOfflineFallback = async (itemDetails: any) => {
      if (itemDetails.quantity < qtyNum) {
        Alert.alert('Insufficient Stock', `Only ${itemDetails.quantity} ${itemDetails.unit} available locally for ${itemDetails.name}.`);
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

      Alert.alert('Offline Mode Active', `Logged parts checkout locally. Will sync on reconnection.`);
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
        Alert.alert('Insufficient Stock', `Only ${item.quantity} ${item.unit} available for ${item.name}.`);
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

      Alert.alert('Parts Checkout Successful', `Logged checkout of ${qtyNum} ${item.unit} of ${item.name}.`);
      setSelectedPart(null);
      setCheckoutQty('');
      setCheckoutNotes('');
      setShowCheckout(false);

      // Refresh comments and parts levels
      fetchComments(selectedTicket.id);
      fetchInventoryItems();
    } catch (err: any) {
      Alert.alert('Checkout Failed', err.message || 'An error occurred during parts checkout.');
    }
  };

  const handleCloseTicket = async () => {
    Alert.alert(
      'Close Ticket',
      'Are you sure you want to close this ticket? You can reopen it if you still need help.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Close It', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('tickets')
                .update({ status: 'closed', updated_at: new Date().toISOString() })
                .eq('id', selectedTicket.id);
              if (error) throw error;

              setSelectedTicket((prev: any) => ({ ...prev, status: 'closed' }));
              fetchTickets();
            } catch (e: any) {
              Alert.alert('Error', 'Failed to close ticket: ' + e.message);
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
      default: return COLORS.textMuted;
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
              <Text style={styles.title}>Service Desk</Text>
              <Text style={styles.subtitle}>File requests and chat with HR Support</Text>
            </View>
            <TouchableOpacity style={styles.createButton} onPress={() => setView('create')}>
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {loading && tickets.length === 0 ? (
            <View style={styles.centered}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : tickets.length === 0 ? (
            <ScrollView contentContainerStyle={styles.centeredScroll}>
              <Feather name="inbox" size={64} color={COLORS.border} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>No service tickets</Text>
              <Text style={styles.emptyDesc}>Have a question about payroll, leaves, or equipment? Click the + button to file an HR request.</Text>
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
                    <Text style={styles.ticketDesc} numberOfLines={2}>{ticket.description}</Text>

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
          )}
        </View>
      )}

      {view === 'create' && (
        <ScrollView contentContainerStyle={styles.createScroll}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setView('list')} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
            <Text style={styles.formTitle}>New HR Request</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Request Category</Text>
            <View style={styles.categoriesGrid}>
              {['Leave Request', 'Payroll Dispute', 'Benefits Inquiry', 'Equipment Issue', 'Other'].map(cat => {
                const isActive = category === cat;
                const catTheme = getCategoryTheme(cat);
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
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Priority Level</Text>
            <View style={styles.priorityRow}>
              {['low', 'medium', 'high', 'urgent'].map(p => {
                const isActive = priority === p;
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
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Summary / Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Brief summary of your request"
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Explain Details</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Provide all relevant details here..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />

            <TouchableOpacity 
              style={styles.submitButton}
              onPress={handleCreateTicket}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Feather name="send" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>Submit Request</Text>
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
                ● {selectedTicket.status.replace('_', ' ')}
              </Text>
            </View>
            
            {selectedTicket.status !== 'closed' && (
              <TouchableOpacity onPress={handleCloseTicket} style={styles.closeTicketBtn}>
                <Feather name="check" size={16} color={COLORS.danger} style={{ marginRight: 4 }} />
                <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>Close</Text>
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
                    {selectedTicket.category}
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                  Priority: <Text style={{ fontWeight: 'bold', color: COLORS.textMain }}>{selectedTicket.priority.toUpperCase()}</Text>
                </Text>
              </View>
              <Text style={styles.detailDescText}>{selectedTicket.description}</Text>
              <Text style={styles.detailDateText}>Filed on {formatDate(selectedTicket.created_at)}</Text>
            </View>

            {/* Spare Parts checkout section (Available when status is in_progress) */}
            {selectedTicket.status === 'in_progress' && (
              <View style={[styles.detailDescCard, { borderStyle: 'dashed', borderColor: COLORS.indigo }]}>
                <TouchableOpacity 
                  onPress={toggleCheckout}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.indigo, flex: 1 }}>
                    🔧 Inventory Spare Parts Checkout
                  </Text>
                  <Feather name={showCheckout ? "chevron-up" : "chevron-down"} size={18} color={COLORS.indigo} />
                </TouchableOpacity>

                {showCheckout && (
                  <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 }}>
                    <Text style={[styles.label, { marginBottom: 6 }]}>Select Part</Text>
                    
                    <TouchableOpacity 
                      onPress={() => setShowPartList(!showPartList)}
                      style={{ padding: 12, borderRadius: 10, backgroundColor: '#fff', marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Text style={{ fontSize: 13, color: selectedPart ? COLORS.textMain : COLORS.textMuted }}>
                        {selectedPart ? `${selectedPart.name} (${selectedPart.quantity} ${selectedPart.unit} left)` : '-- Choose Spare Part --'}
                      </Text>
                      <Feather name="chevron-down" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>

                    {showPartList && (
                      <View style={{ maxHeight: 150, borderRadius: 10, backgroundColor: '#fff', marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, padding: 4 }}>
                        <ScrollView nestedScrollEnabled style={{ flexGrow: 0 }}>
                          {inventoryItems.length === 0 ? (
                            <Text style={{ padding: 10, fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' }}>No parts available in stock</Text>
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
                        <Text style={[styles.label, { marginBottom: 6 }]}>Quantity</Text>
                        <TextInput
                          style={[styles.input, { marginBottom: 0 }]}
                          placeholder="e.g. 1"
                          keyboardType="numeric"
                          value={checkoutQty}
                          onChangeText={setCheckoutQty}
                        />
                      </View>
                      <View style={{ flex: 2 }}>
                        <Text style={[styles.label, { marginBottom: 6 }]}>Checkout Memo</Text>
                        <TextInput
                          style={[styles.input, { marginBottom: 0 }]}
                          placeholder="Usage notes..."
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
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Verify & Checkout Parts</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* Comments Timeline */}
            <Text style={styles.discussionHeading}>Support Discussion</Text>

            {loadingComments && comments.length === 0 ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : comments.length === 0 ? (
              <Text style={styles.noCommentsText}>No responses yet. Support team will review shortly.</Text>
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
                placeholder="Type a message..."
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
              <Text style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: '500' }}>This request has been resolved and closed.</Text>
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
  
  closedFooter: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' } as ViewStyle
};
