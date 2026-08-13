// FILE: src/components/savedModelsPanel.tsx
//
// Marginalia — saved models panel
//
// Sits inside "for the nerds", because saving a set of assumptions only means
// something once someone has changed some. Deliberately plain: a name, a save
// button, and a list you can reopen or delete.

import React, { useEffect, useMemo, useState } from 'react';
import { Save, Trash2, Upload, Download, RotateCcw } from 'lucide-react';
import {
  SavedModel,
  listSaved,
  saveModel,
  deleteSaved,
  exportSaved,
  importSaved,
} from '../data/savedModels';
import { ValuationDrivers } from '../types';

interface Props {
  ticker: string;
  companyName: string;
  currencySymbol: string;
  viewMode: 'DERIVED' | 'ANALYST';
  drivers: ValuationDrivers;
  defaults: ValuationDrivers;
  valuePerShare: number | null;
  onRestore: (drivers: ValuationDrivers, viewMode: 'DERIVED' | 'ANALYST') => void;
}

export const SavedModelsPanel: React.FC<Props> = ({
  ticker,
  companyName,
  currencySymbol,
  viewMode,
  drivers,
  defaults,
  valuePerShare,
  onRestore,
}) => {
  const [saved, setSaved] = useState<SavedModel[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => setSaved(listSaved(ticker));
  useEffect(refresh, [ticker]);

  const changedCount = useMemo(
    () =>
      (Object.keys(defaults) as (keyof ValuationDrivers)[]).filter(
        (key) =>
          defaults[key] !== undefined &&
          drivers[key] !== undefined &&
          Number(drivers[key]) !== Number(defaults[key])
      ).length,
    [drivers, defaults]
  );

  const handleSave = () => {
    const entry = saveModel({
      ticker,
      companyName,
      name: name.trim() || `${ticker} — ${new Date().toLocaleDateString()}`,
      viewMode,
      drivers: { ...(drivers as any) },
      valuePerShare,
      currencySymbol,
    });
    if (!entry) {
      setMessage('This browser would not let the model be saved. Private browsing often blocks it.');
      return;
    }
    setName('');
    setMessage(null);
    refresh();
  };

  const handleImport = async (file?: File | null) => {
    if (!file) return;
    const result = await importSaved(file);
    setMessage(result.error ?? `${result.added} saved model${result.added === 1 ? '' : 's'} added.`);
    refresh();
  };

  const money = (v: number | null) =>
    typeof v === 'number' && isFinite(v)
      ? `${currencySymbol}${v.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : '—';

  return (
    <div className="max-w-4xl">
      <h3 className="font-serif text-xl text-[#F2F0EA] mb-2">Saved models</h3>
      <p className="text-[14px] leading-relaxed text-[#A1A1AA] mb-6 max-w-2xl">
        Save a set of assumptions and come back to it. Saved models live in this
        browser on this device, so clearing your browsing data removes them. Use
        export to keep a copy or to move them to another machine.
      </p>

      <div className="border border-[#222228] bg-[#0B0B0D] p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this set of assumptions"
            className="flex-1 min-w-[220px] bg-[#111114] border border-[#222228] px-3 py-2 text-[14px] text-[#F2F0EA] placeholder:text-[#8A8A8F] focus:outline-none focus:border-[#8B1E1E]"
          />
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 font-mono text-[13px] uppercase tracking-widest px-4 py-2 border border-[#8B1E1E] text-[#F2F0EA] bg-[#8B1E1E]/20 hover:bg-[#8B1E1E]/35 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
        <div className="font-mono text-[13px] text-[#8A8A8F] mt-3">
          {changedCount === 0
            ? 'Nothing has been changed yet, so this would save the model as it stands.'
            : `${changedCount} assumption${changedCount === 1 ? '' : 's'} changed from the model's own figures.`}
          {` Current value ${money(valuePerShare)}.`}
        </div>
      </div>

      {message && (
        <p className="font-mono text-[13px] text-[#8B1E1E] mb-4">{message}</p>
      )}

      {saved.length === 0 ? (
        <p className="text-[14px] text-[#8A8A8F] mb-6">
          Nothing saved for {companyName} yet.
        </p>
      ) : (
        <div className="border border-[#222228] divide-y divide-[#222228] mb-6">
          {saved.map((entry) => (
            <div
              key={entry.id}
              className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-[14px] text-[#F2F0EA] truncate">{entry.name}</div>
                <div className="font-mono text-[13px] text-[#8A8A8F]">
                  {money(entry.valuePerShare)} · {entry.viewMode.toLowerCase()} model ·{' '}
                  {new Date(entry.savedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onRestore(entry.drivers as any, entry.viewMode)}
                  className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-widest px-3 py-1.5 border border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] hover:border-[#8B1E1E] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteSaved(entry.id);
                    refresh();
                  }}
                  className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-widest px-3 py-1.5 border border-[#222228] text-[#8A8A8F] hover:text-[#8B1E1E] hover:border-[#8B1E1E] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportSaved}
          className="inline-flex items-center gap-2 font-mono text-[13px] uppercase tracking-widest px-4 py-2 border border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] transition-colors"
        >
          <Download className="w-4 h-4" />
          Export all saved models
        </button>
        <label className="inline-flex items-center gap-2 font-mono text-[13px] uppercase tracking-widest px-4 py-2 border border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] transition-colors cursor-pointer">
          <Upload className="w-4 h-4" />
          Import
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => handleImport(e.target.files?.[0])}
          />
        </label>
      </div>

      <p className="text-[13px] leading-relaxed text-[#8A8A8F] mt-5 max-w-2xl">
        Export writes every saved model across all companies to one file.
        Importing adds to what is already here rather than replacing it, so a
        mis-click cannot wipe your work.
      </p>
    </div>
  );
};

export default SavedModelsPanel;