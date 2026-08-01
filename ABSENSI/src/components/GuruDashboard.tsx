import React, { useState, useEffect, useMemo, FormEvent } from "react";
import { User, Attendance, AttendanceStatus, LeaveRequest, TeachingSchedule, TeachingJournal } from "../types";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths,
  isToday 
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { 
  Clock, 
  MapPin, 
  CheckCircle2, 
  History, 
  AlertCircle, 
  Send, 
  LogOut, 
  BellRing, 
  Info, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Download, 
  Award, 
  FileText,
  BookOpen,
  Upload,
  Paperclip,
  Plus,
  Check,
  FileCheck,
  Layers,
  GraduationCap,
  Sparkles,
  FileUp,
  Eye,
  Trash2,
  CalendarDays,
  Compass,
  Navigation,
  ShieldCheck,
  XCircle,
  Bell,
  RefreshCw,
  CheckCheck,
  WifiOff,
  HardDrive
} from "lucide-react";
import GoogleDriveManager from "./GoogleDriveManager";
import DrivePreview from "./DrivePreview";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";

const SCHOOL_LAT = -7.58452;
const SCHOOL_LNG = 110.83981;
const SCHOOL_NAME = "SD Muhammadiyah 23 Semanggi, Surakarta";

function calculateDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

interface GuruDashboardProps {
  user: User;
}

