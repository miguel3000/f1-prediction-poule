import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { getQualifyingOrder, submitPrediction, getPrediction } from '../services/api';
import { haptics } from '../utils/haptics';
import { getTeamColor } from '../utils/teamColors';

const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const DndBackend = isTouchDevice() ? TouchBackend : HTML5Backend;
const backendOptions = isTouchDevice() ? {
  enableMouseEvents: true,
  delayTouchStart: 120,
  touchSlop: 8,
} : {};

interface Driver {
  id: number;
  driver_number: number;
  name: string;
  name_acronym?: string;
  team: string;
  image_url?: string;
  position?: number;
  q1?: string;
  q2?: string;
  q3?: string;
}

interface DragItem {
  driver: Driver;
  source: 'qualifying' | 'grid';
  sourceIndex?: number;
}

const ItemType = 'DRIVER';

const acronym = (driver: Driver) =>
  driver.name_acronym || driver.name.split(' ').pop()?.substring(0, 3).toUpperCase() || '???';

const lastName = (driver: Driver) => driver.name.split(' ').pop() || driver.name_acronym || '???';

// ── Driver avatar ─────────────────────────────────────────────────────────
const DriverAvatar = ({ driver, size = 'md' }: { driver: Driver; size?: 'sm' | 'md' }) => {
  const teamColor = getTeamColor(driver.team);
  const dim = size === 'sm' ? 'w-8 h-8 text-[9px]' : 'w-10 h-10 text-[10px]';

  if (driver.image_url) {
    return (
      <img
        src={driver.image_url}
        alt={driver.name}
        className={`${dim} rounded-full object-cover flex-shrink-0 border-2 ${teamColor.border} bg-gray-700`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  // Initials fallback
  const initials = acronym(driver);
  return (
    <div className={`${dim} rounded-full flex-shrink-0 flex items-center justify-center font-black border-2 ${teamColor.border} bg-gray-800 text-white`}>
      {initials}
    </div>
  );
};

// ── Driver card (left column) ──────────────────────────────────────────────
interface QualifyingDriverCardProps {
  driver: Driver;
  isSelected: boolean;
  onTap: (driver: Driver) => void;
}

const QualifyingDriverCard = ({ driver, isSelected, onTap }: QualifyingDriverCardProps) => {
  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: () => { haptics.light(); return { driver, source: 'qualifying' as const }; },
    canDrag: !isSelected,
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  const teamColor = getTeamColor(driver.team);

  return (
    <div
      ref={drag}
      onClick={() => !isSelected && onTap(driver)}
      className={`
        flex items-center gap-2 px-2 py-1.5 rounded-xl border-l-4 transition-all select-none
        ${teamColor.border}
        ${isSelected
          ? 'opacity-30 cursor-default bg-gray-800'
          : isDragging
          ? 'opacity-40 bg-gray-800'
          : 'bg-gray-800 active:scale-95 cursor-grab'}
      `}
    >
      <DriverAvatar driver={driver} size="md" />

      <div className="flex-1 min-w-0">
        <span className="font-f1 font-bold text-white text-[11px] tracking-widest block truncate">
          {lastName(driver)}
        </span>
        <span className="text-[9px] font-mono">
          {driver.q3 || driver.q2 || driver.q1
            ? <span className="text-green-400">{driver.q3 || driver.q2 || driver.q1}</span>
            : <span className="text-gray-500">#{driver.driver_number}</span>
          }
        </span>
      </div>

      {isSelected
        ? <span className="text-green-400 text-sm font-bold pr-1 flex-shrink-0">✓</span>
        : <span className="text-gray-600 text-lg font-light pr-1 flex-shrink-0">+</span>
      }
    </div>
  );
};

// ── Grid slot (right column) ───────────────────────────────────────────────
interface GridSlotProps {
  position: number;
  driver: Driver | null;
  onDrop: (item: DragItem, targetPosition: number) => void;
  onDragStart: (position: number) => void;
  onTap: (position: number) => void;
}

const GridSlot = ({ position, driver, onDrop, onDragStart, onTap }: GridSlotProps) => {
  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: () => { haptics.light(); onDragStart(position); return { driver, source: 'grid' as const, sourceIndex: position - 1 }; },
    canDrag: !!driver,
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemType,
    drop: (item: DragItem) => { haptics.success(); onDrop(item, position); },
    collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
  });

  const ref = useCallback((node: HTMLDivElement | null) => { drag(node); drop(node); }, [drag, drop]);
  const teamColor = driver ? getTeamColor(driver.team) : null;

  const posColor = position === 1 ? 'text-yellow-400' :
    position === 2 ? 'text-gray-300' :
    position === 3 ? 'text-orange-400' :
    'text-gray-600';

  return (
    <div className="flex items-center gap-1.5 w-full">
      <span className={`text-xs w-6 text-center tabular-nums font-black flex-shrink-0 ${posColor}`}>
        {position}
      </span>
      <div
        ref={ref}
        onClick={() => driver && onTap(position)}
        className={`
          flex-1 h-12 rounded-lg border-l-4 flex items-center gap-2 px-2 transition-all
          ${isDragging
            ? 'opacity-40 border-f1-red-500 scale-95 bg-gray-800'
            : isOver && canDrop
            ? 'border-f1-red-500 bg-f1-red-500/10 scale-[1.02]'
            : driver && teamColor
            ? `${teamColor.border} bg-gray-800/80 cursor-grab active:scale-95`
            : 'border-dashed border-gray-700 bg-gray-900/40'}
        `}
      >
        {driver ? (
          <>
            <DriverAvatar driver={driver} size="sm" />
            <span className="font-f1 font-bold text-white text-[11px] tracking-widest truncate flex-1">
              {lastName(driver)}
            </span>
          </>
        ) : (
          <span className="text-gray-700 text-[9px] mx-auto tracking-wider uppercase">empty</span>
        )}
      </div>
    </div>
  );
};

// ── Remove zone ────────────────────────────────────────────────────────────
interface RemoveZoneProps { onDrop: (item: DragItem) => void; children: React.ReactNode; }

const RemoveZone = ({ onDrop, children }: RemoveZoneProps) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemType,
    drop: (item: DragItem) => { if (item.source === 'grid') onDrop(item); },
    canDrop: (item: DragItem) => item.source === 'grid',
    collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
  });

  return (
    <div ref={drop} className={`transition-all rounded-xl ${isOver && canDrop ? 'ring-2 ring-red-500 bg-red-900/20' : ''}`}>
      {children}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────
interface PredictionInterfaceProps { raceId: number; }

const PredictionInterface = ({ raceId }: PredictionInterfaceProps) => {
  const navigate = useNavigate();
  const [qualifyingDrivers, setQualifyingDrivers] = useState<Driver[]>([]);
  const [predictions, setPredictions] = useState<(Driver | null)[]>(Array(10).fill(null));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [hasQualifyingResults, setHasQualifyingResults] = useState(false);
  const [orderSource, setOrderSource] = useState<string>('');
  const [showQualiDetails, setShowQualiDetails] = useState(false);

  useEffect(() => { fetchData(); }, [raceId]);

  const fetchData = async () => {
    try {
      const qualifyingResponse = await getQualifyingOrder(raceId);
      const { drivers, source, hasQualifyingResults: hasQuali } = qualifyingResponse.data;
      setQualifyingDrivers(drivers);
      setOrderSource(source || '');
      setHasQualifyingResults(hasQuali || false);

      try {
        const predictionResponse = await getPrediction(raceId);
        const existing = predictionResponse.data;
        const loaded: (Driver | null)[] = [];
        for (let i = 1; i <= 10; i++) {
          const driverId = existing[`position_${i}`];
          loaded.push(driverId ? drivers.find((d: Driver) => d.id === driverId) || null : null);
        }
        setPredictions(loaded);
      } catch { /* no existing prediction */ }

      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  };

  const selectedIds = new Set(predictions.filter(Boolean).map(d => d!.id));

  const handleTapDriver = (driver: Driver) => {
    const firstEmpty = predictions.findIndex(d => d === null);
    if (firstEmpty === -1) return;
    haptics.selection();
    const next = [...predictions];
    next[firstEmpty] = driver;
    setPredictions(next);
  };

  const handleTapGridSlot = (position: number) => {
    haptics.light();
    const next = [...predictions];
    next[position - 1] = null;
    setPredictions(next);
  };

  const handleDrop = (item: DragItem, targetPosition: number) => {
    const next = [...predictions];
    const targetIndex = targetPosition - 1;

    if (item.source === 'qualifying') {
      if (next[targetIndex]) {
        const emptyIndex = next.findIndex(d => d === null);
        if (emptyIndex !== -1) next[emptyIndex] = next[targetIndex];
      }
      next[targetIndex] = item.driver;
    } else if (item.source === 'grid' && item.sourceIndex !== undefined) {
      const src = item.sourceIndex;
      if (src !== targetIndex) {
        [next[targetIndex], next[src]] = [next[src], next[targetIndex]];
      }
    }
    setPredictions(next);
  };

  const handleRemoveFromGrid = (item: DragItem) => {
    if (item.sourceIndex !== undefined) {
      const next = [...predictions];
      next[item.sourceIndex] = null;
      setPredictions(next);
    }
  };

  const handleSubmit = async () => {
    if (predictions.some(d => d === null)) { setMessage('Please fill all 10 positions first'); return; }
    setSubmitting(true);
    setMessage('');
    try {
      await submitPrediction(raceId, predictions.map(d => d!.id));
      setMessage('Prediction submitted successfully!');
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Failed to submit prediction');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400">Loading...</div>;

  const filledCount = predictions.filter(Boolean).length;
  const orderLabel =
    orderSource === 'qualifying' ? 'Qualifying' :
    orderSource === 'previous_race' ? 'Prev. Race' : 'Championship';

  return (
    <DndProvider backend={DndBackend} options={backendOptions}>
      <div className="flex flex-col gap-3">

        {/* Column headers */}
        <div className="grid grid-cols-2 gap-2 px-1">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-f1-red-500 uppercase tracking-widest">{orderLabel}</p>
              {!hasQualifyingResults && (
                <button
                  onClick={fetchData}
                  className="text-[10px] text-gray-400 hover:text-white transition-colors"
                  title="Refresh qualifying order"
                >
                  ↺ Refresh
                </button>
              )}
            </div>
            {hasQualifyingResults && (
              <button
                onClick={() => setShowQualiDetails(!showQualiDetails)}
                className="text-[10px] text-green-400 flex items-center gap-1 mt-0.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                {showQualiDetails ? 'Hide times' : 'Lap times'}
              </button>
            )}
          </div>
          <div className="flex items-start justify-between">
            <p className="text-[10px] font-bold text-f1-red-500 uppercase tracking-widest">Your Grid</p>
            <span className="text-[10px] text-gray-500 font-bold tabular-nums">{filledCount}/10</span>
          </div>
        </div>

        {/* Qualifying times panel */}
        {hasQualifyingResults && showQualiDetails && (
          <div className="bg-gray-900 rounded-xl p-3 text-xs max-h-[180px] overflow-y-auto">
            <div className="grid grid-cols-[20px_1fr_auto] gap-x-2 gap-y-1">
              {qualifyingDrivers.map((d) => (
                <div key={d.id} className="contents">
                  <span className="text-gray-500 font-mono">P{d.position}</span>
                  <span className="font-f1 font-bold text-white">{acronym(d)}</span>
                  <span className="text-green-400 font-mono">{d.q3 || d.q2 || d.q1 || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hint */}
        <p className="text-center text-[10px] text-gray-600 tracking-wider uppercase">
          Tap to add · Tap slot to remove · Drag to reorder
        </p>

        {/* Two-column area */}
        <div className="grid grid-cols-2 gap-2">

          {/* Left: driver list */}
          <RemoveZone onDrop={handleRemoveFromGrid}>
            <div className="space-y-1 max-h-[520px] overflow-y-auto pr-0.5">
              {qualifyingDrivers.map((driver) => (
                <QualifyingDriverCard
                  key={driver.id}
                  driver={driver}
                  isSelected={selectedIds.has(driver.id)}
                  onTap={handleTapDriver}
                />
              ))}
            </div>
          </RemoveZone>

          {/* Right: grid / timing tower */}
          <div className="bg-gray-900 rounded-xl py-2 px-2 space-y-1 border border-gray-800">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((position) => (
              <GridSlot
                key={position}
                position={position}
                driver={predictions[position - 1]}
                onDrop={handleDrop}
                onDragStart={() => {}}
                onTap={handleTapGridSlot}
              />
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-f1-red-500 rounded-full transition-all duration-300"
            style={{ width: `${(filledCount / 10) * 100}%` }}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || filledCount < 10}
          className={`w-full py-3.5 rounded-xl font-black text-sm tracking-widest uppercase transition-all ${
            filledCount < 10
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : 'bg-f1-red-500 text-white active:scale-95 shadow-f1-glow'
          }`}
        >
          {submitting ? 'Submitting…' : filledCount < 10 ? `${10 - filledCount} slots remaining` : 'Confirm Prediction'}
        </button>

        <button
          onClick={() => navigate('/predictions')}
          className="w-full py-3 rounded-xl font-bold text-sm text-gray-400 bg-gray-800/60 active:scale-95 tracking-wider uppercase"
        >
          View All Predictions
        </button>

        {message && (
          <div className={`p-3 rounded-xl text-sm text-center font-bold ${
            message.includes('success') ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'
          }`}>
            {message}
          </div>
        )}
      </div>
    </DndProvider>
  );
};

export default PredictionInterface;
