// FILE: src/components/savedModelsPanel.tsx
//
// Marginalia — saved models panel
//
// Sits inside "for the nerds", because saving a set of judgements only means
// something once someone has made some. Deliberately plain: a name, a save
// button, and a list you can reopen or delete.
//
// THE ONE RULE THIS SCREEN KEEPS (`KI-27`)
//
// It never prints a figure the entry cannot reproduce. Every row is REOPENED as
// it is listed — the same restore path the Open button uses — and what the row
// shows is what that reopen produced. Where the stored figure and the reopened
// one agree, one number is shown. Where they differ, both are shown with the
// reason: either the entry predates the fix and never stored its judgements, or
// the filings behind it have changed since.
//
// The list used to print the stored figure and nothing else, which is how an
// entry saved at 1,044.32 sat in a list claiming 1,044.32 while the Open button
// produced 706.52.

import React, { useEffect, useMemo, useState } from 'react';
import { Save, Trash2, Upload, Download, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  SavedModel,
  SavedJudgements,
  SavedProduced,
  listSaved,
  saveModel,
  deleteSaved,
  exportSaved,
  importSaved,
  isComplete,
} from '../data/savedModels';
import { reopensAt } from '../data/restoreModel';
import type { CompanyData } from '../types';

interface Props {
  ticker: string;
  companyName: string;
  currencySymbol: string;
  /** Every input that decides this valuation, assembled by the dashboard. */
  judgements: SavedJudgements;
  /** What the model produces under them, as the screen computes it. */
  produced: SavedProduced;
  /** How many sliders are off the model's own figures, for the line under the field. */
  slidersChanged: number;
  /** The untouched payload, so a row can be reopened to see what it produces. */
  fetched: any | null;
  /** For a curated company, which has no payload to correct. */
  fallbackRecord: CompanyData | null;
  onRestore: (entry: SavedModel) => void;
}

