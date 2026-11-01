import SegmentedTabs from './SegmentedTabs';
import { useSeason } from '../context/SeasonContext';

// Switch between seasons on the pages that have a season. Nothing is shown while there is only one.
const SeasonPicker = () => {
  const { season, seasons, setSeason } = useSeason();
  if (seasons.length < 2) return null;
  return (
    <div className="mb-4 max-w-xs mx-auto">
      <SegmentedTabs
        scrollable
        options={seasons.map((s) => ({ value: String(s), label: String(s) }))}
        value={String(season)}
        onChange={(value) => setSeason(Number(value))}
      />
    </div>
  );
};

export default SeasonPicker;
