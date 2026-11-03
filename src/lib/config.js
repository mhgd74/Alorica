/*
 * Fixed configuration: the storage keys, the collections that sync, the
 * seeded accounts and routes, and the tunable defaults the admin can
 * override from the settings screen.
 */





// Built-in accounts. Kept out of the UI on purpose and deliberately
// free of password material — the server owns the hashes now, so the
// browser only ever needs the name and the role.
// role: 'admin' (full access) | 'teamlead' (review + edit bookings only) | 'user'
export const DEFAULT_USERS = [
    { username: 'admin', name: 'System Admin', role: 'admin' },
    { username: 'teamlead', name: 'Team Leader', role: 'teamlead' },
    { username: '7406173', name: 'Gomaa Abdelrahman', role: 'user', mustChangePassword: true },
    { username: 'user2', name: 'Second User', role: 'user' }
];


// Fixed pickup routes / points mapping from the provided schedule.
export const FIXED_LOCATIONS = {
    "R1": ["Hossary Station", "Al Nagda Square", "Farouq Omar School", "Vodafone Sq.", "Bashayer Entrance", "High Town Mall", "Masjid Othman Ebn Afaan", "Aeon Towers"],
    "R2": ["جهاز مدينة 6 أكتوبر الجديدة", "مخرج الربوة", "معهد معاوني الامن", "دخلة كمبوند سكن مصر _كمبوند المخابرات", "ميدان رامو", "مدخل المتميز", "صينية الحى السادس عشر ميدان البستان", "أسبانيا بلازا", "ميدان عمر الحناوي", "مستشفى الشيخ زايد التخصصي", "كوبري المشاه أمام هايبر وان الشيخ زايد"],
    "R3": ["Sawwaf Tersa", "Tersa Bridge", "Khofo Gate", "Ahmos Gate", "Mina Gate 4 (Hadayeq Al Ahram)", "Zewail Rd. (Wahat Rd.)", "Dreamland", "Souq Al Gomla"],
    "R4": ["El Monib - Matafy Stairs", "Khatem Al Morsaleen Mosque", "Cairo University Main Gate", "Awwal Faisal", "Maryam Pharmacy (Faisal St.)", "Haram Educational Administration", "Sahl Hamza", "Faisal St."],
    "R5": ["The National Museum of Egyptian Civilization", "Misr El Qadima Post Office", "Magra Al Eyoon", "Abd Al Moneim Riad", "EGYPTAIR Mohandessin", "Lebanon Sq."],
    "R6": ["Wattaneya Gas Station", "Saqr Quraish", "Total Zahraa Al Maadi (Autostrad)", "Policeman Institute St. (Nile Corniche)", "Total Gas Station-Ent.2", "Constitutional Court"],
    "R7": ["Saudi German Hospital Cairo", "El Nozha Metroline 3 Station", "Al Hegaz Square", "Heliopolis Courthouse Complex", "Al Helmeya Square", "Mostorod", "Al Sawah Square", "Al-Fath Mosque"],
    "R8": ["Al Nour Mosque (Nasr City)", "Marmina Church", "Abbas Al Akkad St. & Mostafa Al Nahas St.", "Vodafone (Saa Square)", "Hesham Barakat Bridge", "Al Sekka Al Hadid Sporting Club (Nasr City)", "Ghamra"],
    "R9": ["نزله مدينه الجديدة (Nasr City)", "مؤسسة الزكاة", "نزلة القلج", "نزلة المرج", "كوبري مسطرد", "نزلة طريق بنها الحر", "نزلة قليوب", "سلم باسوس", "الوراق", "محطة مترو الطريق الدائري", "نزلة بشتيل", "البراجيل", "سلم الرشاح", "سلم المساكن كفر طهرمس", "سلم المنشية"]
};


export const ALL_POINTS = Object.values(FIXED_LOCATIONS).flat();


// Default fleet — the admin can add / remove buses and change capacities.
export const DEFAULT_BUSES = [
    { id: 'bus-1', name: 'Bus 1', capacity: 14 },
    { id: 'bus-2', name: 'Bus 2', capacity: 14 },
    { id: 'bus-3', name: 'Bus 3', capacity: 26 }
];


export const WAITLIST = 'Waitlist';