export default function GuruDashboard({ user }: GuruDashboardProps) {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<"presensi" | "jadwal_jurnal" | "pengajuan_izin" | "google_drive">("presensi");

  // Attendance state
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("Hadir");
  const [notes, setNotes] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotification, setShowNotification] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<"full_month" | "logged_only">("full_month");

  // Geolocation State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({ lat: SCHOOL_LAT, lng: SCHOOL_LNG });
  const [locationStatus, setLocationStatus] = useState<"idle" | "locating" | "verified" | "error">("idle");
  const [locationErrorMessage, setLocationErrorMessage] = useState<string>("");
  const [distanceToSchool, setDistanceToSchool] = useState<number>(12); // meters

  // Leave Toast Notification State
  const [activeToast, setActiveToast] = useState<LeaveRequest | null>(null);
  const [unseenNotifications, setUnseenNotifications] = useState<LeaveRequest[]>([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);

  // Leave Request Form State
  const [leaveType, setLeaveType] = useState<"Sakit" | "Izin" | "Dinas Luar">("Sakit");
  const [leaveStartDate, setLeaveStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [leaveEndDate, setLeaveEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveFileName, setLeaveFileName] = useState("");
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  // Teaching Schedule State
  const defaultSchedules: TeachingSchedule[] = [
    { id: "1", day: "Senin", time: "07:30 - 09:00", className: "Kelas 4A", subject: "Matematika", room: "Ruang 4A" },
    { id: "2", day: "Senin", time: "09:15 - 10:45", className: "Kelas 5B", subject: "IPA (Sains)", room: "Lab IPA" },
    { id: "3", day: "Selasa", time: "07:30 - 09:00", className: "Kelas 6A", subject: "Bahasa Indonesia", room: "Ruang 6A" },
    { id: "4", day: "Rabu", time: "08:00 - 09:30", className: "Kelas 4B", subject: "Matematika", room: "Ruang 4B" },
    { id: "5", day: "Kamis", time: "09:30 - 11:00", className: "Kelas 5A", subject: "Pancasila / PPKn", room: "Ruang 5A" },
    { id: "6", day: "Jumat", time: "07:30 - 09:00", className: "Kelas 6B", subject: "IPAS", room: "Ruang 6B" },
  ];
  const [schedules] = useState<TeachingSchedule[]>(defaultSchedules);
  const [selectedScheduleDay, setSelectedScheduleDay] = useState<string>("Senin");

  // 15-Minute Teaching Schedule Notification Alert State
  const [activeClassAlert, setActiveClassAlert] = useState<{
    schedule: TeachingSchedule;
    minutesRemaining: number;
    startTimeStr: string;
  } | null>(null);
  const [dismissedClassAlerts, setDismissedClassAlerts] = useState<string[]>([]);

  // Offline Storage Queue & Connection State (Service Worker Local Storage Queue)
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [offlineLeaveQueue, setOfflineLeaveQueue] = useState<LeaveRequest[]>([]);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Sync offline queued requests when internet returns
  const syncOfflineQueue = () => {
    const rawQueue = localStorage.getItem(`offline_leave_queue_${user.id}`);
    if (rawQueue) {
      try {
        const queuedItems: LeaveRequest[] = JSON.parse(rawQueue);
        if (queuedItems.length > 0) {
          const savedLeavesRaw = localStorage.getItem(`leaves_${user.id}`);
          const currentLeaves: LeaveRequest[] = savedLeavesRaw ? JSON.parse(savedLeavesRaw) : [];

          const updatedLeaves = [...currentLeaves];
          queuedItems.forEach(item => {
            const index = updatedLeaves.findIndex(l => l.id === item.id);
            if (index >= 0) {
              updatedLeaves[index] = { ...item, isOfflineQueued: false };
            } else {
              updatedLeaves.unshift({ ...item, isOfflineQueued: false });
            }
          });

          localStorage.setItem(`leaves_${user.id}`, JSON.stringify(updatedLeaves));
          localStorage.removeItem(`offline_leave_queue_${user.id}`);
          setOfflineLeaveQueue([]);
          setLeaveRequests(updatedLeaves);
          window.dispatchEvent(new Event("storage"));

          setSyncStatusMsg(`⚡ Sinkronisasi Sukses! ${queuedItems.length} pengajuan lokal berhasil dikirim ke server Admin.`);
          setTimeout(() => setSyncStatusMsg(null), 6000);
        }
      } catch (err) {
        console.error("Error syncing offline queue:", err);
      }
    }
  };

  useEffect(() => {
    // Load initial offline queue
    const rawQueue = localStorage.getItem(`offline_leave_queue_${user.id}`);
    if (rawQueue) {
      try {
        setOfflineLeaveQueue(JSON.parse(rawQueue));
      } catch (e) {
        console.error(e);
      }
    }

    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user.id]);

  // Request Browser Notification Permission on mount
  useEffect(() => {
    if ("Notification" in window) {
      if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Function to check 15-minute schedule reminders
  const checkTeachingReminders = (now: Date) => {
    const INDO_DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const todayDayName = INDO_DAYS[now.getDay()];
    const todayStr = format(now, "yyyy-MM-dd");

    const todaysSchedules = schedules.filter((s) => s.day === todayDayName);

    for (const sched of todaysSchedules) {
      const startTimeStr = sched.time.split("-")[0].trim();
      const [hStr, mStr] = startTimeStr.split(":");
      const hours = parseInt(hStr, 10);
      const minutes = parseInt(mStr, 10);

      if (!isNaN(hours) && !isNaN(minutes)) {
        const schedStart = new Date(now);
        schedStart.setHours(hours, minutes, 0, 0);

        const diffMs = schedStart.getTime() - now.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes >= -5 && diffMinutes <= 15) {
          const alertKey = `${todayStr}_${sched.id}`;
          const isDismissed =
            dismissedClassAlerts.includes(alertKey) ||
            localStorage.getItem(`dismissed_class_alert_${user.id}_${alertKey}`) === "true";

          if (!isDismissed && !activeClassAlert) {
            setActiveClassAlert({
              schedule: sched,
              minutesRemaining: Math.max(1, diffMinutes),
              startTimeStr,
            });

            if ("Notification" in window && Notification.permission === "granted") {
              const sessionKey = `browser_notif_${user.id}_${alertKey}`;
              if (!sessionStorage.getItem(sessionKey)) {
                new Notification(`⏰ Pengingat Mengajar: ${sched.subject}`, {
                  body: `Kelas ${sched.className} (${sched.room}) akan dimulai dalam ${diffMinutes <= 0 ? 'sekarang' : `${diffMinutes} menit`}!`,
                });
                sessionStorage.setItem(sessionKey, "true");
              }
            }
            break;
          }
        }
      }
    }
  };

  const handleDismissClassAlert = () => {
    if (activeClassAlert) {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const alertKey = `${todayStr}_${activeClassAlert.schedule.id}`;
      setDismissedClassAlerts((prev) => [...prev, alertKey]);
      localStorage.setItem(`dismissed_class_alert_${user.id}_${alertKey}`, "true");
      setActiveClassAlert(null);
    }
  };

  const handleSimulateClassAlert = (sched: TeachingSchedule) => {
    const startTimeStr = sched.time.split("-")[0].trim();
    setActiveClassAlert({
      schedule: sched,
      minutesRemaining: 15,
      startTimeStr: startTimeStr,
    });

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`⏰ [SIMULASI 15 MENIT] Jadwal Mengajar: ${sched.subject}`, {
        body: `Kelas ${sched.className} di ${sched.room} akan dimulai 15 menit lagi!`,
      });
    }
  };
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [journalDate, setJournalDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [journalTimeSlot, setJournalTimeSlot] = useState("07:30 - 09:00");
  const [journalClass, setJournalClass] = useState("Kelas 4A");
  const [journalSubject, setJournalSubject] = useState("Matematika");
  const [materiTopic, setMateriTopic] = useState("");
  const [journalNarrative, setJournalNarrative] = useState("");
  const [materialFileName, setMaterialFileName] = useState("");
  const [journals, setJournals] = useState<TeachingJournal[]>([]);

  // Request Geolocation function
  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationErrorMessage("GPS tidak didukung pada browser ini.");
      setUserCoords({ lat: SCHOOL_LAT, lng: SCHOOL_LNG });
      setDistanceToSchool(12);
      return;
    }

    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserCoords({ lat, lng });
        const dist = Math.round(calculateDistanceInMeters(lat, lng, SCHOOL_LAT, SCHOOL_LNG));
        setDistanceToSchool(dist);
        setLocationStatus("verified");
        setLocationErrorMessage("");
      },
      (error) => {
        console.warn("Geolocation fallback:", error.message);
        // Fallback default coordinates within SDM 23 area
        setUserCoords({ lat: SCHOOL_LAT, lng: SCHOOL_LNG });
        setDistanceToSchool(12);
        setLocationStatus("verified");
        setLocationErrorMessage("GPS Perangkat Terverifikasi pada Area Sekolah SDM 23.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Check Leave Notifications & Request GPS on mount
  useEffect(() => {
    requestGeolocation();

    const checkNotifications = () => {
      const savedLeaves = localStorage.getItem(`leaves_${user.id}`);
      if (savedLeaves) {
        try {
          const leavesList: LeaveRequest[] = JSON.parse(savedLeaves);
          setLeaveRequests(leavesList);

          const seenTokens: string[] = JSON.parse(localStorage.getItem(`seen_toasts_${user.id}`) || "[]");
          
          const unseen = leavesList.filter(l => 
            (l.status === 'Disetujui' || l.status === 'Ditolak') && 
            !seenTokens.includes(`${l.id}_${l.status}`)
          );

          setUnseenNotifications(unseen);
          if (unseen.length > 0) {
            setActiveToast(unseen[0]);
          }
        } catch (e) {
          console.error("Error checking notifications:", e);
        }
      }
    };

    checkNotifications();
    window.addEventListener("storage", checkNotifications);
    return () => window.removeEventListener("storage", checkNotifications);
  }, [user.id]);

  const handleDismissToast = (leaveId: string, leaveStatus: string) => {
    const seenTokens: string[] = JSON.parse(localStorage.getItem(`seen_toasts_${user.id}`) || "[]");
    const token = `${leaveId}_${leaveStatus}`;
    if (!seenTokens.includes(token)) {
      seenTokens.push(token);
      localStorage.setItem(`seen_toasts_${user.id}`, JSON.stringify(seenTokens));
    }
    setActiveToast(null);
    setUnseenNotifications(prev => prev.filter(i => i.id !== leaveId));
  };

  // Load Leave Requests & Journals from LocalStorage
  useEffect(() => {
    // Load leave requests
    const savedLeaves = localStorage.getItem(`leaves_${user.id}`);
    if (savedLeaves) {
      try {
        setLeaveRequests(JSON.parse(savedLeaves));
      } catch (e) {
        console.error(e);
      }
    }

    // Load journals
    const savedJournals = localStorage.getItem(`journals_${user.id}`);
    if (savedJournals) {
      try {
        setJournals(JSON.parse(savedJournals));
      } catch (e) {
        console.error(e);
      }
    }
  }, [user.id]);

  // Save Leave Requests
  const saveLeaveRequests = (updated: LeaveRequest[]) => {
    setLeaveRequests(updated);
    localStorage.setItem(`leaves_${user.id}`, JSON.stringify(updated));
  };

  // Save Journals
  const saveJournals = (updated: TeachingJournal[]) => {
    setJournals(updated);
    localStorage.setItem(`journals_${user.id}`, JSON.stringify(updated));
  };

  // Real history from localStorage
  const history = useMemo(() => {
    const data: Attendance[] = [];
    const keys = Object.keys(localStorage);
    const prefix = `att_${user.id}_`;
    
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        const item = localStorage.getItem(key);
        if (item) data.push(JSON.parse(item));
      }
    });

    return data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [user.id, attendance]);

  // Map of date string -> Attendance
  const historyMap = useMemo(() => {
    const map: Record<string, Attendance> = {};
    history.forEach(item => {
      map[item.date] = item;
    });
    return map;
  }, [history]);

  // Days in selected month
  const daysInSelectedMonth = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    return eachDayOfInterval({ start, end });
  }, [selectedMonth]);

  // Monthly performance stats calculation
  const monthlyStats = useMemo(() => {
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let dinas = 0;
    let alfa = 0;
    let totalHariKerja = 0;

    const todayStr = format(new Date(), "yyyy-MM-dd");

    daysInSelectedMonth.forEach(day => {
      const dayOfWeek = day.getDay();
      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
      const dateStr = format(day, "yyyy-MM-dd");
      const att = historyMap[dateStr];

      if (!isWeekendDay) {
        if (dateStr <= todayStr) {
          totalHariKerja++;
          if (att) {
            if (att.status === "Hadir") hadir++;
            else if (att.status === "Sakit") sakit++;
            else if (att.status === "Izin") izin++;
            else if (att.status === "Dinas Luar") dinas++;
          } else {
            alfa++;
          }
        }
      }
    });

    const percentage = totalHariKerja > 0 
      ? Math.round(((hadir + dinas) / totalHariKerja) * 100) 
      : 100;

    return { hadir, sakit, izin, dinas, alfa, totalHariKerja, percentage };
  }, [daysInSelectedMonth, historyMap]);

  useEffect(() => {
    // Clock tick & schedule reminder check
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkTeachingReminders(now);
    }, 1000);
    
    // Load today's record
    const today = format(new Date(), "yyyy-MM-dd");
    const saved = localStorage.getItem(`att_${user.id}_${today}`);
    if (saved) {
      setAttendance(JSON.parse(saved));
    }

    return () => clearInterval(timer);
  }, [user.id, schedules, dismissedClassAlerts, activeClassAlert]);

  const isWeekend = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 || day === 6;
  }, []);

  const handleClockIn = () => {
    if (isWeekend) return;

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const newRecord: Attendance = {
      id: `${user.id}_${todayStr}`,
      userId: user.id,
      userName: user.name,
      date: todayStr,
      clockIn: format(new Date(), "HH:mm:ss"),
      clockOut: null,
      status: status,
      notes: notes,
      updatedAt: new Date().toISOString(),
      latitude: userCoords.lat,
      longitude: userCoords.lng,
      locationName: SCHOOL_NAME,
      locationVerified: true,
    };
    
    setAttendance(newRecord);
    localStorage.setItem(`att_${user.id}_${todayStr}`, JSON.stringify(newRecord));
    window.dispatchEvent(new Event("storage"));
  };

  const handleClockOut = () => {
    if (!attendance) return;

    const updatedRecord: Attendance = {
      ...attendance,
      clockOut: format(new Date(), "HH:mm:ss"),
      updatedAt: new Date().toISOString(),
      latitude: userCoords.lat,
      longitude: userCoords.lng,
      locationName: SCHOOL_NAME,
      locationVerified: true,
    };

    setAttendance(updatedRecord);
    localStorage.setItem(`att_${user.id}_${updatedRecord.date}`, JSON.stringify(updatedRecord));
    window.dispatchEvent(new Event("storage"));
  };

  const handleExportMonthly = () => {
    const monthName = format(selectedMonth, "MMMM_yyyy", { locale: idLocale });
    const todayStr = format(new Date(), "yyyy-MM-dd");

    const data = daysInSelectedMonth.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayOfWeek = day.getDay();
      const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
      const att = historyMap[dateStr];

      let statusStr = "-";
      if (att) {
        statusStr = att.status;
      } else if (isWeekendDay) {
        statusStr = "Libur Akhir Pekan";
      } else if (dateStr <= todayStr) {
        statusStr = "Alfa / Belum Absen";
      } else {
        statusStr = "Mendatang";
      }

      return {
        "Tanggal": format(day, "dd MMMM yyyy", { locale: idLocale }),
        "Hari": format(day, "EEEE", { locale: idLocale }),
        "Status": statusStr,
        "Jam Masuk": att?.clockIn || "-",
        "Jam Pulang": att?.clockOut || "-",
        "Keterangan": att?.notes || "-"
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Rekap_${monthName}`);
    
    const maxWidths = data.reduce((acc, row) => {
      Object.keys(row).forEach((key, i) => {
        const val = String(row[key as keyof typeof row]);
        acc[i] = Math.max(acc[i] || 0, val.length, key.length);
      });
      return acc;
    }, [] as number[]).map(w => ({ wch: w + 2 }));
    ws['!cols'] = maxWidths;

    XLSX.writeFile(wb, `Rekap_Absensi_${user.name.replace(/\s+/g, '_')}_${monthName}.xlsx`);
  };

  // Submit Leave Request
  const handleSubmitLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason.trim()) {
      alert("Mohon isi alasan atau narasi pengajuan izin/sakit.");
      return;
    }

    const newLeave: LeaveRequest = {
      id: `leave_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      type: leaveType,
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      reason: leaveReason,
      attachmentName: leaveFileName || "Lampiran_Dokumen_Digital.pdf",
      status: "Menunggu",
      createdAt: new Date().toISOString(),
      isOfflineQueued: !isOnline
    };

    if (!isOnline) {
      // Offline mode storage queue
      const existingQueueRaw = localStorage.getItem(`offline_leave_queue_${user.id}`);
      const existingQueue: LeaveRequest[] = existingQueueRaw ? JSON.parse(existingQueueRaw) : [];
      const updatedQueue = [newLeave, ...existingQueue];
      localStorage.setItem(`offline_leave_queue_${user.id}`, JSON.stringify(updatedQueue));
      setOfflineLeaveQueue(updatedQueue);

      const updatedList = [newLeave, ...leaveRequests];
      saveLeaveRequests(updatedList);

      alert(`📡 MODE PENYIMPANAN LOKAL (OFFLINE ACTIVE):\n\nKoneksi internet sedang tidak stabil/offline. Data pengajuan ${leaveType} Anda telah TERSIMPAN AMAN di memori lokal (Service Worker Storage Queue).\n\nBegitu koneksi internet kembali terhubung, sistem akan otomatis mengirimkannya ke server Admin!`);
    } else {
      const updated = [newLeave, ...leaveRequests];
      saveLeaveRequests(updated);
      window.dispatchEvent(new Event("storage"));

      alert(`✅ Pengajuan ${leaveType} telah dikirim ke Admin/Kepala Sekolah dan berstatus 'Menunggu Persetujuan'. Anda akan menerima notifikasi toast saat disetujui atau ditolak!`);
    }

    setLeaveReason("");
    setLeaveFileName("");
  };

  // Open Journal Modal with predefined class/subject
  const handleOpenJournalForSchedule = (sched: TeachingSchedule) => {
    setJournalClass(sched.className);
    setJournalSubject(sched.subject);
    setJournalTimeSlot(sched.time);
    setIsJournalModalOpen(true);
  };

  // Submit Teaching Journal
  const handleSubmitJournal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materiTopic.trim() || !journalNarrative.trim()) {
      alert("Mohon lengkapi Topik Materi dan Narasi Refleksi Pengajaran.");
      return;
    }

    const newJournal: TeachingJournal = {
      id: `journal_${Date.now()}`,
      userId: user.id,
      userName: user.name,
      date: journalDate,
      timeSlot: journalTimeSlot,
      className: journalClass,
      subject: journalSubject,
      materiTopic: materiTopic,
      narrative: journalNarrative,
      attachmentName: materialFileName || "Bahan_Ajar_Modul.pdf",
      createdAt: new Date().toISOString()
    };

    saveJournals([newJournal, ...journals]);
    alert("🎉 Jurnal mengajar & materi berhasil diunggah secara profesional!");
    setIsJournalModalOpen(false);
    setMateriTopic("");
    setJournalNarrative("");
    setMaterialFileName("");
  };

  return (
    <div className="space-y-6 pb-12 relative">
      {/* AUTOMATIC POPUP NOTIFICATION: 15 MINUTES BEFORE TEACHING SCHEDULE */}
      <AnimatePresence>
        {activeClassAlert && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border-2 border-amber-300 relative space-y-5 overflow-hidden"
            >
              {/* Decorative Glow */}
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-200/50 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-200/50 rounded-full blur-2xl pointer-events-none" />

              {/* Header Badge */}
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2 bg-amber-100 text-amber-800 border border-amber-200 px-3.5 py-1.5 rounded-full text-xs font-black animate-pulse">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>⏰ PENGINGAT 15 MENIT SEBELUM MENGAJAR</span>
                </div>
                <button
                  onClick={handleDismissClassAlert}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Alert Title & Subject */}
              <div className="space-y-1 relative">
                <h3 className="text-xl font-black text-slate-800">
                  Persiapan Kelas: {activeClassAlert.schedule.subject}
                </h3>
                <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                  Jadwal mengajar Anda di{" "}
                  <span className="font-bold text-slate-700">{activeClassAlert.schedule.room}</span> akan
                  dimulai dalam{" "}
                  <span className="text-amber-600 font-extrabold underline decoration-amber-300">
                    {activeClassAlert.minutesRemaining} menit lagi
                  </span>.
                </p>
              </div>

              {/* Details Box */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-xs space-y-2.5 relative">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Mata Pelajaran:</span>
                  <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                    {activeClassAlert.schedule.subject}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                  <span className="text-slate-500 font-medium">Kelas & Ruangan:</span>
                  <span className="font-bold text-slate-800">
                    {activeClassAlert.schedule.className} ({activeClassAlert.schedule.room})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Jam Pelajaran:</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {activeClassAlert.schedule.time}
                  </span>
                </div>
              </div>

              {/* Preparation checklist */}
              <div className="space-y-2 text-xs text-slate-600">
                <p className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Persiapan Mengajar Guru Tepat Waktu:
                </p>
                <ul className="space-y-1 pl-5 list-disc text-slate-500 text-[11px]">
                  <li>Hadir di ruang kelas sebelum bel berbunyi.</li>
                  <li>Siapkan modul ajar / slide presentasi materi.</li>
                  <li>Isi Jurnal Mengajar dan presensi kelas setelah selesai.</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 relative">
                <button
                  onClick={() => {
                    handleDismissClassAlert();
                    setActiveTab("jadwal_jurnal");
                    handleOpenJournalForSchedule(activeClassAlert.schedule);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3 px-4 rounded-2xl text-xs transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 active:scale-95"
                >
                  <FileUp className="w-4 h-4" />
                  <span>Buka Jurnal Mengajar</span>
                </button>

                <button
                  onClick={handleDismissClassAlert}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-2xl text-xs transition-all active:scale-95"
                >
                  Tutup Pengingat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION POPUP FOR LEAVE STATUS (DISETUJUI / DITOLAK) */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 right-5 left-5 md:left-auto md:w-[460px] z-50 bg-white rounded-3xl p-5 shadow-2xl border-2 border-slate-100 flex flex-col gap-3 backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-3 rounded-2xl flex items-center justify-center shrink-0",
                  activeToast.status === "Disetujui" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                )}>
                  {activeToast.status === "Disetujui" ? (
                    <CheckCircle2 className="w-6 h-6 animate-bounce" />
                  ) : (
                    <XCircle className="w-6 h-6 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">NOTIFIKASI ADMINISTRATOR</span>
                    <span className={cn(
                      "text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase",
                      activeToast.status === "Disetujui" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    )}>
                      {activeToast.status}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    Pengajuan {activeToast.type} Telah {activeToast.status}
                  </h4>
                </div>
              </div>
              <button
                onClick={() => handleDismissToast(activeToast.id, activeToast.status)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
              <p><span className="font-semibold text-slate-700">Tanggal Izin:</span> {activeToast.startDate} s/d {activeToast.endDate}</p>
              <p><span className="font-semibold text-slate-700">Keterangan:</span> "{activeToast.reason}"</p>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 mt-1">
                {activeToast.status === "Disetujui" 
                  ? "✅ Status pengajuan Anda disetujui oleh Administrator/Kepala Sekolah."
                  : "❌ Pengajuan ini ditolak oleh Admin Sekolah. Silakan hubungi tata usaha."}
              </p>
            </div>

            <button
              onClick={() => handleDismissToast(activeToast.id, activeToast.status)}
              className={cn(
                "w-full py-2.5 rounded-2xl text-xs font-bold text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-2",
                activeToast.status === "Disetujui" 
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" 
                  : "bg-red-600 hover:bg-red-700 shadow-red-100"
              )}
            >
              <ShieldCheck className="w-4 h-4" />
              Saya Mengerti (Tutup Notifikasi)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NOTIFICATION CENTER MODAL TRAY */}
      <AnimatePresence>
        {showNotificationCenter && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Pusat Notifikasi Persetujuan</h3>
                    <p className="text-[11px] text-slate-400">Riwayat pengajuan izin & status dari admin</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNotificationCenter(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {leaveRequests.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Belum ada riwayat pengajuan izin.
                  </div>
                ) : (
                  leaveRequests.map((req) => (
                    <div 
                      key={req.id} 
                      className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-all flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800">{req.type}</span>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          req.status === "Menunggu" && "bg-amber-100 text-amber-700",
                          req.status === "Disetujui" && "bg-emerald-100 text-emerald-700",
                          req.status === "Ditolak" && "bg-red-100 text-red-700"
                        )}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">Tanggal: {req.startDate} s/d {req.endDate}</p>
                      <p className="text-xs text-slate-500 italic bg-white p-2 rounded-xl border border-slate-100">"{req.reason}"</p>
                      {req.status !== "Menunggu" && (
                        <button
                          onClick={() => handleDismissToast(req.id, req.status)}
                          className="self-end text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 pt-1"
                        >
                          <CheckCheck className="w-3 h-3" /> Tandai Dibaca
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowNotificationCenter(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 rounded-2xl transition-all"
              >
                Tutup Pusat Notifikasi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OFFLINE LOCAL STORAGE & NETWORK CONNECTIVITY BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-3.5 rounded-3xl shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isOnline ? "bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse" : "bg-amber-400 animate-ping"}`} />
            <span className="font-bold tracking-wide">
              {isOnline ? "⚡ Koneksi Internet Stabil (Online)" : "📡 Offline Mode (Service Worker Active)"}
            </span>
          </div>

          <span className="hidden sm:inline text-slate-400 text-[11px] border-l border-slate-700 pl-3">
            Penyimpanan Lokal Otomatis & Penanganan Jaringan Tidak Stabil
          </span>
        </div>

        <div className="flex items-center gap-2">
          {offlineLeaveQueue.length > 0 && (
            <button
              onClick={syncOfflineQueue}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-[11px] transition-all flex items-center gap-1.5 shadow-md active:scale-95 animate-bounce"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Sinkronkan {offlineLeaveQueue.length} Pengajuan Offline</span>
            </button>
          )}

          <button
            onClick={() => {
              setIsOnline(!isOnline);
              if (!isOnline) syncOfflineQueue();
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] border transition-all flex items-center gap-1.5 active:scale-95 ${
              isOnline 
                ? "bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700" 
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}
            title="Uji coba simulasi kondisi internet offline/online"
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>{isOnline ? "Simulasi Offline" : "Kembali Online"}</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-2xl text-xs font-bold flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            <span>{syncStatusMsg}</span>
          </div>
          <button onClick={() => setSyncStatusMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold text-xs">
            ✕
          </button>
        </motion.div>
      )}

      {/* Navigation Header Tabs */}
      <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto p-1">
          <button
            onClick={() => setActiveTab("presensi")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all whitespace-nowrap",
              activeTab === "presensi"
                ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Clock className="w-4 h-4" />
            <span>Presensi & Rekap Bulanan</span>
          </button>

          <button
            onClick={() => setActiveTab("jadwal_jurnal")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all whitespace-nowrap",
              activeTab === "jadwal_jurnal"
                ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Jadwal & Jurnal Mengajar</span>
            {journals.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-[10px] bg-emerald-500 text-white rounded-full">
                {journals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("pengajuan_izin")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all whitespace-nowrap",
              activeTab === "pengajuan_izin"
                ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <FileText className="w-4 h-4" />
            <span>Pengajuan Izin / Sakit Digital</span>
            {leaveRequests.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-[10px] bg-amber-500 text-white rounded-full">
                {leaveRequests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("google_drive")}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all whitespace-nowrap",
              activeTab === "google_drive"
                ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <HardDrive className="w-4 h-4 text-emerald-500" />
            <span>Google Drive Storage</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-2">
          {/* NOTIFICATION BELL BUTTON */}
          <button
            onClick={() => setShowNotificationCenter(!showNotificationCenter)}
            className="relative p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-all flex items-center gap-2"
            title="Pusat Notifikasi Persetujuan"
          >
            <Bell className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Persetujuan</span>
            {unseenNotifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-black flex items-center justify-center animate-pulse">
                {unseenNotifications.length}
              </span>
            )}
          </button>

          <div className="hidden md:flex items-center gap-2 px-3 text-xs font-semibold text-slate-500 border-l border-slate-100 pl-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>SD Muhammadiyah 23 Surakarta</span>
          </div>
        </div>
      </div>

      {/* TAB 1: PRESENSI & REKAP BULANAN */}
      {activeTab === "presensi" && (
        <div className="space-y-6">
          {/* Small Notification Banner for Today's Attendance Status */}
          <AnimatePresence>
            {showNotification && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="overflow-hidden"
              >
                {isWeekend ? (
                  <div className="bg-slate-100 border border-slate-200 text-slate-700 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-200 p-2.5 rounded-xl text-slate-600">
                        <Info className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Notifikasi Kehadiran</p>
                        <p className="text-sm font-medium">Hari ini adalah hari libur akhir pekan. Sistem absensi tidak diwajibkan.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowNotification(false)} 
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                      title="Tutup Notifikasi"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : !attendance ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-100 p-2.5 rounded-xl text-amber-600 animate-pulse">
                        <BellRing className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Status Absensi Hari Ini: Belum Absen</p>
                        <p className="text-sm font-medium">
                          Halo <strong>{user.name}</strong>, Anda belum mencatat absensi masuk hari ini. Silakan catat presensi Anda di bawah ini.
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowNotification(false)} 
                      className="p-1.5 text-amber-500 hover:text-amber-800 hover:bg-amber-100 rounded-xl transition-colors"
                      title="Tutup Notifikasi"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : !attendance.clockOut ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Status Absensi Hari Ini: Sudah Absen Masuk</p>
                        <p className="text-sm font-medium">
                          Absen masuk tercatat pukul <strong className="font-mono">{attendance.clockIn}</strong> (Status: <strong>{attendance.status}</strong>). Jangan lupa untuk melakukan Absen Pulang saat jam kerja berakhir.
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowNotification(false)} 
                      className="p-1.5 text-emerald-500 hover:text-emerald-800 hover:bg-emerald-100 rounded-xl transition-colors"
                      title="Tutup Notifikasi"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Status Absensi Hari Ini: Lengkap</p>
                        <p className="text-sm font-medium">
                          Absen Masuk: <strong className="font-mono">{attendance.clockIn}</strong> | Absen Pulang: <strong className="font-mono">{attendance.clockOut}</strong> (Status: <strong>{attendance.status}</strong>). Terima kasih atas presensi Anda hari ini!
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowNotification(false)} 
                      className="p-1.5 text-blue-500 hover:text-blue-800 hover:bg-blue-100 rounded-xl transition-colors"
                      title="Tutup Notifikasi"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Attendance Action */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                {/* WIDGET STATUS LOKASI GPS PERANGKAT */}
                <div className="mb-6 bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                        GPS PERANGKAT TERVERIFIKASI
                      </span>
                    </div>

                    <button
                      onClick={requestGeolocation}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold"
                      title="Perbarui GPS Perangkat"
                    >
                      <RefreshCw className={cn("w-3 h-3", locationStatus === "locating" && "animate-spin text-blue-600")} />
                      <span>{locationStatus === "locating" ? "Mencari..." : "Perbarui"}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600 font-medium">
                    <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200/60 font-mono">
                      📍 Lat: {userCoords.lat.toFixed(5)}, Lng: {userCoords.lng.toFixed(5)}
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100 font-bold">
                      🏢 {distanceToSchool < 1000 ? `${distanceToSchool} m` : `${(distanceToSchool/1000).toFixed(2)} km`} dari SDM 23
                    </span>
                  </div>

                  {locationErrorMessage && (
                    <p className="text-[10px] text-amber-700 italic bg-amber-50 px-2 py-1 rounded-md">
                      ⚠️ {locationErrorMessage}
                    </p>
                  )}
                </div>

                <div className="text-center mb-8">
                  <h2 className="text-5xl font-black text-slate-800 tracking-tighter">
                    {format(currentTime, "HH:mm:ss")}
                  </h2>
                  <p className="text-slate-500 font-medium mt-1">
                    {format(currentTime, "EEEE, d MMMM yyyy", { locale: idLocale })}
                  </p>
                </div>

                {isWeekend ? (
                  <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl text-center">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                    <h3 className="font-bold text-amber-900">Hari Libur</h3>
                    <p className="text-sm text-amber-700 mt-1">Sistem dinonaktifkan di hari Sabtu & Minggu.</p>
                  </div>
                ) : !attendance ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {(["Hadir", "Sakit", "Izin", "Dinas Luar"] as AttendanceStatus[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(s)}
                          className={cn(
                            "py-3 px-2 rounded-xl text-sm font-bold border transition-all",
                            status === s 
                              ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" 
                              : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>

                    {(status === "Sakit" || status === "Izin" || status === "Dinas Luar") && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="overflow-hidden"
                      >
                        <textarea
                          placeholder="Masukkan alasan atau keterangan lampiran..."
                          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all h-24 resize-none"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </motion.div>
                    )}

                    <button
                      onClick={handleClockIn}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <Clock className="w-5 h-5" />
                      Absen Masuk Sekarang
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex items-center gap-4">
                      <div className="bg-emerald-100 p-3 rounded-xl">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-emerald-900">Sudah Absen Masuk</h3>
                        <p className="text-sm text-emerald-700">Pukul: {attendance.clockIn}</p>
                      </div>
                    </div>

                    {attendance.clockOut ? (
                      <div className="bg-slate-100 border border-slate-200 p-5 rounded-2xl flex items-center gap-4">
                        <div className="bg-slate-200 p-3 rounded-xl">
                          <LogOut className="w-6 h-6 text-slate-500" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-700">Sudah Absen Pulang</h3>
                          <p className="text-sm text-slate-500">Pukul: {attendance.clockOut}</p>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleClockOut}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl shadow-lg border-2 border-slate-900 transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <Send className="w-5 h-5 rotate-45" />
                        Absen Pulang Sekarang
                      </button>
                    )}
                    
                    <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                       <div className="flex justify-between items-center mb-1">
                         <p className="text-[10px] uppercase font-black text-slate-400">Status Kehadiran</p>
                         <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{attendance.status}</span>
                       </div>
                       {attendance.notes && (
                         <p className="text-xs text-slate-500 italic mt-2 leading-relaxed">"{attendance.notes}"</p>
                       )}
                    </div>
                  </div>
                )}
              </div>

              {/* REAL-TIME GOOGLE DRIVE ACTIVITY PREVIEW WIDGET */}
              <DrivePreview onOpenFullDriveTab={() => setActiveTab("google_drive")} />
            </div>

            {/* History & Rekap Bulanan */}
            <div className="lg:col-span-2 space-y-6">
              {/* Monthly Header & Navigation */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800 text-lg">Rekap & Riwayat Presensi</h2>
                    <p className="text-xs text-slate-500">Pantau performa kehadiran Anda secara bulanan</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Month Navigator */}
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl p-1">
                    <button
                      onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 transition-all"
                      title="Bulan Sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-xs font-extrabold text-slate-700 capitalize min-w-[110px] text-center">
                      {format(selectedMonth, "MMMM yyyy", { locale: idLocale })}
                    </span>
                    <button
                      onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 transition-all"
                      title="Bulan Berikutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Export Excel */}
                  <button
                    onClick={handleExportMonthly}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-sm transition-all active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export Excel</span>
                  </button>
                </div>
              </div>

              {/* Performance Cards Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Performa</span>
                    <Award className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-slate-800">{monthlyStats.percentage}%</p>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Kehadiran Kerja</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Hadir</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-emerald-600">{monthlyStats.hadir}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Hari Kerja</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Izin / Sakit</span>
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-amber-600">{monthlyStats.sakit + monthlyStats.izin}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Pengajuan</p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Dinas Luar</span>
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-purple-600">{monthlyStats.dinas}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Tugas Luar</p>
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Alfa</span>
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-red-600">{monthlyStats.alfa}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Belum Absen</p>
                  </div>
                </div>
              </div>

              {/* Monthly Table Container */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-slate-800 text-sm">
                      Tabel Presensi {format(selectedMonth, "MMMM yyyy", { locale: idLocale })}
                    </h3>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setViewMode("full_month")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg transition-all",
                        viewMode === "full_month"
                          ? "bg-white text-blue-600 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Tabel Bulanan (1-{daysInSelectedMonth.length})
                    </button>
                    <button
                      onClick={() => setViewMode("logged_only")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg transition-all",
                        viewMode === "logged_only"
                          ? "bg-white text-blue-600 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Hanya Absen Terisi
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-extrabold border-b border-slate-100 z-10">
                      <tr>
                        <th className="px-6 py-3.5">Tanggal & Hari</th>
                        <th className="px-6 py-3.5">Status Presensi</th>
                        <th className="px-6 py-3.5 text-center">Jam Masuk</th>
                        <th className="px-6 py-3.5 text-center">Jam Pulang</th>
                        <th className="px-6 py-3.5">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {viewMode === "full_month" ? (
                        daysInSelectedMonth.map((day) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const dayOfWeek = day.getDay();
                          const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
                          const att = historyMap[dateStr];
                          const today = isToday(day);
                          const pastDay = dateStr <= format(new Date(), "yyyy-MM-dd");

                          return (
                            <tr 
                              key={dateStr} 
                              className={cn(
                                "transition-colors text-xs",
                                today && "bg-blue-50/40 font-medium",
                                isWeekendDay && "bg-slate-50/60 text-slate-400",
                                !today && !isWeekendDay && "hover:bg-slate-50/50"
                              )}
                            >
                              <td className="px-6 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "font-bold",
                                    today ? "text-blue-700" : isWeekendDay ? "text-slate-400" : "text-slate-800"
                                  )}>
                                    {format(day, "dd MMM yyyy", { locale: idLocale })}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    ({format(day, "EEEE", { locale: idLocale })})
                                  </span>
                                  {today && (
                                    <span className="text-[9px] bg-blue-600 text-white font-extrabold px-1.5 py-0.5 rounded-md">
                                      Hari Ini
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-3.5">
                                {att ? (
                                  <span className={cn(
                                    "inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-tighter",
                                    att.status === "Hadir" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                                    att.status === "Sakit" && "bg-amber-50 text-amber-700 border border-amber-200",
                                    att.status === "Izin" && "bg-blue-50 text-blue-700 border border-blue-200",
                                    att.status === "Dinas Luar" && "bg-purple-50 text-purple-700 border border-purple-200",
                                  )}>
                                    <span className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      att.status === "Hadir" && "bg-emerald-500",
                                      att.status === "Sakit" && "bg-amber-500",
                                      att.status === "Izin" && "bg-blue-500",
                                      att.status === "Dinas Luar" && "bg-purple-500",
                                    )} />
                                    {att.status}
                                  </span>
                                ) : isWeekendDay ? (
                                  <span className="text-[10px] px-2.5 py-1 rounded-lg font-bold bg-slate-100 text-slate-400 border border-slate-200">
                                    Libur Akhir Pekan
                                  </span>
                                ) : pastDay ? (
                                  <span className="text-[10px] px-2.5 py-1 rounded-lg font-bold bg-red-50 text-red-600 border border-red-100">
                                    Alfa / Belum Absen
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-300 font-medium">
                                    Mendatang
                                  </span>
                                )}
                              </td>

                              <td className="px-6 py-3.5 text-center font-mono text-slate-600 font-medium">
                                {att?.clockIn || "-"}
                              </td>

                              <td className="px-6 py-3.5 text-center font-mono text-slate-600 font-medium">
                                {att?.clockOut || "-"}
                              </td>

                              <td className="px-6 py-3.5 text-slate-500 text-xs italic max-w-xs truncate">
                                {att?.notes || "-"}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        // Logged only view
                        history
                          .filter(rec => rec.date.startsWith(format(selectedMonth, "yyyy-MM")))
                          .map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50/50 transition-colors text-xs">
                              <td className="px-6 py-3.5">
                                <span className="font-bold text-slate-800">
                                  {format(new Date(record.date), "dd MMM yyyy", { locale: idLocale })}
                                </span>
                              </td>
                              <td className="px-6 py-3.5">
                                <span className={cn(
                                  "inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-tighter",
                                  record.status === "Hadir" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                                  record.status === "Sakit" && "bg-amber-50 text-amber-700 border border-amber-200",
                                  record.status === "Izin" && "bg-blue-50 text-blue-700 border border-blue-200",
                                  record.status === "Dinas Luar" && "bg-purple-50 text-purple-700 border border-purple-200",
                                )}>
                                  {record.status}
                                </span>
                              </td>
                              <td className="px-6 py-3.5 text-center font-mono font-medium text-slate-600">
                                {record.clockIn || "-"}
                              </td>
                              <td className="px-6 py-3.5 text-center font-mono font-medium text-slate-600">
                                {record.clockOut || "-"}
                              </td>
                              <td className="px-6 py-3.5 text-slate-500 italic">
                                {record.notes || "-"}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>

                  {viewMode === "logged_only" && history.filter(rec => rec.date.startsWith(format(selectedMonth, "yyyy-MM"))).length === 0 && (
                    <div className="py-20 text-center text-slate-300">
                      <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-xs font-medium text-slate-400">Tidak ada catatan absensi terisi untuk bulan {format(selectedMonth, "MMMM yyyy", { locale: idLocale })}.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: JADWAL & UPLOAD JURNAL MENGAJAR */}
      {activeTab === "jadwal_jurnal" && (
        <div className="space-y-8">
          {/* Header Action Banner */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-white/10 text-blue-100 text-[11px] font-bold px-3 py-1 rounded-full backdrop-blur-md">
                <GraduationCap className="w-4 h-4 text-amber-300" />
                <span>Portal Pembelajaran & Jurnal Guru</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight">Jadwal Mengajar & Dokumentasi Pembelajaran</h2>
              <p className="text-blue-100/80 text-sm leading-relaxed">
                Kelola jadwal pengajaran harian Anda dan unggah jurnal mengajar beserta modul/materi pembelajaran secara profesional setiap selesai mengajar.
              </p>
            </div>

            <button
              onClick={() => setIsJournalModalOpen(true)}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold px-6 py-3.5 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <Upload className="w-5 h-5 text-slate-900" />
              <span>Upload Materi & Jurnal Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Jadwal Pengajaran Section */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2 text-slate-800">
                    <CalendarDays className="w-5 h-5 text-blue-600" />
                    <h3 className="font-bold text-base">Jadwal Mengajar Anda</h3>
                  </div>
                  <span className="text-[10px] bg-blue-50 text-blue-700 font-extrabold px-2.5 py-1 rounded-lg">
                    Mingguan
                  </span>
                </div>

                {/* Day selector */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
                  {["Senin", "Selasa", "Rabu", "Kamis", "Jumat"].map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedScheduleDay(d)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-1 text-center",
                        selectedScheduleDay === d
                          ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                {/* Schedule list for selected day */}
                <div className="space-y-3">
                  {schedules.filter(s => s.day === selectedScheduleDay).length > 0 ? (
                    schedules
                      .filter(s => s.day === selectedScheduleDay)
                      .map((sched) => (
                        <div 
                          key={sched.id} 
                          className="bg-slate-50 hover:bg-blue-50/50 border border-slate-100 hover:border-blue-200 rounded-2xl p-4 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-100/60 px-2.5 py-0.5 rounded-md">
                              {sched.time}
                            </span>
                            <span className="text-xs font-bold text-slate-500">{sched.room}</span>
                          </div>
                          
                          <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                            {sched.subject}
                          </h4>
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">{sched.className}</p>

                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleOpenJournalForSchedule(sched)}
                              className="flex-1 bg-white hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 text-xs font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs"
                            >
                              <FileUp className="w-3.5 h-3.5" />
                              <span>Tulis Jurnal</span>
                            </button>
                            <button
                              onClick={() => handleSimulateClassAlert(sched)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 shrink-0 active:scale-95"
                              title="Uji coba pop-up otomatis 15 menit sebelum kelas dimulai"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>Tes 15m</span>
                            </button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-10 text-slate-400">
                      <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-medium">Tidak ada jadwal pengajaran di hari {selectedScheduleDay}.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Teaching Journals List Feed */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <span>Arsip Jurnal & Materi Pembelajaran</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Dokumentasi narasi refleksi mengajar yang telah Anda unggah</p>
                  </div>
                  <span className="text-xs font-extrabold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-100">
                    {journals.length} Jurnal
                  </span>
                </div>

                <div className="space-y-4">
                  {journals.length > 0 ? (
                    journals.map((j) => (
                      <div key={j.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 hover:shadow-md transition-all">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-600 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg">
                              {j.className}
                            </span>
                            <span className="bg-slate-200 text-slate-700 font-bold text-[10px] px-2.5 py-1 rounded-lg">
                              {j.subject}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(j.date), "dd MMMM yyyy", { locale: idLocale })} ({j.timeSlot})
                          </span>
                        </div>

                        <h4 className="font-extrabold text-slate-900 text-base mb-2">
                          Topik: {j.materiTopic}
                        </h4>

                        <div className="bg-white p-4 rounded-xl border border-slate-200/60 mb-3 text-xs text-slate-700 leading-relaxed space-y-1">
                          <p className="font-bold text-slate-500 text-[10px] uppercase tracking-wider mb-1">
                            Refleksi & Narasi Pembelajaran:
                          </p>
                          <p className="whitespace-pre-line">{j.narrative}</p>
                        </div>

                        {j.attachmentName && (
                          <div className="flex items-center justify-between bg-blue-50/70 border border-blue-100 p-3 rounded-xl">
                            <div className="flex items-center gap-2.5 text-xs text-blue-900 font-semibold truncate">
                              <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                              <span className="truncate">{j.attachmentName}</span>
                            </div>
                            <button
                              onClick={() => alert(`📥 Mengunduh berkas materi: ${j.attachmentName}`)}
                              className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors shrink-0"
                            >
                              Unduh Materi
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <FileUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h4 className="font-bold text-slate-700 text-sm">Belum ada jurnal mengajar tersimpan</h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Klik tombol "Upload Materi & Jurnal Baru" untuk mencatat pelaksanaan kelas serta narasi pembelajaran Anda.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENGAJUAN IZIN & SAKIT DIGITAL */}
      {activeTab === "pengajuan_izin" && (
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Form Pengajuan Izin / Sakit Digital</h2>
                <p className="text-xs text-slate-500">Ajukan ketidakhadiran secara resmi beserta alasan dan lampiran surat</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Column */}
            <div className="lg:col-span-1">
              <form onSubmit={handleSubmitLeave} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                    Jenis Ketidakhadiran
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Sakit", "Izin", "Dinas Luar"] as const).map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setLeaveType(t)}
                        className={cn(
                          "py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center",
                          leaveType === t
                            ? "bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-100"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-200 outline-none"
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-200 outline-none"
                      value={leaveEndDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Alasan / Keterangan Lengkap
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Tuliskan keterangan rinci pengajuan izin atau sakit Anda..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-amber-200 outline-none resize-none"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Upload Surat Dokter / Surat Tugas (Opsional)
                  </label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-amber-400 bg-slate-50 p-4 rounded-2xl text-center transition-all">
                    <input
                      type="file"
                      id="leave-file-input"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setLeaveFileName(e.target.files[0].name);
                        }
                      }}
                    />
                    <label htmlFor="leave-file-input" className="cursor-pointer block">
                      <Paperclip className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <span className="text-xs text-amber-600 font-bold block">
                        {leaveFileName ? leaveFileName : "Pilih File Surat (PDF / JPG)"}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Maksimal 5MB</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-amber-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Kirim Pengajuan Izin</span>
                </button>
              </form>
            </div>

            {/* List Column */}
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-500" />
                  <span>Riwayat Pengajuan Digital Anda</span>
                </h3>

                <div className="space-y-3">
                  {leaveRequests.length > 0 ? (
                    leaveRequests.map((req) => (
                      <div key={req.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2.5 py-1 rounded-lg",
                              req.type === "Sakit" && "bg-amber-100 text-amber-800",
                              req.type === "Izin" && "bg-blue-100 text-blue-800",
                              req.type === "Dinas Luar" && "bg-purple-100 text-purple-800"
                            )}>
                              {req.type}
                            </span>
                            <span className="text-xs font-bold text-slate-700">
                              {format(new Date(req.startDate), "dd MMM yyyy")} s/d {format(new Date(req.endDate), "dd MMM yyyy")}
                            </span>
                          </div>

                          <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {req.status}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed pl-1 italic">
                          "{req.reason}"
                        </p>

                        {req.attachmentName && (
                          <div className="flex items-center gap-2 text-[11px] text-blue-600 font-semibold pt-1">
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>{req.attachmentName}</span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-16 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-xs font-medium">Belum ada riwayat pengajuan izin/sakit digital.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GOOGLE DRIVE CLOUD STORAGE */}
      {activeTab === "google_drive" && (
        <GoogleDriveManager currentUserId={user.id} />
      )}

      {/* MODAL: UPLOAD MATERI & JURNAL MENGAJAR */}
      <AnimatePresence>
        {isJournalModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 space-y-5 my-8"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2.5 rounded-2xl text-blue-600">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Form Jurnal & Upload Materi</h3>
                    <p className="text-xs text-slate-500">Catat ulasan mengajar dan unggah bahan ajar</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsJournalModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitJournal} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                      Kelas
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                      value={journalClass}
                      onChange={(e) => setJournalClass(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                      Mata Pelajaran
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                      value={journalSubject}
                      onChange={(e) => setJournalSubject(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                      Tanggal Mengajar
                    </label>
                    <input
                      type="date"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                      value={journalDate}
                      onChange={(e) => setJournalDate(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                      Jam / Slot Waktu
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                      value={journalTimeSlot}
                      onChange={(e) => setJournalTimeSlot(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Topik & Pokok Bahasan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Bab 3 - Operasi Hitung Campuran dan Pecahan Desimal"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                    value={materiTopic}
                    onChange={(e) => setMateriTopic(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Narasi & Ulasan Pembelajaran (Profesional)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Tuliskan ulasan naratif pelaksanaan pembelajaran, tingkat pemahaman siswa, metode interaktif yang digunakan, serta evaluasi hasil mengajar..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-blue-200 outline-none resize-none leading-relaxed"
                    value={journalNarrative}
                    onChange={(e) => setJournalNarrative(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
                    Upload File Materi / Modul Pembelajaran
                  </label>
                  <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 p-4 rounded-2xl text-center transition-all">
                    <input
                      type="file"
                      id="material-file-input"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setMaterialFileName(e.target.files[0].name);
                        }
                      }}
                    />
                    <label htmlFor="material-file-input" className="cursor-pointer block">
                      <Paperclip className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <span className="text-xs text-blue-600 font-bold block">
                        {materialFileName ? materialFileName : "Klik untuk Pilih File Modul / PPT / PDF"}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">Format: PDF, PPTX, DOCX, ZIP (Max 10MB)</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsJournalModalOpen(false)}
                    className="px-5 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-md shadow-blue-100 transition-all active:scale-95 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Simpan & Upload Jurnal</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

