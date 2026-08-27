import AsyncStorage from '@react-native-async-storage/async-storage';

export type SupportedLanguage = 'en' | 'tl';

export const LANGUAGE_STORAGE_KEY = '@user_language';

export const TRANSLATIONS: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Header & Greeting
    welcome_back: 'Welcome back,',
    technician_dashboard: 'TECHNICIAN DASHBOARD',
    menu: 'Menu',
    notifications: 'Notifications',

    // Primary Actions
    clock_in: 'Clock In',
    clock_out: 'Clock Out',
    clocked_in_at: 'Clocked in at',
    priority_dispatch: 'Priority Dispatch',
    active_assignment: 'Active Assignment',

    // Section Titles & Categories
    my_operations: 'My Operations',
    hr_and_pay: 'My HR & Pay',
    company_and_support: 'Company & Support',
    preferences: 'Preferences',
    settings: 'Settings',

    // Operations Grid
    schedules: 'Schedules',
    my_tools: 'My Tools',
    work_orders: 'Work Orders',

    // HR & Pay Grid
    payslips: 'Payslips',
    file_leave: 'File Leave',
    timesheets: 'Timesheets',

    // Company & Support Grid
    announcements: 'Announcements',
    support: 'Help & Support',

    // Profile & Logout
    profile: 'Profile',
    dark_mode: 'Dark Mode',
    log_out: 'Log Out',
    confirm_logout: 'Are you sure you want to log out of your account?',
    cancel: 'Cancel',
    online: 'Online',

    // Preferences Modal
    preferences_language: 'Preferences (Language)',
    select_app_language: 'Select App Language',
    english: 'English',
    filipino: 'Filipino (Tagalog)',
    language_updated: 'App language updated to Filipino (Tagalog).',
    language_updated_en: 'App language updated to English.',

    // Statuses & Badges
    status_verified: 'VERIFIED',
    status_pending: 'PENDING REVIEW',
    status_approved: 'APPROVED',
    status_rejected: 'REJECTED',
    status_borrowed: 'BORROWED',
    status_overdue: 'OVERDUE',
    status_open: 'OPEN',
    status_resolved: 'RESOLVED',
    status_completed: 'COMPLETED',

    // Announcements & Priorities
    urgent_alert: '🔴 URGENT ALERT',
    policy_notice: '🔵 POLICY NOTICE',
    general_notice: '🟢 GENERAL NOTICE',
    edited_tag: '✏️ EDITED',
    no_announcements: 'No new announcements right now.',
    company_updates: 'Company Updates',

    // Support Tickets
    create_ticket: 'Create New Ticket',
    ticket_title: 'Title',
    ticket_category: 'Category',
    ticket_desc: 'Description',
    submit_ticket: 'Submit Ticket',
    no_tickets: 'You have no open support tickets!',

    // Leaves
    file_new_leave: 'File New Leave',
    leave_type: 'Leave Type',
    start_date: 'Start Date',
    end_date: 'End Date',
    reason: 'Reason',
    submit_leave: 'Submit Leave Request',
    vacation_leave: 'Vacation',
    sick_leave: 'Sick',
    emergency_leave: 'Emergency',
    unpaid_leave: 'Unpaid',

    // Common Buttons
    back: 'Back',
    close: 'Tap to close',
    navigate_site: 'Navigate to Site',
    submit_photo_override: 'Submit Photo Override',
    dispute_log: 'Dispute Time Log',
    dispute_payslip: 'Dispute Payslip',
  },
  tl: {
    // Header & Greeting
    welcome_back: 'Maligayang pagbabalik,',
    technician_dashboard: 'DASHBOARD NG TEKNISYON',
    menu: 'Menu',
    notifications: 'Mga Notification',

    // Primary Actions
    clock_in: 'Pumasok (Clock In)',
    clock_out: 'Lumabas (Clock Out)',
    clocked_in_at: 'Pumasok noong',
    priority_dispatch: 'Apurahang Misyón',
    active_assignment: 'Aktibong Misyón',

    // Section Titles & Categories
    my_operations: 'Aking Misyón at Trabaho',
    hr_and_pay: 'HR at Aking Sweldo',
    company_and_support: 'Kompanya at Tulong',
    preferences: 'Mga Kagustuhan',
    settings: 'Mga Setting',

    // Operations Grid
    schedules: 'Mga Iskedyul',
    my_tools: 'Aking Kagamitan',
    work_orders: 'Work Orders',

    // HR & Pay Grid
    payslips: 'Aking Sweldo (Payslips)',
    file_leave: 'Mag-File ng Leave',
    timesheets: 'Mga Timesheet',

    // Company & Support Grid
    announcements: 'Mga Anunsyo',
    support: 'Tulong (Help & Support)',

    // Profile & Logout
    profile: 'Profile',
    dark_mode: 'Dark Mode',
    log_out: 'Mag-Log Out',
    confirm_logout: 'Sigurado ka bang gusto mong mag-log out sa iyong account?',
    cancel: 'Kanselahin',
    online: 'Naka-Online',

    // Preferences Modal
    preferences_language: 'Kagustuhan sa Wika (Language)',
    select_app_language: 'Pumili ng Wika ng App',
    english: 'English',
    filipino: 'Filipino (Tagalog)',
    language_updated: 'Nabagong wika ng app sa Filipino (Tagalog).',
    language_updated_en: 'Nabagong wika ng app sa English.',

    // Statuses & Badges
    status_verified: 'KUMPIRMADO',
    status_pending: 'PINAG-AARALAN',
    status_approved: 'PINAYAGAN',
    status_rejected: 'TINANGGIHAN',
    status_borrowed: 'HIRAM',
    status_overdue: 'LAMPAS NA SA PALATAKAN',
    status_open: 'BUKAS',
    status_resolved: 'NANAULI / TAPOS NA',
    status_completed: 'TAPOS NA',

    // Announcements & Priorities
    urgent_alert: '🔴 APURAHANG ANUNSYO',
    policy_notice: '🔵 PATAKARAN NG KOMPANYA',
    general_notice: '🟢 PANGKALAHATANG ANUNSYO',
    edited_tag: '✏️ NABAGO',
    no_announcements: 'Walang bagong anunsyo sa ngayon.',
    company_updates: 'Mga Anunsyo ng Kompanya',

    // Support Tickets
    create_ticket: 'Gumawa ng Bagong Ticket',
    ticket_title: 'Pamagat',
    ticket_category: 'Kategorya',
    ticket_desc: 'Paliwanag',
    submit_ticket: 'Ipadala ang Ticket',
    no_tickets: 'Wala kang nakabukas na support ticket!',

    // Leaves
    file_new_leave: 'Mag-File ng Bagong Leave',
    leave_type: 'Uri ng Leave',
    start_date: 'Petsa ng Simula',
    end_date: 'Petsa ng Pagtatapos',
    reason: 'Dahilan',
    submit_leave: 'Ipadala ang Hiling sa Leave',
    vacation_leave: 'Basyon (Vacation)',
    sick_leave: 'Sakit (Sick)',
    emergency_leave: 'Apurahan (Emergency)',
    unpaid_leave: 'Walang Bayad (Unpaid)',

    // Common Buttons
    back: 'Bumalik',
    close: 'Pindutin para isara',
    navigate_site: 'Pumunta sa Lugar',
    submit_photo_override: 'Ipadala ang Litrato bilang Patunay',
    dispute_log: 'I-Dispute ang Time Log',
    dispute_payslip: 'I-Dispute ang Sweldo',
  }
};

/**
 * Retrieves the stored user language preference from AsyncStorage.
 * Defaults to 'en' (English) if not previously set.
 */
export async function getStoredLanguage(): Promise<SupportedLanguage> {
  try {
    const lang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (lang === 'tl' || lang === 'en') {
      return lang;
    }
  } catch (e) {
    console.error('Failed to load stored language:', e);
  }
  return 'en';
}

/**
 * Saves the selected user language preference to AsyncStorage.
 */
export async function setStoredLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (e) {
    console.error('Failed to save language preference:', e);
  }
}

/**
 * Translates a key based on the selected language, with automatic fallback to English and raw key name.
 */
export function translate(key: string, lang: SupportedLanguage = 'en'): string {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  return dict[key] || TRANSLATIONS['en'][key] || key;
}
