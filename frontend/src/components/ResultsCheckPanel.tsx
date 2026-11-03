import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getResultCheckRaces,
  getResultCheck,
  runFinalResults,
  getFinalResultsStatus,
  ResultCheckRace,
  ResultCheckComparison,
} from '../services/api';

const VERDICT_TEXT: Record<ResultCheckComparison['verdict'], string> = {
  confirmed: 'Confirmed',
  single: 'One source only',
  conflict: 'Sources disagree',
  none: 'No data yet',
};

const lastName = (name: string) => name.split(' ').slice(-1)[0];

// Most common value in a list (ties: first seen), undefined when empty.
const commonValue = (values: Array<string | null>): string | null | undefined => {
  const counts = new Map<string | null, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

// Pitlane card: fetches Jolpi, OpenF1 and the F1 live feed for one race and shows
// them side by side with the stored result. Comparing changes nothing; the one thing that does
// change data is "Run final results" for a race that is still waiting for its final run.
const ResultsCheckPanel = () => {
  const [races, setRaces] = useState<ResultCheckRace[]>([]);
  const [raceId, setRaceId] = useState<number | ''>('');
  const [comparison, setComparison] = useState<ResultCheckComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finalRunning, setFinalRunning] = useState(false);
  const [finalMessage, setFinalMessage] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadRaces = useCallback(async (keepSelected = false) => {
    try {
      const res = await getResultCheckRaces();
      setRaces(res.data);
      if (!keepSelected && res.data.length > 0) setRaceId(res.data[0].id);
    } catch {
      setError('Could not load the races.');
    }
  }, []);

  useEffect(() => {
    loadRaces();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadRaces]);

  const selectedRace = races.find((r) => r.id === raceId);
  const awaitingFinal = selectedRace?.status === 'provisional';

  // The run mails every player, so it goes on after the answer: ask for its status until it is over.
  const runFinal = async () => {
    if (!selectedRace) return;
    const ok = window.confirm(
      `Run the final results for ${selectedRace.race_name}?\n\nThis fetches the sources again, recalculates every player's points from what they agree on and emails the players. It can only be done once per race.`
    );
    if (!ok) return;
    setFinalRunning(true);
    setFinalMessage('Running the final results… this emails every player, so it can take a minute.');
    try {
      await runFinalResults(selectedRace.id);
    } catch (err: any) {
      setFinalRunning(false);
      setFinalMessage(err.response?.data?.error || 'Could not start the final results.');
      return;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data: job } = await getFinalResultsStatus();
        if (job.running) return;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setFinalRunning(false);
        setFinalMessage(job.lastMessage || 'The final run is over.');
        setComparison(null);
        loadRaces(true);
      } catch {
        // a missed poll is fine, the next one asks again
      }
    }, 2000);
  };

  const compare = async () => {
    if (raceId === '') return;
    setLoading(true);
    setError('');
    try {
      const res = await getResultCheck(raceId);
      setComparison(res.data);
    } catch {
      setComparison(null);
      setError('Could not compare the sources. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  // Columns: each source, then what is stored. A cell is flagged when it differs from the
  // majority of the sources in that row.
  const columns = comparison
    ? [
        ...comparison.sources.map((s) => ({ key: s.source, label: s.label, available: s.available, note: s.note, top: s.top, firstOut: s.firstOut, isStored: false })),
        ...(comparison.stored
          ? [{ key: 'stored', label: 'Stored now', available: true, note: undefined, top: comparison.stored.top, firstOut: comparison.stored.firstOut, isStored: true }]
          : []),
      ]
    : [];

  const rows: Array<{ label: string; cells: Array<{ text: string; flagged: boolean }> }> = [];
  if (comparison) {
    const sourceCols = columns.filter((c) => !c.isStored && c.available);
    for (let i = 0; i < comparison.scored; i++) {
      const common = commonValue(sourceCols.map((c) => (c.top[i] ? String(c.top[i].number) : null)));
      rows.push({
        label: String(i + 1),
        cells: columns.map((c) => {
          const d = c.top[i];
          return {
            text: c.available && d ? lastName(d.name) : '–',
            flagged: c.available && sourceCols.length > 1 && (d ? String(d.number) : null) !== common,
          };
        }),
      });
    }
    if (comparison.race.type === 'main') {
      const common = commonValue(sourceCols.map((c) => (c.firstOut ? String(c.firstOut.number) : null)));
      rows.push({
        label: '1st out',
        cells: columns.map((c) => ({
          text: !c.available ? '–' : c.firstOut ? lastName(c.firstOut.name) : 'none',
          flagged: c.available && sourceCols.length > 1 && (c.firstOut ? String(c.firstOut.number) : null) !== common,
        })),
      });
    }
  }

  return (
    <div className="card-f1 mb-8">
      <h2 className="text-2xl font-bold mb-2">Results Check</h2>
      <p className="text-white text-sm mb-4">
        Compare what Jolpi, OpenF1 and the F1 live feed say about a race with what is stored. Yellow cells differ from the
        other sources. Results are only applied automatically when at least two sources agree on the scored positions and the
        first retirement.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={raceId}
          onChange={(e) => {
            setRaceId(e.target.value === '' ? '' : Number(e.target.value));
            setComparison(null);
          }}
          className="input-f1 flex-1"
          aria-label="Race to compare"
        >
          {races.map((r) => (
            <option key={r.id} value={r.id}>
              Round {r.round}: {r.race_name}
              {r.race_type === 'sprint' ? ' (Sprint)' : ''} — {Number(r.stored_results) > 0 ? `${r.stored_results} stored` : 'no results stored'}
              {r.status === 'provisional' ? ' · waiting for final run' : ''}
            </option>
          ))}
        </select>
        <button onClick={compare} disabled={loading || raceId === ''} className="btn-f1-primary">
          {loading ? 'Comparing…' : 'Compare sources'}
        </button>
      </div>

      {error && <p className="text-white text-sm mb-3">{error}</p>}

      {comparison && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span
              className={`px-3 py-1 text-sm font-bold uppercase tracking-wide ${
                comparison.verdict === 'confirmed' ? 'bg-f1-blue text-white' : 'bg-f1-yellow-500 text-black'
              }`}
            >
              {VERDICT_TEXT[comparison.verdict]}
            </span>
            <span className="text-white text-sm">
              {comparison.wouldDo.action === 'apply'
                ? `Would apply ${comparison.wouldDo.rowsFrom ?? ''}: ${comparison.wouldDo.reason}`
                : comparison.wouldDo.action === 'hold'
                  ? 'Would hold: nothing changes until you decide (Force Re-sync applies the first source in priority order).'
                  : comparison.wouldDo.reason}
            </span>
          </div>
          {comparison.wouldDo.warning && <p className="text-white text-sm mb-3">{comparison.wouldDo.warning}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th className="bg-f1-yellow-500 text-black text-left px-3 py-2 font-f1-badge text-xs uppercase">Pos</th>
                  {columns.map((c) => (
                    <th key={c.key} className="bg-f1-yellow-500 text-black text-left px-3 py-2 font-f1 text-xs uppercase">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'bg-f1-blue' : 'bg-f1-blue-dark'}>
                    <td className="px-3 py-2 font-f1-badge text-white">{row.label}</td>
                    {row.cells.map((cell, j) => (
                      <td
                        key={columns[j].key}
                        className={`px-3 py-2 ${cell.flagged ? 'bg-f1-yellow-500 text-black font-bold' : 'text-white'}`}
                      >
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {columns.some((c) => !c.available && c.note) && (
            <ul className="mt-3 text-white text-xs space-y-1">
              {columns
                .filter((c) => !c.available && c.note)
                .map((c) => (
                  <li key={c.key}>
                    {c.label}: {c.note}
                  </li>
                ))}
            </ul>
          )}

          {comparison.differences.length > 0 && (
            <ul className="mt-3 text-white text-xs space-y-1">
              {comparison.differences.map((d) => (
                <li key={d.label}>
                  <strong>{d.label}</strong>: {d.what}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(awaitingFinal || finalMessage) && (
        <div className="mt-6 pt-4 border-t border-white/20">
          <h3 className="text-lg font-bold mb-1">Final results</h3>
          {awaitingFinal && selectedRace && (
            <>
              <p className="text-white text-sm mb-3">
                {selectedRace.race_name} is waiting for its final run, which recalculates the points once the post-race penalties are
                in. The scheduled run only happens on Sundays and Mondays; this runs it now. Compare the sources above first: the run
                applies what they agree on, and if they do not agree it changes nothing.
              </p>
              <button onClick={runFinal} disabled={finalRunning} className="btn-f1-primary">
                {finalRunning ? 'Running…' : 'Run final results'}
              </button>
            </>
          )}
          {finalMessage && <p className="text-white text-sm mt-3">{finalMessage}</p>}
        </div>
      )}
    </div>
  );
};

export default ResultsCheckPanel;
