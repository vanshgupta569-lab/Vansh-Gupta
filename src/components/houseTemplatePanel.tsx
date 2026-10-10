// FILE: src/components/houseTemplatePanel.tsx
//
// THE UPLOAD, WHICH IS THE MOMENT THAT DECIDES WHETHER THIS IS USABLE.
//
// A firm chooses its file and sees, immediately, what we think each of its
// lines is — not a blank grid to fill in. The work the firm does is CORRECTING
// a proposal, which is minutes, rather than BUILDING one, which is an
// afternoon nobody will give us.
//
// So the screen is ordered by what needs attention: anything uncertain first,
// then anything two of their cells both claim, then the lines of ours their
// template has no place for, then the confident matches folded away. A firm
// that agrees with everything presses one button.
import React, { useCallback, useRef, useState } from 'react';
import { Upload, Check, AlertTriangle, Trash2, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { Disclose, EYEBROW, LABEL, UI, Pill } from './instrument';
import {
  detectMapping,
  cellAddress,
  fingerprintOf,
  reconcile,
  applyReconciliation,
  REVIEW_BELOW,
  CANNOT_FILL,
  type Detection,
  type MappedLine,
  type TemplateMapping,
} from '../data/houseTemplate';
import {
  saveTemplate,
  listTemplates,
  forgetTemplate,
  loadTemplate,
  STORAGE_STATEMENT,
  type StoredTemplate,
} from '../data/templateStore';

interface Props {
  /** Shown so the firm knows which model the sample mapping was read against. */
  companyName: string;
  onClose?: () => void;
}

type Stage = 'idle' | 'reading' | 'review' | 'saved';

const howReads: Record<MappedLine['how'], string> = {
  instruction: 'you marked this cell',
  exact: 'the names match',
  synonym: 'a name analysts use for it',
  words: 'the words mostly match',
};

export function HouseTemplatePanel({ companyName, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [existing, setExisting] = useState<Omit<StoredTemplate, 'bytes'>[]>([]);
  const [revision, setRevision] = useState<ReturnType<typeof reconcile> | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(() => {
    void listTemplates().then(setExisting).catch(() => setExisting([]));
  }, []);
  React.useEffect(refreshList, [refreshList]);

  const take = useCallback(
    async (file: File) => {
      setError(null);
      setStage('reading');
      try {
        const buffer = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const found = detectMapping(wb);
        setDetection(found);
        setBytes(buffer);
        setFileName(file.name);
        setDropped(new Set());

        // A REVISED TEMPLATE IS RECONCILED, NOT REBUILT. Where a mapping for an
        // earlier version of this file exists, the firm is shown what moved
        // rather than being asked to start again.
        const print = await fingerprintOf(buffer);
        const prior = (await listTemplates()).find((t) => t.name === file.name.replace(/\.xlsx?$/i, ''));
        if (prior) {
          const stored = await loadTemplate(prior.id);
          if (stored) setRevision(reconcile(stored.mapping, found, stored.mapping.fingerprint === print));
        } else {
          setRevision(null);
        }
        setStage('review');
      } catch (e: any) {
        setError(
          String(e?.message || e).slice(0, 200) ||
            'That file could not be read as a workbook.'
        );
        setStage('idle');
      }
    },
    []
  );

  const keep = useCallback(async () => {
    if (!detection || !bytes) return;
    const name = fileName.replace(/\.xlsx?$/i, '');
    const lines = detection.mapping.filter((m) => !dropped.has(m.key));
    const mapping: TemplateMapping = {
      id: `${name}-${Date.now().toString(36)}`,
      name,
      fingerprint: await fingerprintOf(bytes),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines,
      periodColumnsBySheet: detection.periodColumnsBySheet,
      periodColumns: detection.periodColumns,
    };
    const prior = existing.find((t) => t.name === name);
    if (prior) {
      const stored = await loadTemplate(prior.id);
      if (stored) {
        const r = reconcile(stored.mapping, detection, stored.mapping.fingerprint === mapping.fingerprint);
        const merged = applyReconciliation(stored.mapping, r, detection);
        await saveTemplate({ ...stored, bytes, fileName, mapping: { ...merged, name }, savedAt: new Date().toISOString() });
        setStage('saved');
        refreshList();
        return;
      }
    }
    await saveTemplate({ id: mapping.id, name, bytes, fileName, mapping, savedAt: new Date().toISOString() });
    setStage('saved');
    refreshList();
  }, [detection, bytes, fileName, dropped, existing, refreshList]);

  const toggle = (key: string) =>
    setDropped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const confident = detection?.mapping.filter((m) => m.confidence >= REVIEW_BELOW) ?? [];

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-8 sm:px-8">
      <div className={`${EYEBROW} text-accent`}>Your format</div>
      <h2 className="mt-1 font-display text-[clamp(27px,3.2vw,40px)] font-extrabold leading-[1.05] tracking-tight text-ink">
        Your template, our figures
      </h2>
      <p className={`${UI} mt-3 max-w-prose text-read`}>
        Upload the Excel layout your firm already uses. Every model you export from then on arrives
        in that format instead of ours. We read your file and propose what each of your lines is;
        you correct what we got wrong.
      </p>

      {/* ---- WHAT IS STORED, SAID BEFORE THE FILE IS ASKED FOR ---------- */}
      <div className="mt-6 border-t border-line pt-5">
        <div className={`${EYEBROW} text-quiet`}>Before you upload</div>
        <ul className={`${UI} mt-2 space-y-1.5 text-read`}>
          <li>
            Your file stays in <span className="text-ink">{STORAGE_STATEMENT.where}</span>. It is not
            sent to us. There is no upload in the network sense — the page reads it, maps it and
            fills it, and Marginalia runs no server that receives it.
          </li>
          <li>
            What is kept: <span className="text-ink">{STORAGE_STATEMENT.whatIsKept}</span>.
          </li>
          <li>
            What is not: <span className="text-ink">{STORAGE_STATEMENT.whatIsNotKept}</span>.
          </li>
          <li>
            How long: <span className="text-ink">{STORAGE_STATEMENT.howLong}</span>.
          </li>
          <li className="text-quiet">
            The cost of that: a template does not follow you to another device or browser.
          </li>
        </ul>
      </div>

      {/* ---- THE UPLOAD ------------------------------------------------- */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void take(file);
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={stage === 'reading'}
          className={`${LABEL} inline-flex items-center gap-2 border border-accent bg-accent/20 px-4 py-2.5 uppercase tracking-widest text-ink transition-colors hover:bg-accent/35 disabled:opacity-40`}
        >
          <Upload className="h-3.5 w-3.5" />
          {stage === 'reading' ? 'Reading your template…' : 'Choose your template'}
        </button>
        {fileName && <span className={`${UI} text-quiet`}>{fileName}</span>}
      </div>

      {error && (
        <p className={`${UI} mt-4 text-accent`} role="alert">
          {error}
        </p>
      )}

      {detection && stage !== 'reading' && (
        <div className="mt-8 border-t border-line pt-6">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className={`${EYEBROW} text-quiet`}>What we found</span>
            <span className={`${UI} text-read`}>
              <span className="font-mono text-ink">{detection.mapping.length}</span> of your lines
              matched ours, over {detection.sheets.length} tab
              {detection.sheets.length === 1 ? '' : 's'}
              {detection.periodColumns ? `, ${detection.periodColumns} periods wide` : ''}.
            </span>
          </div>

          {revision && (
            <div className="mt-4 border border-line bg-panel/40 px-4 py-3">
              <div className={`${EYEBROW} text-accent`}>This looks like a revision</div>
              <p className={`${UI} mt-1.5 text-read`}>
                A mapping for a template of this name already exists.{' '}
                <span className="text-ink">{revision.kept.length}</span> lines are where they were,{' '}
                <span className="text-ink">{revision.moved.length}</span> have moved and have been
                followed, <span className="text-ink">{revision.lost.length}</span> are no longer in
                the file. Keeping this replaces the old mapping; lines that are gone are dropped
                rather than left pointing at whatever now occupies their cell, and will be listed as
                unmapped in every export.
              </p>
            </div>
          )}

          {detection.review.length > 0 && (
            <div className="mt-5">
              <div className={`${EYEBROW} text-accent`}>Worth a look first</div>
              <p className={`${UI} mt-1 text-quiet`}>
                We are less sure of these. Untick any we have read wrongly.
              </p>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {detection.review.map((m) => (
                  <Row key={m.key} line={m} dropped={dropped.has(m.key)} onToggle={() => toggle(m.key)} />
                ))}
              </ul>
            </div>
          )}

          {detection.conflicts.length > 0 && (
            <div className="mt-5">
              <div className={`${EYEBROW} text-accent`}>Two of your cells claim the same line</div>
              <ul className={`${UI} mt-2 space-y-1 text-read`}>
                {detection.conflicts.map((c) => (
                  <li key={c.key}>
                    <span className="font-mono text-ink">{c.key}</span> — {c.at.join(', ')}. We used
                    the strongest match; untick it below if we chose the wrong one.
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5">
            <Disclose
              summary={`The ${confident.length} we are confident about`}
              trailing={<Pill tone="neutral">{confident.length}</Pill>}
            >
              <ul className="divide-y divide-line border-y border-line">
                {confident.map((m) => (
                  <Row key={m.key} line={m} dropped={dropped.has(m.key)} onToggle={() => toggle(m.key)} />
                ))}
              </ul>
            </Disclose>
          </div>

          {/* A LINE WITH NOWHERE TO GO IS REPORTED, HERE AND IN THE FILE. */}
          <div className="mt-4">
            <Disclose
              summary="Lines we carry that your template has no place for"
              trailing={<Pill tone={detection.unmapped.length ? 'warn' : 'neutral'}>{detection.unmapped.length}</Pill>}
            >
              <p className="max-w-prose">
                These are not dropped quietly. Every export carries a sheet naming them{' '}
                <span className="text-ink">and giving their figures period by period</span>, because
                a line name on its own is not something you can act on. Add a row with any of these
                names to your template and it will be picked up next time — and the full model in
                our own layout stays one click away on the company page.
              </p>
              <ul className={`${UI} mt-3 grid gap-x-6 gap-y-1 text-quiet sm:grid-cols-2`}>
                {detection.unmapped.map((u) => (
                  <li key={u.key}>
                    <span className="font-mono text-read">{u.key}</span> — {u.label}
                  </li>
                ))}
              </ul>
            </Disclose>
          </div>

          <p className={`${UI} mt-5 text-quiet`}>
            A cell we are asked to fill and cannot will read “{CANNOT_FILL}” rather than being left
            blank, because a blank in a filled model reads as a nil. Your cells receive figures, not
            formulas — your own formulas are untouched and go on calculating from them. The workbook
            in our layout is the one with our formulas live, and it stays one click away.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <button
              type="button"
              onClick={() => void keep()}
              className={`${LABEL} inline-flex items-center gap-2 border border-accent bg-accent/20 px-4 py-2.5 uppercase tracking-widest text-ink transition-colors hover:bg-accent/35`}
            >
              <Check className="h-3.5 w-3.5" />
              Keep this mapping
            </button>
            {stage === 'saved' && (
              <span className={`${UI} text-read`}>
                Kept on this device. {companyName} and every model after it will export in your
                format.
              </span>
            )}
          </div>
        </div>
      )}

      {/* ---- WHAT IS ALREADY HERE, AND HOW TO REMOVE IT ----------------- */}
      {existing.length > 0 && (
        <div className="mt-10 border-t border-line pt-6">
          <div className={`${EYEBROW} text-quiet`}>On this device</div>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {existing.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-quiet" />
                <span className={`${LABEL} text-ink`}>{t.name}</span>
                <span className={`${UI} text-quiet`}>
                  {t.mapping.lines.length} lines mapped · kept {t.savedAt.slice(0, 10)}
                </span>
                <button
                  type="button"
                  onClick={() => void forgetTemplate(t.id).then(refreshList)}
                  className={`${LABEL} ml-auto inline-flex items-center gap-1.5 border border-line px-3 py-1.5 uppercase tracking-widest text-muted transition-colors hover:border-accent hover:text-ink`}
                  title="Delete the file and its mapping from this browser"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <p className={`${UI} mt-3 text-quiet`}>
            Removing deletes the file and its mapping together. Nothing is kept back, because there
            is nowhere else it is held.
          </p>
        </div>
      )}

      {onClose && (
        <div className="mt-10">
          <button type="button" onClick={onClose} className={`${LABEL} text-muted hover:text-ink`}>
            ← Back to the model
          </button>
        </div>
      )}
    </div>
  );
}

const Row: React.FC<{ line: MappedLine; dropped: boolean; onToggle: () => void }> = ({
  line,
  dropped,
  onToggle,
}) => {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
      <input
        type="checkbox"
        checked={!dropped}
        onChange={onToggle}
        className="h-3.5 w-3.5 shrink-0 accent-[#8B1E1E]"
        aria-label={`Use ${line.theirs} for ${line.ours}`}
      />
      <span className={`${UI} min-w-[12rem] ${dropped ? 'text-quiet line-through' : 'text-ink'}`}>
        {line.theirs}
      </span>
      <span className={`${UI} text-quiet`}>→ {line.ours}</span>
      <span className={`${LABEL} ml-auto text-quiet`}>{cellAddress(line)}</span>
      <span className={`${UI} w-44 text-right text-quiet`}>
        {line.confidence < REVIEW_BELOW && (
          <AlertTriangle className="mr-1 inline h-3 w-3 text-accent" aria-hidden />
        )}
        {howReads[line.how]}
      </span>
    </li>
  );
};

export default HouseTemplatePanel;
