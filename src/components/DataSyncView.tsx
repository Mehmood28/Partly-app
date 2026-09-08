import React, { useMemo, useRef, useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { ConfirmModal } from './ConfirmModal';
import {
  extractAvailableYears,
  filterTransactionsByYear,
  generateFinancialCsv,
} from '../utils/financialCsv';
import { parseBackupJSON } from '../utils/storage';
import {
  FolderSync,
  FileJson,
  FileSpreadsheet,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Database,
  FileDown,
  Info,
  HardDriveUpload,
  ArrowRight,
} from 'lucide-react';

interface DataSyncViewProps {
  onResetData: () => void;
}

export const DataSyncView: React.FC<DataSyncViewProps> = React.memo(({
  onResetData,
}) => {
  const { state, importData, recordBackup, lastBackupTimestamp } = useInventory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const totalComponentsCount = state.components.length;
  const totalBuildsCount = state.builds.length;

  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const [isExportJsonConfirmOpen, setIsExportJsonConfirmOpen] = useState(false);
  const [isExportFinancialConfirmOpen, setIsExportFinancialConfirmOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    payload: Parameters<typeof importData>[0];
    counts: { components: number; builds: number; transactions: number };
  } | null>(null);

  const availableYears = useMemo(() => extractAvailableYears(state.transactions), [state.transactions]);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  const { yearTransactions, invalidDateCount } = useMemo(
    () => filterTransactionsByYear(state.transactions, selectedYear),
    [state.transactions, selectedYear]
  );

  const getBackupStatus = () => {
    if (!lastBackupTimestamp) return { status: 'Backup recommended (Never)', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
    
    const now = Date.now();
    const diffMs = now - lastBackupTimestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffDays >= 7) {
      return { status: `Backup recommended (${diffDays} days ago)`, color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
    }
    
    if (diffHours < 24) {
      return { status: diffHours === 0 ? 'Backed up: Just now' : `Backed up: ${diffHours}h ago`, color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    }
    
    return { status: `Backed up: ${diffDays} days ago`, color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
  };

  const backupPill = getBackupStatus();

  // JSON Export execution
  const executeExportJSON = () => {
    try {
      const dataStr = JSON.stringify(state, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
      link.href = url;
      link.download = `partly_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      recordBackup();
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  // JSON Import parser & validation
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        if (typeof content !== 'string') {
          throw new Error('Unable to read file content');
        }
        const parseResult = parseBackupJSON(content);
        if (!parseResult.success || !parseResult.payload || !parseResult.counts) {
          throw new Error(parseResult.error || 'Invalid backup file format');
        }

        setPendingImport({
          payload: parseResult.payload,
          counts: parseResult.counts,
        });
      } catch (err: unknown) {
        setImportStatus({
          type: 'error',
          message: `Failed to import JSON: ${err instanceof Error ? err.message : 'Invalid file format'}`,
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const executeConfirmImport = () => {
    if (!pendingImport) return;
    try {
      const result = importData(pendingImport.payload);
      if (!result.success) {
        setImportStatus({
          type: 'error',
          message: result.error || 'Failed to import JSON: Error restoring data',
        });
      } else if (!result.changed) {
        setImportStatus({
          type: 'success',
          message: 'This backup already matches the current data. No changes were made.',
        });
      } else {
        setImportStatus({
          type: 'success',
          message: `Successfully imported backup! Restored ${pendingImport.counts.components} components, ${pendingImport.counts.builds} PC builds, and ${pendingImport.counts.transactions} transactions.`,
        });
      }
    } catch (err: unknown) {
      setImportStatus({
        type: 'error',
        message: `Failed to import JSON: ${err instanceof Error ? err.message : 'Error restoring data'}`,
      });
    } finally {
      setPendingImport(null);
    }
  };

  // CSV Export helpers
  const downloadCSV = (filename: string, csvContent: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const executeExportFinancialCSV = () => {
    if (yearTransactions.length === 0) return;
    const csvContent = generateFinancialCsv(yearTransactions, state.builds);
    downloadCSV(`Partly_Financial_Activity_${selectedYear}.csv`, csvContent);
  };

  return (
    <div className="space-y-3 w-full">
      {/* Top Banner / Header Card */}
      <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-3.5 relative overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 flex items-center justify-center text-[#7C6CF2] shrink-0">
              <FolderSync className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-100 flex items-center gap-1.5">
                <span>Data Management &amp; Sync</span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Manage JSON backups, CSV exports, local state, and database maintenance
              </p>
            </div>
          </div>

          <div className="gap-2 bg-[#121722] text-zinc-300 border border-white/[0.08] shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium tracking-wider uppercase inline-flex items-center justify-center whitespace-nowrap">
            <Database className="w-3.5 h-3.5 text-[#7C6CF2]" />
            <span>Database: {totalComponentsCount} parts · {totalBuildsCount} builds</span>
          </div>
        </div>
      </div>

      {/* Status Feedback Message */}
      {importStatus.type && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            importStatus.type === 'success'
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-red-950/20 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {importStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{importStatus.message}</span>
          </div>
          <button
            onClick={() => setImportStatus({ type: null, message: '' })}
            className="text-zinc-400 hover:text-zinc-200 text-[11px] font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {/* JSON Backup & Restore */}
        <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-3.5 flex flex-col justify-between space-y-3 shadow-sm">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-white/[0.08] mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 flex items-center justify-center text-[#7C6CF2] shrink-0">
                  <FileJson className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100">JSON Backup &amp; Restore</h3>
              </div>
              <div className={`px-2 py-0.5 rounded-lg text-[10px] font-medium flex items-center shrink-0 ${backupPill.color}`}>
                {backupPill.status}
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Export a complete snapshot of your inventory, builds, and transactions to a JSON file, or restore from a previously saved backup.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => setIsExportJsonConfirmOpen(true)}
                className="p-3 rounded-xl bg-[#121722] hover:bg-white/[0.04] border border-white/[0.08] hover:border-[#7C6CF2]/40 transition-all text-left flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between mb-2">
                  <FileDown className="w-4 h-4 text-[#7C6CF2]" />
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-[#7C6CF2] transition-colors" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-100 group-hover:text-white">
                    Export Backup (.json)
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Save offline backup file
                  </div>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-xl bg-[#121722] hover:bg-white/[0.04] border border-white/[0.08] hover:border-[#7C6CF2]/40 transition-all text-left flex flex-col justify-between group"
              >
                <div className="flex items-center justify-between mb-2">
                  <HardDriveUpload className="w-4 h-4 text-[#7C6CF2]" />
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-[#7C6CF2] transition-colors" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-100 group-hover:text-white">
                    Import Backup (.json)
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Restore state from file
                  </div>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-2 border-t border-white/[0.06]">
            <Info className="w-3.5 h-3.5 text-[#7C6CF2] shrink-0" />
            <span>Importing a backup will replace current local database state.</span>
          </div>
        </div>
      </div>

      {/* CSV Reports Export */}
      <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-3.5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-white/[0.08] mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#7C6CF2]/15 border border-[#7C6CF2]/30 flex items-center justify-center text-[#7C6CF2] shrink-0">
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100">Annual Financial Activity</h3>
              <p className="text-[11px] text-zinc-400">
                Export recorded purchases, sales, trade-ins, exchanges, and profit activity for the selected calendar year.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <label htmlFor="financial-activity-year-select" className="text-xs text-zinc-400 font-medium">
              Year:
            </label>
            <select
              id="financial-activity-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-8 bg-[#121722] border border-white/[0.08] rounded-lg px-2.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-[#7C6CF2] focus:ring-1 focus:ring-[#7C6CF2]/40"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            disabled={yearTransactions.length === 0}
            onClick={() => {
              if (yearTransactions.length > 0) {
                setIsExportFinancialConfirmOpen(true);
              }
            }}
            className={`p-3 bg-[#121722] border border-white/[0.08] rounded-xl text-left flex items-center justify-between group transition-all ${
              yearTransactions.length === 0
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-white/[0.04] hover:border-[#7C6CF2]/40'
            }`}
          >
            <div>
              <div className="text-xs font-semibold text-zinc-100 group-hover:text-white">
                Generate Financial Report (.csv)
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                Exports recorded purchases, sales, trade-ins, exchanges, and profit activity for {selectedYear}.
              </div>
              {yearTransactions.length === 0 && (
                <div className="text-[11px] text-amber-400/90 mt-1 font-medium">
                  No transactions found for {selectedYear}.
                </div>
              )}
            </div>
            <FileDown className="w-4 h-4 text-[#7C6CF2] group-hover:scale-110 transition-transform shrink-0 ml-2" />
          </button>
        </div>
      </div>

      {/* Reset & Maintenance */}
      <div className="bg-[#0D1118] border border-white/[0.08] rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2 pb-2.5 border-b border-white/[0.08] mb-2.5">
          <div className="w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <RotateCcw className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100">Database Reset &amp; Maintenance</h3>
            <p className="text-[11px] text-zinc-400">
              Clear local cached state to start fresh or troubleshoot
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#121722] border border-white/[0.08] rounded-xl p-3">
          <div>
            <div className="text-xs font-semibold text-zinc-200">Reset All Database Data</div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Permanently clear all inventory components, active PC builds, activity logs, and cached statistics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onResetData}
              className="bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-100 border border-red-500/30 transition-all flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset &amp; Clear Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Export JSON Confirm Modal */}
      <ConfirmModal
        isOpen={isExportJsonConfirmOpen}
        title="Export JSON Backup?"
        message={`Save an offline backup containing ${totalComponentsCount} components, ${totalBuildsCount} builds, and ${state.transactions.length} transaction records?`}
        confirmText="Export Backup"
        variant="violet"
        onConfirm={() => {
          setIsExportJsonConfirmOpen(false);
          executeExportJSON();
        }}
        onCancel={() => setIsExportJsonConfirmOpen(false)}
      />

      {/* Export Financial Activity CSV Confirm Modal */}
      <ConfirmModal
        isOpen={isExportFinancialConfirmOpen}
        title="Generate Financial Report?"
        message={`Generate and download the financial activity report for ${selectedYear} containing ${yearTransactions.length} transaction record${
          yearTransactions.length === 1 ? '' : 's'
        }.${
          invalidDateCount > 0
            ? ` (${invalidDateCount} record${invalidDateCount === 1 ? '' : 's'} excluded due to invalid or missing date)`
            : ''
        }`}
        confirmText="Generate Report"
        variant="violet"
        onConfirm={() => {
          setIsExportFinancialConfirmOpen(false);
          executeExportFinancialCSV();
        }}
        onCancel={() => setIsExportFinancialConfirmOpen(false)}
      />

      {/* Import Backup Confirm Modal */}
      <ConfirmModal
        isOpen={!!pendingImport}
        title="Import Backup File?"
        message={
          pendingImport
            ? `Import backup containing ${pendingImport.counts.components} components, ${pendingImport.counts.builds} PC builds, and ${pendingImport.counts.transactions} transactions? This will overwrite your current local database.`
            : ''
        }
        confirmText="Import & Replace"
        variant="danger"
        onConfirm={executeConfirmImport}
        onCancel={() => setPendingImport(null)}
      />
    </div>
  );
});
