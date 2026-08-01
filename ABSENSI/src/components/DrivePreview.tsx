import React, { useState, useEffect, useCallback } from "react";
import { initAuth, listDriveFiles, googleSignIn, DriveFile } from "../lib/googleDrive";
import { User as FirebaseUser } from "firebase/auth";
import { HardDrive, ExternalLink, RefreshCw, FileText, Folder, FileSpreadsheet, FileImage, ShieldCheck, ArrowRight, UploadCloud } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DrivePreviewProps {
  onOpenFullDriveTab?: () => void;
}

export default function DrivePreview({ onOpenFullDriveTab }: DrivePreviewProps) {
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [recentFiles, setRecentFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRecentFiles = useCallback(async (token: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const files = await listDriveFiles(token);
      setRecentFiles(files.slice(0, 5)); // Get top 5 recent files
    } catch (err: any) {
      console.error("Gagal memuat pratinjau Drive:", err);
      setErrorMsg(err.message || "Gagal menyinkronkan berkas Drive");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        fetchRecentFiles(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [fetchRecentFiles]);

  // Real-time polling every 30 seconds if authenticated
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => {
      fetchRecentFiles(accessToken);
    }, 30000);
    return () => clearInterval(interval);
  }, [accessToken, fetchRecentFiles]);

  const handleConnect = async () => {
    setIsLoggingIn(true);
    setErrorMsg(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);
        fetchRecentFiles(res.accessToken);
      }
    } catch (err: any) {
      setErrorMsg("Gagal terhubung dengan Google Drive.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("folder")) return <Folder className="w-4 h-4 text-amber-500 shrink-0" />;
    if (mimeType.includes("pdf")) return <FileText className="w-4 h-4 text-red-500 shrink-0" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (mimeType.includes("image")) return <FileImage className="w-4 h-4 text-blue-500 shrink-0" />;
    return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return "-";
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-extrabold text-slate-800 text-xs">Aktivitas Google Drive Real-time</h4>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Berkas & dokumen terbaru terhubung dengan akun Google</p>
          </div>
        </div>

        {accessToken && (
          <button
            onClick={() => fetchRecentFiles(accessToken)}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
            title="Segarkan Berkas Drive"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        )}
      </div>

      {/* Body */}
      {!accessToken ? (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-2.5 text-xs">
          <UploadCloud className="w-7 h-7 text-blue-500 mx-auto opacity-70" />
          <div>
            <p className="font-bold text-slate-700">Google Drive Belum Terhubung</p>
            <p className="text-[10px] text-slate-400">Sambungkan Google Drive untuk melihat daftar berkas terbaru secara real-time.</p>
          </div>
          <button
            onClick={handleConnect}
            disabled={isLoggingIn}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[11px] shadow-xs transition-all flex items-center justify-center gap-1.5 mx-auto active:scale-95"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isLoggingIn ? "Proses..." : "Hubungkan Google Drive"}</span>
          </button>
        </div>
      ) : isLoading ? (
        <div className="py-6 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
          <span>Sinkronisasi berkas Google Drive...</span>
        </div>
      ) : recentFiles.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs">
          <HardDrive className="w-8 h-8 mx-auto mb-1 opacity-20" />
          <p>Belum ada berkas terunggah di Drive.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recentFiles.map((file) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-100 transition-colors flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {getFileIcon(file.mimeType)}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800 text-[11px] truncate">{file.name}</div>
                  <div className="text-[9px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>{formatSize(file.size)}</span>
                    <span>•</span>
                    <span>{file.createdTime ? new Date(file.createdTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                  </div>
                </div>
              </div>

              {file.webViewLink && (
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all"
                  title="Buka di Google Drive"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Footer link to full tab */}
      {onOpenFullDriveTab && (
        <div className="pt-1 border-t border-slate-100 flex justify-end">
          <button
            onClick={onOpenFullDriveTab}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
          >
            <span>Buka Selengkapnya di Drive Storage</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
