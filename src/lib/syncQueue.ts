import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_KEY = 'OFFLINE_TRANSACTION_QUEUE';

export interface QueueItem {
  id: string;
  type: 'time_in' | 'time_out' | 'parts_checkout' | 'leave_request';
  payload: any;
  timestamp: string;
}

const HISTORY_KEY = 'SYNCED_TRANSACTION_LOG';

export const syncQueue = {
  async getQueue(): Promise<QueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to read queue:', e);
      return [];
    }
  },

  async getHistory(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to read history:', e);
      return [];
    }
  },

  async addToHistory(item: QueueItem, status: 'success' | 'failed', errorMsg?: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(HISTORY_KEY);
      const history = data ? JSON.parse(data) : [];
      const newEntry = {
        ...item,
        status,
        errorMsg,
        syncedAt: new Date().toISOString()
      };
      history.unshift(newEntry);
      if (history.length > 50) history.pop();
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to add to history:', e);
    }
  },

  async clearHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  },

  async addToQueue(type: QueueItem['type'], payload: any): Promise<void> {
    try {
      const queue = await this.getQueue();
      const newItem: QueueItem = {
        id: Math.random().toString(36).substring(2, 9),
        type,
        payload,
        timestamp: new Date().toISOString()
      };
      queue.push(newItem);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to add to queue:', e);
    }
  },

  async removeFromQueue(id: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter(item => item.id !== id);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to remove from queue:', e);
    }
  },

  async syncPendingQueue(onSyncSuccess?: (item: QueueItem) => void): Promise<{ success: boolean; syncedCount: number }> {
    const queue = await this.getQueue();
    if (queue.length === 0) return { success: true, syncedCount: 0 };

    let syncedCount = 0;

    for (const item of queue) {
      try {
        let error = null;

        if (item.type === 'time_in') {
          const { error: err } = await supabase.from('time_logs').insert({
            technician_id: item.payload.technician_id,
            app_time_in: item.payload.app_time_in,
            latitude: item.payload.latitude,
            longitude: item.payload.longitude,
            geofence_status: item.payload.geofence_status,
            is_mocked: item.payload.is_mocked,
            gps_accuracy: item.payload.gps_accuracy,
            app_time_out: item.payload.app_time_out || null,
            total_hours: item.payload.total_hours || null
          });
          error = err;
        } else if (item.type === 'time_out') {
          const { error: err } = await supabase.from('time_logs')
            .update({
              app_time_out: item.payload.app_time_out,
              total_hours: item.payload.total_hours
            })
            .eq('id', item.payload.log_id);
          error = err;
        } else if (item.type === 'leave_request') {
          const { error: err } = await supabase.from('leaves').insert({
            technician_id: item.payload.technician_id,
            start_date: item.payload.start_date,
            end_date: item.payload.end_date,
            leave_type: item.payload.leave_type,
            reason: item.payload.reason,
            status: 'pending'
          });
          error = err;
        } else if (item.type === 'parts_checkout') {
          // 1. Double check current stock level from Supabase
          const { data: dbItem, error: fetchErr } = await supabase
            .from('inventory_items')
            .select('quantity')
            .eq('id', item.payload.item_id)
            .single();

          if (fetchErr) {
            error = fetchErr;
          } else {
            const currentQty = dbItem?.quantity ?? 0;
            const checkoutQty = item.payload.quantity;

            // 2. Decrement stock
            const { error: updateErr } = await supabase
              .from('inventory_items')
              .update({ quantity: Math.max(0, currentQty - checkoutQty), updated_at: new Date().toISOString() })
              .eq('id', item.payload.item_id);

            if (updateErr) {
              error = updateErr;
            } else {
              // 3. Log stock transaction
              const { error: txErr } = await supabase
                .from('stock_transactions')
                .insert({
                  item_id: item.payload.item_id,
                  ticket_id: item.payload.ticket_id,
                  technician_id: item.payload.technician_id,
                  type: 'out',
                  quantity: checkoutQty,
                  notes: item.payload.notes
                });

              if (txErr) {
                error = txErr;
              } else {
                // 4. Log checkout event in ticket comment thread
                const { error: commentErr } = await supabase.from('ticket_comments').insert({
                  ticket_id: item.payload.ticket_id,
                  author_id: item.payload.technician_id,
                  content: `🔧 [System DTR Log - Offline Sync]: Technician checked out ${checkoutQty} ${item.payload.unit ?? 'pcs'} of "${item.payload.name}". Memo: ${item.payload.notes}`
                });
                error = commentErr;
              }
            }
          }
        }

        if (error) {
          const errMessage = error.message || '';
          const status = (error as any).status;
          if (errMessage.includes('fetch') || errMessage.includes('Network') || errMessage.includes('timeout') || status === 0 || status >= 500) {
            console.log('Network connection still offline. Stopping sync loop.');
            return { success: false, syncedCount };
          } else {
            console.error('Non-recoverable sync error. Discarding transaction:', error);
            await this.addToHistory(item, 'failed', errMessage || 'Non-recoverable error');
            await this.removeFromQueue(item.id);
          }
        } else {
          await this.addToHistory(item, 'success');
          await this.removeFromQueue(item.id);
          syncedCount++;
          if (onSyncSuccess) onSyncSuccess(item);
        }
      } catch (e: any) {
        console.error('Exception during queue sync:', e);
        return { success: false, syncedCount };
      }
    }

    return { success: true, syncedCount };
  }
};