export const STORAGE = {
    bookings: 'alorica_bookings',
    users: 'alorica_custom_users',
    removedUsers: 'alorica_removed_users',
    passwordRequests: 'alorica_password_requests',
    changeRequests: 'alorica_change_requests',
    notifications: 'alorica_notifications',
    buses: 'alorica_buses',
    audit: 'alorica_audit_log',
    sheet: 'alorica_sheet_state',
    vacations: 'alorica_vacations',
    vacationBalances: 'alorica_vacation_balances',
    settings: 'alorica_settings'
};


// Storage key -> collection name, so a queued change knows where it belongs.
export const COLLECTION_BY_KEY = Object.keys(STORAGE).reduce((acc, name) => {
    acc[STORAGE[name]] = name;
    return acc;
}, {});


// Display preferences belong to this screen, not to the shared data, so
// they are kept out of STORAGE and are never replicated to other devices.
export const PREF_KEY = 'alorica_preferences';


export const DEFAULT_PREFERENCES = {
    timeFormat: '12h',
    defaultTab: 'arrival',
    notifyApprovals: true,
    notifyDecisions: true,
    notifyGeneral: true
};


// How long a team leader's change request waits for the employee.
export const CHANGE_REQUEST_TTL = 48 * 60 * 60 * 1000;


// A temporary password stays valid for one day before the account must ask again.
export const TEMP_PASSWORD_TTL = 24 * 60 * 60 * 1000;


// Vacation/PTO settings (can be customized)
export const VACATION_TYPES = {
    annual: { label: 'Annual Leave', color: 'green', defaultDays: 21 },
    sick: { label: 'Sick Leave', color: 'red', defaultDays: 14 },
    personal: { label: 'Personal Leave', color: 'blue', defaultDays: 7 },
    emergency: { label: 'Emergency Leave', color: 'orange', defaultDays: 3 },
    unpaid: { label: 'Unpaid Leave', color: 'gray', defaultDays: 0 }
};


export const VACATION_STATUS = {
    pending: { label: 'Pending', cls: 'bg-yellow-50 text-yellow-700' },
    approved: { label: 'Approved', cls: 'bg-green-50 text-green-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600' }
};


// The sheet moves draft -> sent -> locked. Locking is what stops the team
// leader from replacing the sheet the admin has already printed and used
// to order buses from the vendor.
export const SHEET_STATUS = {
    draft: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
    sent: { label: 'Sent to admin', cls: 'bg-blue-50 text-alorica-blue' },
    locked: { label: 'Locked after printing', cls: 'bg-green-50 text-green-700' }
};


export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';


/* =============================================================
 * 2a-2. Session token
 * =============================================================
 * The password is checked by the server, which hands back a signed
 * token. Every API call carries it, and a 401 means the session is
 * over — so the checks can no longer be skipped from the browser.
 */

export const SESSION_KEY = 'alorica.session';


/* =============================================================
 * 2b. Password hashing (PBKDF2-SHA256)
 * =============================================================
 * Passwords are never stored or compared in plain text. Accounts
 * saved by older versions keep a plain `password` field; they are
 * upgraded to a salted hash the next time the owner signs in.
 */

export const PBKDF2_ITERATIONS = 100000;

export const PBKDF2_BYTES = 32;


// One rule covers every self-service change an employee makes to their own
// booking — editing it or cancelling it. With a full hour still to go they
// act directly; any closer and the team leader has to release the change.
export const EDIT_CUTOFF_MS = 60 * 60 * 1000;


// Preset loading times per direction, grouped by shift.
// Edit these values to match the official company shift schedule.
export const SHIFT_SLOTS = {
    arrival: [
        { shift: 'Morning Shift', times: ['06:30', '07:00'] },
        { shift: 'Evening Shift', times: ['14:30', '15:00'] },
        { shift: 'Night Shift', times: ['22:30', '23:00'] }
    ],
    departure: [
        { shift: 'Morning Shift', times: ['17:00', '17:30'] },
        { shift: 'Evening Shift', times: ['01:00', '01:30'] },
        { shift: 'Night Shift', times: ['08:00', '08:30'] }
    ]
};


// Admin-tunable settings. They travel as a single-record collection so a
// change the admin makes reaches every device through the same sync
// channel as bookings and leave.
export const DEFAULT_VACATION_DAYS = { annual: 21, sick: 14, personal: 7, emergency: 3, unpaid: 0 };

export const DEFAULT_BOOKING_RULES = { maxAdvanceDays: 30, oneBookingPerDay: true };