export const SavedModelsPanel: React.FC<Props> = ({
  ticker,
  companyName,
  currencySymbol,
  judgements,
  produced,
  slidersChanged,
  fetched,
  fallbackRecord,
  onRestore,
}) => {
  const [saved, setSaved] = useState<SavedModel[]>([]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => setSaved(listSaved(ticker));
  useEffect(refresh, [ticker]);

  // EVERY ROW IS REOPENED AS IT IS LISTED. A handful of entries per company, so
  // the engine runs a handful of times; the alternative is a list that makes a
  // claim it has not checked.
  const rows = useMemo(
    () =>
      saved.map((entry) => ({
        entry,
        now: reopensAt(fetched, entry.judgements, fallbackRecord),
      })),
    [saved, fetched, fallbackRecord]
  );

  const judgementCount = useMemo(() => {
    const j = judgements;
    const corrections = Object.values(j.corrections || {}).reduce(
      (n: number, patch) => n + Object.keys(patch || {}).length,
      0
    );
    return {
      corrections,
      classified: Object.keys(j.classification || {}).length,
      verdicts: Object.keys(j.appliedVerdicts || {}).length,
      peers: j.peers ? j.peers.length : 0,
    };
  }, [judgements]);

  const handleSave = () => {
    const entry = saveModel({
      ticker,
      companyName,
      name: name.trim() || `${ticker} — ${new Date().toLocaleDateString()}`,
      currencySymbol,
      judgements,
      produced,
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
    setMessage(
      result.error ??
        `${result.added} saved model${result.added === 1 ? '' : 's'} added` +
          (result.older
            ? `, of which ${result.older} ${result.older === 1 ? 'was' : 'were'} saved before judgements were stored and will say so.`
            : '.')
    );
    refresh();
  };

  const money = (v: number | null | undefined) =>
    typeof v === 'number' && isFinite(v)
      ? `${currencySymbol}${v.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : '—';

  /** Agreement to the nearest cent is agreement; anything else is shown. */
  const agrees = (a: number | null, b: number | null | undefined) =>
    typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b)
      ? Math.abs(a - b) < 0.005
      : a == null && b == null;

  return (
    <div className="max-w-4xl">
      <h3 className="font-serif text-xl text-[#F2F0EA] mb-2">Saved models</h3>
      <p className="text-[14px] leading-relaxed text-[#A1A1AA] mb-6 max-w-2xl">
        Save a set of judgements and come back to it. A saved model carries everything that decides
        the valuation — the sliders, your corrections to the filed figures and the reasons you gave,
        your expense classification, your answers on the qualitative screen, your peer set, the
        recovery rates, and the share price the valuation was struck against — so it reopens at the
        figure it was saved at. Saved models live in this browser on this device, so clearing your
        browsing data removes them. Use export to keep a copy or to move them to another machine.
      </p>

      <div className="border border-[#222228] bg-[#0B0B0D] p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this set of judgements"
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
        {/* WHAT WOULD BE SAVED, counted out, so nobody has to guess whether a
            judgement they made is going into the record. */}
        <div className="font-mono text-[13px] text-[#8A8A8F] mt-3 leading-relaxed">
          {[
            slidersChanged
              ? `${slidersChanged} assumption${slidersChanged === 1 ? '' : 's'} changed`
              : 'no assumptions changed',
            judgementCount.corrections
              ? `${judgementCount.corrections} figure${judgementCount.corrections === 1 ? '' : 's'} corrected`
              : '',
            judgementCount.classified
              ? `${judgementCount.classified} cost line${judgementCount.classified === 1 ? '' : 's'} classified`
              : '',
            judgementCount.verdicts ? `${judgementCount.verdicts} qualitative answers applied` : '',
            judgementCount.peers ? `${judgementCount.peers} peers chosen` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
          {`. Value ${money(produced.perpetuity)} a share`}
          {typeof judgements.sharePrice === 'number'
            ? `, struck against a price of ${money(judgements.sharePrice)}.`
            : ', with no price available to strike it against.'}
        </div>
      </div>

      {message && <p className="font-mono text-[13px] text-[#8B1E1E] mb-4">{message}</p>}

      {rows.length === 0 ? (
        <p className="text-[14px] text-[#8A8A8F] mb-6">Nothing saved for {companyName} yet.</p>
      ) : (
        <div className="border border-[#222228] divide-y divide-[#222228] mb-6">
          {rows.map(({ entry, now }) => {
            const complete = isComplete(entry);
            const matches = agrees(now.perpetuity, entry.produced.perpetuity);
            return (
              <div key={entry.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] text-[#F2F0EA] truncate">{entry.name}</div>
                    <div className="font-mono text-[13px] text-[#8A8A8F]">
                      {/* ONE FIGURE WHERE THEY AGREE, BOTH WHERE THEY DO NOT. */}
                      {now.error ? (
                        <span className="text-[#D05E58]">reopens with no value</span>
                      ) : matches ? (
                        money(now.perpetuity)
                      ) : (
                        <>
                          <span className="text-[#D05E58]">
                            saved at {money(entry.produced.perpetuity)} · reopens at {money(now.perpetuity)}
                          </span>
                        </>
                      )}{' '}
                      · {entry.judgements.viewMode.toLowerCase()} model ·{' '}
                      {new Date(entry.savedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRestore(entry)}
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

                {/* WHAT THIS ENTRY DID NOT STORE, NAMED. Never guessed at and
                    never filled with nil: an absent judgement is an absence. */}
                {!complete && (
                  <div className="mt-2.5 flex gap-2.5 text-[13px] leading-[1.55] text-[#A1A1AA]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#D05E58]" />
                    <div>
                      <span className="text-[#F2F0EA]">
                        Saved before judgements were stored, so it kept only its sliders and its view
                        mode.
                      </span>{' '}
                      It did not store {entry.missing.join('; ')}. Opening it puts the sliders back and
                      leaves every other judgement at the engine&rsquo;s own, which is why the two
                      figures above differ. Nothing has been guessed at on its behalf.
                    </div>
                  </div>
                )}
                {complete && !matches && !now.error && (
                  <div className="mt-2.5 flex gap-2.5 text-[13px] leading-[1.55] text-[#A1A1AA]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#D05E58]" />
                    <div>
                      This entry carries every judgement, so the difference is in the filings behind it:
                      they have been fetched again since it was saved. The figure on the right is what
                      the model produces now.
                    </div>
                  </div>
                )}
                {now.error && (
                  <div className="mt-2.5 text-[13px] leading-[1.55] text-[#A1A1AA]">{now.error}</div>
                )}
              </div>
            );
          })}
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
        Export writes every saved model across all companies to one file. Importing adds to what is
        already here rather than replacing it, so a mis-click cannot wipe your work. The file carries
        its own version number, and the same shape is what an account would store, so nothing here is
        tied to this browser beyond where the bytes happen to sit.
      </p>
    </div>
  );
};

export default SavedModelsPanel;
