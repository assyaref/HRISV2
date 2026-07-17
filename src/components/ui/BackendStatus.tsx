import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Server } from 'lucide-react';
import { checkGASHealth, setBackendMode } from '../../services/api';
import { getItem, setItem } from '../../lib/storage';
import { cn } from '../../lib/utils';

const FALLBACK_KEY = 'use_gas_backend';

export function BackendStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [useGas, setUseGasState] = useState(() => {
    const stored = getItem<boolean | null>(FALLBACK_KEY, null);
    return stored !== null ? stored : true;
  });
  const [expanded, setExpanded] = useState(false);

  const checkHealth = async () => {
    setStatus('checking');
    try {
      const res = await checkGASHealth();
      setStatus(res.success ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const toggleMode = () => {
    const newMode = !useGas;
    setUseGasState(newMode);
    setBackendMode(newMode);
    if (newMode) {
      checkHealth();
    } else {
      setStatus('offline');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
          status === 'checking' && 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
          status === 'online' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
          status === 'offline' && 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        )}
        title="Status Koneksi Backend"
      >
        {status === 'checking' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
        {status === 'online' && <Wifi className="h-3.5 w-3.5" />}
        {status === 'offline' && <WifiOff className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">
          {status === 'checking' && 'Memeriksa...'}
          {status === 'online' && 'GAS Online'}
          {status === 'offline' && (useGas ? 'GAS Offline' : 'Mode Lokal')}
        </span>
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-scale-in">
          <div className="flex items-center gap-3 mb-3">
            <Server className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">Backend Status</p>
              <p className="text-xs text-slate-400">
                {status === 'online' 
                  ? 'Terhubung ke Google Apps Script' 
                  : 'Menggunakan penyimpanan lokal'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 mb-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                'h-2 w-2 rounded-full',
                status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
              )} />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {status === 'online' ? 'Tersambung' : 'Tidak tersambung'}
              </span>
            </div>
            <button
              onClick={checkHealth}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Cek Ulang
            </button>
          </div>

          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Gunakan Backend GAS</p>
                <p className="text-xs text-slate-400">Data akan disimpan di Google Spreadsheet</p>
              </div>
              <button
                onClick={toggleMode}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors',
                  useGas ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                )}
              >
                <span className={cn(
                  'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  useGas && 'translate-x-5'
                )} />
              </button>
            </label>
          </div>

          {!useGas && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Mode lokal menggunakan localStorage. Data hanya tersimpan di browser ini.
                Aktifkan backend GAS untuk menyimpan data secara permanen.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}