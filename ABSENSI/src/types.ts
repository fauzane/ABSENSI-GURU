export type UserRole = 'guru' | 'pelatih_ekstra' | 'tendik' | 'admin';

export interface User {
  id: string; // NIP / NIK / ID Pegawai
  name: string;
  role: UserRole;
  password?: string;
  position?: string; // Jabatan
  skPengangkatanNum?: string; // Nomor SK Pengangkatan
  skPengangkatanYear?: number; // Tahun SK Pengangkatan
  skPenugasanNum?: string; // Nomor SK Penugasan Tahunan
  skPenugasanYear?: number; // Tahun SK Penugasan Tahunan
  skFileName?: string;
}

export type AttendanceStatus = 'Hadir' | 'Sakit' | 'Izin' | 'Dinas Luar';

export interface Attendance {
  id: string; // NIP_YYYY-MM-DD
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  clockIn: string | null;
  clockOut: string | null;
  status: AttendanceStatus;
  notes: string;
  updatedAt: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationVerified?: boolean;
}

export interface DailySummary {
  total: number;
  hadir: number;
  sakit: number;
  izin: number;
  dinas: number;
  alfa: number;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  type: 'Sakit' | 'Izin' | 'Dinas Luar';
  startDate: string;
  endDate: string;
  reason: string;
  attachmentName?: string;
  attachmentUrl?: string;
  status: 'Menunggu' | 'Disetujui' | 'Ditolak';
  createdAt: string;
  isOfflineQueued?: boolean;
}

export interface TeachingSchedule {
  id: string;
  day: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat';
  time: string;
  className: string;
  subject: string;
  room?: string;
}

export interface TeachingJournal {
  id: string;
  userId: string;
  userName: string;
  date: string;
  timeSlot: string;
  className: string;
  subject: string;
  materiTopic: string;
  narrative: string;
  attachmentName?: string;
  attachmentUrl?: string;
  createdAt: string;
}

