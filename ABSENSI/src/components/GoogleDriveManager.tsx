import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  googleSignIn,
  googleLogout,
  getAccessToken,
  initAuth,
  listDriveFiles,
  uploadDriveFile,
  createDriveFolder,
  deleteDriveFile,
  backupDataToDrive,
  autoBackupTeachingMaterialsAndReports,
  DriveFile
} from "../lib/googleDrive";
import { User as FirebaseUser } from "firebase/auth";
import {
  HardDrive,
  Search,
  Upload,
  FolderPlus,
  Trash2,
  ExternalLink,
  RefreshCw,
  FileText,
  Folder,
  Database,
  Check,
  AlertTriangle,
  X,
  FileSpreadsheet,
  FileImage,
  ShieldCheck,
  LogOut,
  Plus
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GoogleDriveManagerProps {
  onSelectDriveFileForSK?: (fileUrl: string, fileName: string) => void;
  currentUserId?: string;
}

export default function GoogleDriveManager({ onSelectDriveFileForSK, currentUserId }: GoogleDriveManagerProps) {
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload & Folder state
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [showFolderModal, setShowFolderModal] = useState<boolean>(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);

  // Delete Confirmation Modal (Mandatory user confirmation for destructive operations)
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Backup state
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isAutoStructuring, setIsAutoStructuring] = useState<boolean>(false);

  const handleAutoStructureBackup = async () => {
    if (!accessToken) return;

    setIsAutoStructuring(true);
    setErrorMsg(null);
    try {
      const rawJournals = localStorage.getItem(`teaching_journals_${currentUserId || "1"}`);
      const rawLeaves = localStorage.getItem(`leaves_${currentUserId || "1"}`);

      const journalsData = rawJournals ? JSON.parse(rawJournals) : [];
      const leavesData = rawLeaves ? JSON.parse(rawLeaves) : [];

      const result = await autoBackupTeachingMaterialsAndReports(
        accessToken,
        currentUserId || "Guru",
        journalsData,
        leavesData
      );

      setSuccessMsg(
        `📁 Berhasil membuat struktur folder terorganisir (/SDM23_Surakarta_SIMPeg/):\n- Materi & Jurnal: ${result.materiBackup.name}\n- Laporan: ${result.laporanBackup.name}`
      );
      setTimeout(() => setSuccessMsg(null), 7000);
      loadDriveFiles(accessToken, searchQuery);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat cadangan terstruktur ke Drive");
    } finally {
      setIsAutoStructuring(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setIsLoadingAuth(false);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
        setIsLoadingAuth(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch Drive Files
  const loadDriveFiles = useCallback(async (token: string, query?: string) => {
    setIsLoadingFiles(true);
    setErrorMsg(null);
    try {
      const driveFiles = await listDriveFiles(token, query);
      setFiles(driveFiles);
    } catch (err: any) {
      console.error("Gagal memuat berkas Drive:", err);
      setErrorMsg(err.message || "Gagal memuat berkas dari Google Drive");
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      loadDriveFiles(accessToken, searchQuery);
    }
  }, [accessToken, searchQuery, loadDriveFiles]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        setSuccessMsg(`Berhasil terhubung dengan Google Drive (${result.user.email})`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.error("Login Drive error:", err);
      setErrorMsg("Gagal melakukan autentikasi Google. Pastikan mengizinkan akses Google Drive.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await googleLogout();
    setGoogleUser(null);
    setAccessToken(null);
    setFiles([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !accessToken) return;

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const uploaded = await uploadDriveFile(accessToken, fileList[0]);
      setSuccessMsg(`Berkas "${uploaded.name}" berhasil diunggah ke Google Drive!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadDriveFiles(accessToken, searchQuery);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengunggah berkas ke Google Drive");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !accessToken) return;

    setIsCreatingFolder(true);
    setErrorMsg(null);
    try {
      const folder = await createDriveFolder(accessToken, newFolderName.trim());
      setSuccessMsg(`Folder "${folder.name}" berhasil dibuat di Google Drive!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setShowFolderModal(false);
      setNewFolderName("");
      loadDriveFiles(accessToken, searchQuery);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat folder");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Mandatory Confirmation for Destructive Delete Operation
  const confirmDeleteFile = async () => {
    if (!fileToDelete || !accessToken) return;

    setIsDeleting(true);
    try {
      await deleteDriveFile(accessToken, fileToDelete.id);
      setSuccessMsg(`Berkas "${fileToDelete.name}" telah dihapus dari Google Drive.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setFileToDelete(null);
      loadDriveFiles(accessToken, searchQuery);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menghapus berkas");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBackupToDrive = async () => {
    if (!accessToken) return;

    setIsBackingUp(true);
    setErrorMsg(null);
    try {
      // Gather local storage data for backup
      const allKeys = Object.keys(localStorage);
      const backupPayload: Record<string, any> = {};
      allKeys.forEach((key) => {
        try {
          backupPayload[key] = JSON.parse(localStorage.getItem(key) || "");
        } catch {
          backupPayload[key] = localStorage.getItem(key);
        }
      });

      const backupFile = await backupDataToDrive(accessToken, `Backup_SIMPeg_SDM23`, {
        timestamp: new Date().toISOString(),
        backupBy: currentUserId || "Admin",
        data: backupPayload
      });

      setSuccessMsg(` Backup data sistem SIMPeg SDM 23 berhasil disimpan di Google Drive: ${backupFile.name}`);
      setTimeout(() => setSuccessMsg(null), 5000);
      loadDriveFiles(accessToken, searchQuery);
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal melakukan cadangan ke Drive");
    } finally {
      setIsBackingUp(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("folder")) return <Folder className="w-5 h-5 text-amber-500 shrink-0" />;
    if (mimeType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500 shrink-0" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />;
    if (mimeType.includes("image")) return <FileImage className="w-5 h-5 text-blue-500 shrink-0" />;
    return <FileText className="w-5 h-5 text-slate-400 shrink-0" />;
  };

  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return "-";
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoadingAuth) {
    return (
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs flex items-center justify-center gap-3">
        <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
        <span className="text-xs text-slate-500 font-semibold">Memeriksa status koneksi Google Drive...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 rounded-2xl border border-blue-400/30 text-blue-300">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base">Google Drive Cloud Storage</h3>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                SDM 23 Official
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Simpan, kelola, & cadangkan berkas SK, Jurnal, dan Dokumen Sekolah ke Google Cloud
            </p>
          </div>
        </div>

        {/* User / Connect Button */}
        <div>
          {googleUser ? (
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10">
              {googleUser.photoURL ? (
                <img src={googleUser.photoURL} alt={googleUser.displayName || ""} className="w-7 h-7 rounded-full border border-white/30" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  {googleUser.displayName?.[0] || "G"}
                </div>
              )}
              <div className="text-left">
                <div className="text-xs font-bold leading-tight">{googleUser.displayName || "Google User"}</div>
                <div className="text-[10px] text-blue-200 truncate max-w-[150px]">{googleUser.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 hover:bg-white/20 rounded-xl transition-colors text-slate-300 hover:text-white"
                title="Keluar dari Google Drive"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* OFFICIAL SIGN IN WITH GOOGLE BUTTON STYLING (MANDATORY per skill guidelines) */
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="group relative flex items-center justify-center gap-2 bg-white text-slate-700 hover:bg-slate-50 font-bold text-xs px-4 py-2.5 rounded-2xl transition-all shadow-md active:scale-95 border border-slate-200 disabled:opacity-50"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
              <span>{isLoggingIn ? "Menghubungkan..." : "Hubungkan Google Drive"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      {!accessToken ? (
        /* Not Logged In State */
        <div className="p-10 text-center space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto border border-blue-100 shadow-inner">
            <HardDrive className="w-8 h-8" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-base">Integrasi Google Drive SDM 23</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Sambungkan akun Google Anda untuk mengunggah dokumen SK, melampirkan berkas jurnal, dan mencadangkan database sistem ke Google Drive secara aman.
            </p>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-95"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isLoggingIn ? "Proses Autentikasi Google..." : "Masuk dengan Google Account"}</span>
          </button>
        </div>
      ) : (
        /* Connected State: Drive Explorer & Controls */
        <div className="p-6 space-y-5">
          {/* Notifications */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs font-bold flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button onClick={() => setErrorMsg(null)} className="text-red-600 hover:text-red-900 font-bold">
                  ✕
                </button>
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
                <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
                  ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama berkas di Google Drive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Actions: Refresh, New Folder, Upload File, Backup */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => loadDriveFiles(accessToken, searchQuery)}
                disabled={isLoadingFiles}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all"
                title="Segarkan Berkas"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? "animate-spin text-blue-600" : ""}`} />
              </button>

              <button
                onClick={() => setShowFolderModal(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-2xl transition-all active:scale-95"
              >
                <FolderPlus className="w-4 h-4 text-amber-600" />
                <span className="hidden sm:inline">Folder Baru</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-blue-100 active:scale-95 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>{isUploading ? "Mengunggah..." : "Unggah Berkas"}</span>
              </button>

              <button
                onClick={handleAutoStructureBackup}
                disabled={isAutoStructuring}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                title="Otomatis simpan materi mengajar & laporan ke folder terstruktur di Google Drive"
              >
                <FolderPlus className="w-4 h-4 text-blue-600" />
                <span className="hidden lg:inline">{isAutoStructuring ? "Memproses..." : "Auto-Save Folder Terstruktur"}</span>
              </button>

              <button
                onClick={handleBackupToDrive}
                disabled={isBackingUp}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                title="Cadangkan seluruh database SIMPeg ke Google Drive"
              >
                <Database className="w-4 h-4 text-emerald-600" />
                <span className="hidden md:inline">{isBackingUp ? "Mencadangkan..." : "Backup Data"}</span>
              </button>
            </div>
          </div>

          {/* Files List Table */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 p-3 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Daftar Berkas Google Drive ({files.length})</span>
              <span className="text-[10px] text-slate-400 font-normal">Terhubung dengan Cloud Storage</span>
            </div>

            {isLoadingFiles ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span>Mengambil daftar berkas dari Google Drive...</span>
              </div>
            ) : files.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <HardDrive className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>Tidak ada berkas ditemukan di Google Drive.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {getFileIcon(file.mimeType)}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800 truncate">{file.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>Ukuran: {formatSize(file.size)}</span>
                          <span>•</span>
                          <span>Dibuat: {file.createdTime ? new Date(file.createdTime).toLocaleDateString("id-ID") : "-"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onSelectDriveFileForSK && file.webViewLink && (
                        <button
                          onClick={() => onSelectDriveFileForSK(file.webViewLink!, file.name)}
                          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl font-bold text-[10px] transition-all"
                        >
                          Pilih untuk SK
                        </button>
                      )}

                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Buka di Google Drive"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      <button
                        onClick={() => setFileToDelete(file)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Hapus berkas dari Drive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE FOLDER MODAL */}
      <AnimatePresence>
        {showFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                  <FolderPlus className="w-4 h-4 text-amber-500" />
                  <span>Buat Folder Baru di Google Drive</span>
                </div>
                <button onClick={() => setShowFolderModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateFolder} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-600 mb-1 block">Nama Folder</label>
                  <input
                    type="text"
                    required
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Contoh: SK_Pegawai_2026 / Jurnal_Guru"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowFolderModal(false)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-2xl text-slate-600 font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingFolder}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-2xl transition-all active:scale-95"
                  >
                    {isCreatingFolder ? "Membuat..." : "Buat Folder"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MANDATORY DESTRUCTIVE CONFIRMATION MODAL */}
      <AnimatePresence>
        {fileToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 text-xs"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2.5 bg-red-100 rounded-2xl shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Konfirmasi Hapus Berkas Drive</h4>
                  <p className="text-[11px] text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Berkas yang akan dihapus:</span>
                <span className="font-bold text-slate-800 break-all">{fileToDelete.name}</span>
              </div>

              <p className="text-slate-600">
                Apakah Anda yakin ingin menghapus berkas ini dari akun Google Drive Anda?
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFileToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteFile}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? "Menghapus..." : "Ya, Hapus Permanen"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
