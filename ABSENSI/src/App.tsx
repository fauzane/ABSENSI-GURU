import { useState, useEffect } from "react";
import { User } from "./types";
import Login from "./components/Login";
import GuruDashboard from "./components/GuruDashboard";
import AdminDashboard from "./components/AdminDashboard";
import { LogOut, School } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved session
    const savedUser = localStorage.getItem("sdm23_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (userData: User) => {
    localStorage.setItem("sdm23_user", JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("sdm23_user");
    setUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center">
          <School className="w-12 h-12 text-blue-600 mb-4" />
          <p className="text-gray-500">Memuat sistem...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-slate-900">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Login onLogin={handleLogin} />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col min-h-screen"
          >
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
              <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-600 p-1.5 rounded-lg">
                    <School className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">SDM 23</h1>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Semanggi Surakarta</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-sm font-semibold">{user.name}</span>
                    <span className="text-[10px] uppercase text-slate-500 bg-slate-100 px-1.5 rounded font-bold">
                      {user.role}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Keluar"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
              {user.role === "admin" ? (
                <AdminDashboard user={user} />
              ) : (
                <GuruDashboard user={user} />
              )}
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-slate-400 text-xs border-t bg-white">
              <p>© 2026 SD Muhammadiyah 23 Semanggi. Semua hak dilindungi.</p>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
