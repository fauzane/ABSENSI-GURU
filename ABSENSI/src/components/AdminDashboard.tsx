import { useState, useEffect, useMemo } from "react";
import { User, DailySummary, Attendance, LeaveRequest } from "../types";
import { 
  Users, 
  Calendar, 
  FileDown, 
  Search, 
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  UserX,
  Plus,
  BellRing,
  MapPin,
  Check,
  X,
  FileText,
  ShieldCheck
} from "lucide-react";
import { format, isAfter, setHours, setMinutes } from "date-fns";
import { cn } from "../lib/utils";
import * as XLSX from "xlsx";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import TeacherModal from "./TeacherModal";
import GoogleDriveManager from "./GoogleDriveManager";

interface AdminDashboardProps {
  user: User;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [teachers, setTeachers] = useState<User[]>([]);
  const [attendances, setAttendances] = useState<Record<string, Attendance>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);

  // Load all data (Teachers + Today's Attendance + Leave Requests)
  const refreshData = () => {
    // 1. Load Teachers
    const savedTeachers = localStorage.getItem("sdm23_teachers");
    let currentTeachers: User[] = [];
    if (savedTeachers) {
      currentTeachers = JSON.parse(savedTeachers);
    } else {
      currentTeachers = Array.from({ length: 33 }, (_, i) => ({
        id: `19850101${(i + 1).toString().padStart(3, '0')}`,
        name: `Bp/Ibu Guru ${i + 1}`,
        role: "guru" as const,
        password: "guru123"
      }));
      localStorage.setItem("sdm23_teachers", JSON.stringify(currentTeachers));
    }
    setTeachers(currentTeachers);

    // 2. Load Today's Attendance
    const today = format(new Date(), "yyyy-MM-dd");
    const currentAtt: Record<string, Attendance> = {};
    
    currentTeachers.forEach(t => {
      const savedAtt = localStorage.getItem(`att_${t.id}_${today}`);
      if (savedAtt) {
        currentAtt[t.id] = JSON.parse(savedAtt);
      }
    });
    setAttendances(currentAtt);

    // 3. Load Leave Requests
    const leavesList: LeaveRequest[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("leaves_")) {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed: LeaveRequest[] = JSON.parse(item);
            if (Array.isArray(parsed)) {
              leavesList.push(...parsed);
            }
          }
        } catch {
          // ignore error
        }
      }
    }
    // sort by createdAt desc
    leavesList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setAllLeaves(leavesList);
  };

  const updateLeaveStatus = (leaveId: string, userId: string, newStatus: 'Disetujui' | 'Ditolak') => {
    const key = `leaves_${userId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const userLeaves: LeaveRequest[] = JSON.parse(raw);
        const updated = userLeaves.map(item => {
          if (item.id === leaveId) {
            return { ...item, status: newStatus };
          }
          return item;
        });
        localStorage.setItem(key, JSON.stringify(updated));
        
        // Also sync attendance if status is 'Disetujui' for leave dates
        if (newStatus === 'Disetujui') {
          const targetLeave = userLeaves.find(l => l.id === leaveId);
          if (targetLeave) {
            const today = format(new Date(), "yyyy-MM-dd");
            const attKey = `att_${userId}_${today}`;
            const existingAtt = localStorage.getItem(attKey);
            const userObj = teachers.find(t => t.id === userId);
            
            if (!existingAtt && userObj) {
              const newAtt: Attendance = {
                id: `${userId}_${today}`,
                userId: userId,
                userName: userObj.name,
                date: today,
                clockIn: format(new Date(), "HH:mm"),
                clockOut: null,
                status: targetLeave.type as any,
                notes: `Izin/Sakit Disetujui Admin: ${targetLeave.reason}`,
                updatedAt: new Date().toISOString()
              };
              localStorage.setItem(attKey, JSON.stringify(newAtt));
            }
          }
        }

        window.dispatchEvent(new Event("storage"));
        refreshData();
      } catch (err) {
        console.error("Error updating leave request status:", err);
      }
    }
  };

  useEffect(() => {
    refreshData();

    // Listen for storage changes from other tabs/frames to simulate real-time
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith("att_") || e.key === "sdm23_teachers") {
        refreshData();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Fallback polling for the same tab simulation (every 5 seconds)
    const interval = setInterval(refreshData, 5000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Calculate stats dynamically
  const stats = useMemo<DailySummary>(() => {
    const total = teachers.length;
    let hadir = 0, sakit = 0, izin = 0, dinas = 0;

    Object.values(attendances).forEach((att: Attendance) => {
      if (att.status === "Hadir") hadir++;
      else if (att.status === "Sakit") sakit++;
      else if (att.status === "Izin") izin++;
      else if (att.status === "Dinas Luar") dinas++;
    });

    const alfa = total - (hadir + sakit + izin + dinas);

    return { total, hadir, sakit, izin, dinas, alfa };
  }, [teachers, attendances]);

  const saveTeachers = (newTeachers: User[]) => {
    setTeachers(newTeachers);
    localStorage.setItem("sdm23_teachers", JSON.stringify(newTeachers));
  };

  const handleAddTeacher = (newTeacher: User) => {
    if (editingTeacher) {
      const updated = teachers.map(t => t.id === editingTeacher.id ? newTeacher : t);
      saveTeachers(updated);
    } else {
      if (teachers.some(t => t.id === newTeacher.id)) {
        alert("NIP sudah digunakan!");
        return;
      }
      saveTeachers([...teachers, newTeacher]);
    }
    setEditingTeacher(null);
  };

  const handleDeleteTeacher = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data guru ini?")) {
      const filtered = teachers.filter(t => t.id !== id);
      saveTeachers(filtered);
    }
  };

  const handleEditClick = (teacher: User) => {
    setEditingTeacher(teacher);
    setIsModalOpen(true);
  };

  const [roleFilter, setRoleFilter] = useState<string>("all");
  const currentYear = new Date().getFullYear();

  const filteredTeachers = useMemo(() => {
    return teachers.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.id.includes(searchTerm) ||
        (t.position && t.position.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesRole = roleFilter === "all" || (t.role || "guru") === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [teachers, searchTerm, roleFilter]);

  const chartData = [
    { name: "Hadir", value: stats.hadir, color: "#10b981" },
    { name: "Sakit", value: stats.sakit, color: "#f59e0b" },
    { name: "Izin", value: stats.izin, color: "#3b82f6" },
    { name: "Dinas", value: stats.dinas, color: "#a855f7" },
    { name: "Alfa", value: stats.alfa, color: "#ef4444" },
  ];

  const exportToExcel = () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    
    const data = teachers.map(t => {
      const att = attendances[t.id];
      return {
        "Tanggal": todayStr,
        "NIP": t.id,
        "Nama Guru": t.name,
        "Status": att ? att.status : "Alfa / Belum Absen",
        "Jam Masuk": att?.clockIn || "-",
        "Jam Pulang": att?.clockOut || "-",
        "Keterangan": att?.notes || ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan_Harian");
    
    // Auto-size columns (basic)
    const maxWidths = data.reduce((acc, row) => {
      Object.keys(row).forEach((key, i) => {
        const val = String(row[key as keyof typeof row]);
        acc[i] = Math.max(acc[i] || 0, val.length, key.length);
      });
      return acc;
    }, [] as number[]).map(w => ({ wch: w + 2 }));
    
    ws['!cols'] = maxWidths;

    XLSX.writeFile(wb, `Laporan_Absensi_SDM23_${todayStr}.xlsx`);
  };

  const lateTeachers = useMemo(() => {
    const threshold = setMinutes(setHours(new Date(), 8), 0);
    const isPastThreshold = isAfter(new Date(), threshold);
    
    if (!isPastThreshold) return [];

    return teachers.filter(t => !attendances[t.id]);
  }, [teachers, attendances]);

  const sendReminders = () => {
    if (lateTeachers.length === 0) return;
    
    const names = lateTeachers.slice(0, 3).map(t => t.name).join(", ");
    const more = lateTeachers.length > 3 ? ` dan ${lateTeachers.length - 3} lainnya` : "";
    
    alert(`📢 NOTIFIKASI TERKIRIM!\n\nSistem telah mengirimkan pesan pengingat ke WhatsApp/Aplikasi ${lateTeachers.length} guru yang belum absen:\n${names}${more}.\n\nWaktu Tagihan: ${format(new Date(), "HH:mm:ss")}`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Alert Pengingat (Jika lewat jam 8) */}
      {lateTeachers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-4">
            <div className="bg-amber-500 p-3 rounded-2xl shadow-lg shadow-amber-200">
              <BellRing className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900">Peringatan: {lateTeachers.length} Guru Belum Absen</h4>
              <p className="text-sm text-amber-700">Sudah melewati pukul 08:00 AM. Segera kirim pengingat kehadiran.</p>
            </div>
          </div>
          <button 
            onClick={sendReminders}
            className="whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 rounded-2xl shadow-md transition-all active:scale-95"
          >
            Kirim Notifikasi Blast
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Guru", value: stats.total, icon: Users, color: "bg-slate-100 text-slate-600" },
          { label: "Hadir", value: stats.hadir, icon: CheckCircle, color: "bg-emerald-100 text-emerald-600" },
          { label: "Sakit", value: stats.sakit, icon: Clock, color: "bg-amber-100 text-amber-600" },
          { label: "Izin", value: stats.izin, icon: FileDown, color: "bg-blue-100 text-blue-600" },
          { label: "Dinas", value: stats.dinas, icon: Calendar, color: "bg-purple-100 text-purple-600" },
          { label: "Alfa", value: stats.alfa, icon: UserX, color: "bg-red-100 text-red-600" },
        ].map((item, i) => (
          <div key={i} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-3", item.color)}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black text-slate-800">{item.value}</div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">Ringkasan Hari Ini</h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">HARI KERJA</span>
          </div>
          
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} 
                />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Persentase Kehadiran</span>
              <span className="font-bold text-emerald-600">{Math.round((stats.hadir / stats.total) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
               <div 
                 className="bg-emerald-500 h-full transition-all duration-1000" 
                 style={{ width: `${(stats.hadir / stats.total) * 100}%` }} 
               />
            </div>
          </div>
        </div>

        {/* List Management */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-800 text-base">Manajemen Akun & SK Pegawai</h3>
                <p className="text-xs text-slate-400">Guru, Pelatih Ekstrakurikuler, Tendik & Administrator</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cari Nama/NIP/Jabatan..."
                    className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-2xl text-xs focus:ring-2 focus:ring-blue-100 outline-none w-full sm:w-48 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <button 
                  onClick={exportToExcel}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all"
                  title="Ekspor Laporan Excel"
                >
                  <FileDown className="w-4 h-4" />
                  <span className="hidden sm:inline">Excel</span>
                </button>

                <button 
                  onClick={() => {
                    setEditingTeacher(null);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-2xl text-xs font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Akun</span>
                </button>
              </div>
            </div>

            {/* TAB FILTER ROLE / KATEGORI AKUN */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-t border-slate-100 pt-3">
              {[
                { id: "all", label: "Semua Akun", count: teachers.length, icon: Users },
                { id: "guru", label: "👨‍🏫 Guru / Pendidik", count: teachers.filter(t => (t.role || 'guru') === 'guru').length },
                { id: "pelatih_ekstra", label: "🏆 Pelatih Ekstra", count: teachers.filter(t => t.role === 'pelatih_ekstra').length },
                { id: "tendik", label: "💼 Tendik / Staff", count: teachers.filter(t => t.role === 'tendik').length },
                { id: "admin", label: "⚡ Admin SIMPeg", count: teachers.filter(t => t.role === 'admin').length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setRoleFilter(tab.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border text-xs",
                    roleFilter === tab.id
                      ? "bg-slate-900 text-white border-slate-900 shadow-md"
                      : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100"
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                    roleFilter === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-slate-400 font-bold border-b border-slate-50 bg-slate-50/50">
                  <th className="px-5 py-3.5">Pegawai & Jabatan</th>
                  <th className="px-5 py-3.5">NIP & Peran</th>
                  <th className="px-5 py-3.5">SK Penugasan ({currentYear})</th>
                  <th className="px-5 py-3.5">Presensi</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTeachers.map((t) => {
                  const skYear = t.skPenugasanYear || currentYear;
                  const isSkExpired = skYear < currentYear;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-xs",
                            t.role === 'guru' && "bg-blue-100 text-blue-700",
                            t.role === 'pelatih_ekstra' && "bg-emerald-100 text-emerald-700",
                            t.role === 'tendik' && "bg-amber-100 text-amber-700",
                            t.role === 'admin' && "bg-purple-100 text-purple-700",
                            !t.role && "bg-blue-100 text-blue-700"
                          )}>
                            {t.name.split(' ').slice(-1)[0][0]}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 leading-tight">{t.name}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{t.position || "Guru Kelas"}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <code className="text-xs font-mono text-slate-600 font-semibold">{t.id}</code>
                          <div className="text-[10px]">
                            <span className={cn(
                              "font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-[9px]",
                              t.role === "guru" && "bg-blue-50 text-blue-700 border border-blue-100",
                              t.role === "pelatih_ekstra" && "bg-emerald-50 text-emerald-700 border border-emerald-100",
                              t.role === "tendik" && "bg-amber-50 text-amber-700 border border-amber-100",
                              t.role === "admin" && "bg-purple-50 text-purple-700 border border-purple-100",
                              !t.role && "bg-blue-50 text-blue-700 border border-blue-100"
                            )}>
                              {t.role === "pelatih_ekstra" ? "Pelatih Ekstra" : t.role === "tendik" ? "Tendik" : t.role === "admin" ? "Admin" : "Guru"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border",
                            isSkExpired
                              ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}>
                            <ShieldCheck className="w-3 h-3 shrink-0" />
                            <span>{isSkExpired ? "⚠️ Perlu Perbaruan SK" : `✅ SK Aktif (${skYear})`}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
                            {t.skPenugasanNum || `SK.T-23/${skYear}`}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {attendances[t.id] ? (
                          <div className="flex flex-col gap-1">
                            <div className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-bold text-[10px] uppercase tracking-wide w-fit",
                              attendances[t.id].status === "Hadir" && "bg-emerald-50 text-emerald-700 border border-emerald-100",
                              attendances[t.id].status === "Sakit" && "bg-amber-50 text-amber-700 border border-amber-100",
                              attendances[t.id].status === "Izin" && "bg-blue-50 text-blue-700 border border-blue-100",
                              attendances[t.id].status === "Dinas Luar" && "bg-purple-50 text-purple-700 border border-purple-100",
                            )}>
                              {attendances[t.id].status === "Hadir" && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                              {attendances[t.id].status === "Sakit" && <Clock className="w-3 h-3 text-amber-500" />}
                              {attendances[t.id].status === "Izin" && <FileDown className="w-3 h-3 text-blue-500" />}
                              {attendances[t.id].status === "Dinas Luar" && <Calendar className="w-3 h-3 text-purple-500" />}
                              
                              {attendances[t.id].status}
                              {attendances[t.id].clockIn && (
                                <span className="opacity-60 font-medium lowercase ml-0.5">@ {attendances[t.id].clockIn}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-md font-bold text-[10px] uppercase tracking-wider">
                            <UserX className="w-3 h-3 text-red-500" />
                            Belum Absen
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                         <div className="flex items-center justify-end gap-1">
                           <button 
                             onClick={() => handleEditClick(t)}
                             className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold border border-slate-200"
                             title="Edit Akun & Perbarui SK"
                           >
                             <Edit2 className="w-3.5 h-3.5" />
                             <span className="hidden sm:inline">Kelola SK</span>
                           </button>
                           <button 
                             onClick={() => handleDeleteTeacher(t.id)}
                             className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                             title="Hapus Pegawai"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredTeachers.length === 0 && (
              <div className="py-20 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>Data pegawai tidak ditemukan.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel Persetujuan Izin / Sakit Guru */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Daftar Pengajuan Izin / Sakit Guru</h3>
              <p className="text-xs text-slate-500">Kelola dan beri persetujuan izin/sakit/dinas luar guru</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-xl border border-amber-100">
              {allLeaves.filter(l => l.status === "Menunggu").length} Menunggu Persetujuan
            </span>
          </div>
        </div>

        {allLeaves.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Belum ada pengajuan izin dari guru.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allLeaves.map((leave) => (
              <div 
                key={leave.id} 
                className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-800">{leave.userName}</span>
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      leave.status === "Menunggu" && "bg-amber-100 text-amber-700",
                      leave.status === "Disetujui" && "bg-emerald-100 text-emerald-700",
                      leave.status === "Ditolak" && "bg-red-100 text-red-700"
                    )}>
                      {leave.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p><span className="font-semibold text-slate-700">Jenis:</span> {leave.type}</p>
                    <p><span className="font-semibold text-slate-700">Tanggal:</span> {leave.startDate} s/d {leave.endDate}</p>
                    <p className="bg-white p-2 rounded-xl border border-slate-100 text-slate-600 italic mt-1">
                      "{leave.reason}"
                    </p>
                  </div>
                </div>

                {leave.status === "Menunggu" ? (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => updateLeaveStatus(leave.id, leave.userId, "Disetujui")}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all active:scale-95 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" /> Setujui
                    </button>
                    <button
                      onClick={() => updateLeaveStatus(leave.id, leave.userId, "Ditolak")}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all active:scale-95 shadow-sm"
                    >
                      <X className="w-3.5 h-3.5" /> Tolak
                    </button>
                  </div>
                ) : (
                  <div className="text-[10px] font-semibold text-slate-400 text-right pt-2 border-t border-slate-100">
                    Status: <span className="font-bold">{leave.status}</span> (Notifikasi terkirim ke Guru)
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google Drive Integration Panel */}
      <GoogleDriveManager currentUserId={user.id} />

      <TeacherModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTeacher(null);
        }}
        onSave={handleAddTeacher}
        teacherToEdit={editingTeacher}
      />
    </div>
  );
}
