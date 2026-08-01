import React, { useState, useEffect } from "react";
import { User, UserRole } from "../types";
import { X, Save, User as UserIcon, Hash, Lock, Briefcase, FileCheck, Calendar, ShieldCheck, Upload } from "lucide-react";

interface TeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (teacher: User) => void;
  teacherToEdit?: User | null;
}

export default function TeacherModal({ isOpen, onClose, onSave, teacherToEdit }: TeacherModalProps) {
  const currentYear = new Date().getFullYear(); // 2026

  const [formData, setFormData] = useState<User>({
    id: "",
    name: "",
    role: "guru",
    password: "",
    position: "Guru Kelas",
    skPengangkatanNum: `SK.P-23/${currentYear}`,
    skPengangkatanYear: currentYear - 2,
    skPenugasanNum: `SK.T-23/${currentYear}`,
    skPenugasanYear: currentYear,
    skFileName: "SK_Penugasan_Terbaru.pdf"
  });

  useEffect(() => {
    if (teacherToEdit) {
      setFormData({
        ...teacherToEdit,
        position: teacherToEdit.position || getDefaultPosition(teacherToEdit.role),
        skPengangkatanNum: teacherToEdit.skPengangkatanNum || `SK.P-23/SDM23/${currentYear - 2}`,
        skPengangkatanYear: teacherToEdit.skPengangkatanYear || (currentYear - 2),
        skPenugasanNum: teacherToEdit.skPenugasanNum || `SK.T-23/SDM23/${currentYear}`,
        skPenugasanYear: teacherToEdit.skPenugasanYear || currentYear,
        skFileName: teacherToEdit.skFileName || "SK_Penugasan_SDM23.pdf"
      });
    } else {
      setFormData({
        id: "",
        name: "",
        role: "guru",
        password: "",
        position: "Guru Kelas / Mata Pelajaran",
        skPengangkatanNum: `SK.P-23/SDM23/${currentYear - 2}`,
        skPengangkatanYear: currentYear - 2,
        skPenugasanNum: `SK.T-23/SDM23/${currentYear}`,
        skPenugasanYear: currentYear,
        skFileName: "SK_Penugasan_Tahunan_2026.pdf"
      });
    }
  }, [teacherToEdit, isOpen, currentYear]);

  function getDefaultPosition(role: UserRole): string {
    switch (role) {
      case "guru": return "Guru Kelas / Mata Pelajaran";
      case "pelatih_ekstra": return "Pelatih Ekstrakurikuler";
      case "tendik": return "Tenaga Kependidikan / Staff TU";
      case "admin": return "Administrator SIMPeg SDM 23";
      default: return "Pegawai SDM 23";
    }
  }

  const handleRoleChange = (newRole: UserRole) => {
    setFormData(prev => ({
      ...prev,
      role: newRole,
      position: getDefaultPosition(newRole)
    }));
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const isSkExpired = (formData.skPenugasanYear || 0) < currentYear;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/20 rounded-2xl border border-blue-400/30 text-blue-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {teacherToEdit ? "Edit Akun & SK Pegawai" : "Tambah Akun Pegawai Baru"}
              </h3>
              <p className="text-xs text-blue-200">
                SD Muhammadiyah 23 Semanggi Surakarta
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* PERAN / KATEGORI AKUN */}
          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-blue-600" />
              Kategori / Peran Akun Pegawai
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleRoleChange("guru")}
                className={`p-2.5 rounded-2xl font-bold border text-left transition-all ${
                  formData.role === "guru" 
                    ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" 
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                👨‍🏫 Guru / Tenaga Pendidik
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange("pelatih_ekstra")}
                className={`p-2.5 rounded-2xl font-bold border text-left transition-all ${
                  formData.role === "pelatih_ekstra" 
                    ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm" 
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                🏆 Pelatih Ekstrakurikuler
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange("tendik")}
                className={`p-2.5 rounded-2xl font-bold border text-left transition-all ${
                  formData.role === "tendik" 
                    ? "bg-amber-50 border-amber-500 text-amber-700 shadow-sm" 
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                💼 Tendik (Staff TU / Perpustakaan)
              </button>

              <button
                type="button"
                onClick={() => handleRoleChange("admin")}
                className={`p-2.5 rounded-2xl font-bold border text-left transition-all ${
                  formData.role === "admin" 
                    ? "bg-purple-50 border-purple-500 text-purple-700 shadow-sm" 
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                ⚡ Administrator SIMPeg
              </button>
            </div>
          </div>

          {/* NIP & NAMA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-slate-600">NIP / ID Pegawai</label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  disabled={!!teacherToEdit}
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono disabled:opacity-50"
                  placeholder="Contoh: 19850101..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-slate-600">Nama Lengkap & Gelar</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                  placeholder="Ahmad Fathoni, S.Pd."
                />
              </div>
            </div>
          </div>

          {/* JABATAN & PASSWORD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-slate-600">Jabatan / Penugasan</label>
              <div className="relative">
                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.position || ""}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contoh: Guru Kelas 4B / Tapak Suci"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-slate-600">Kata Sandi Akun</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={formData.password || ""}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* SECTION SK PENGANGKATAN & PENUGASAN TAHUNAN */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">
                  Kelola SK Pengangkatan & SK Penugasan Tahunan
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                isSkExpired ? "bg-red-100 text-red-700 border border-red-200 animate-pulse" : "bg-emerald-100 text-emerald-700 border border-emerald-200"
              }`}>
                {isSkExpired ? "⚠️ SK Perlu Diperbarui" : `✅ SK Aktif (${formData.skPenugasanYear})`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">Nomor SK Pengangkatan</label>
                <input
                  type="text"
                  value={formData.skPengangkatanNum || ""}
                  onChange={(e) => setFormData({ ...formData, skPengangkatanNum: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
                  placeholder="SK.P-23/SDM23/2024"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">Tahun Pengangkatan</label>
                <input
                  type="number"
                  value={formData.skPengangkatanYear || currentYear}
                  onChange={(e) => setFormData({ ...formData, skPengangkatanYear: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  Nomor SK Penugasan Tahunan
                </label>
                <input
                  type="text"
                  value={formData.skPenugasanNum || ""}
                  onChange={(e) => setFormData({ ...formData, skPenugasanNum: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
                  placeholder={`SK.T-23/SDM23/${currentYear}`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600">Tahun Penugasan SK (Wajib {currentYear})</label>
                <input
                  type="number"
                  value={formData.skPenugasanYear || currentYear}
                  onChange={(e) => setFormData({ ...formData, skPenugasanYear: parseInt(e.target.value, 10) })}
                  className={`w-full px-3 py-2 bg-white border rounded-xl focus:outline-none focus:ring-2 font-mono text-[11px] ${
                    isSkExpired ? "border-red-300 ring-1 ring-red-300 text-red-700" : "border-slate-200 focus:ring-blue-500"
                  }`}
                />
              </div>
            </div>

            {/* Lampiran SK Digital */}
            <div className="space-y-1 pt-1">
              <label className="text-[10px] font-bold text-slate-500 flex items-center justify-between">
                <span>Dokumen SK Digital Terlampir (PDF)</span>
                <span className="text-blue-600 hover:underline cursor-pointer">Unggah File SK</span>
              </label>
              <div className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200">
                <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={formData.skFileName || ""}
                  onChange={(e) => setFormData({ ...formData, skFileName: e.target.value })}
                  className="w-full text-[11px] font-mono text-slate-700 focus:outline-none"
                  placeholder="SK_Penugasan_Tahunan.pdf"
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 text-xs active:scale-95"
            >
              <Save className="w-4 h-4" />
              Simpan Data Akun & SK
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

