import PreflopTrainingClient from './PreflopTrainingClient';
import {
  getPreflopQuestion,
  getPreflopSpots,
  getPreflopTrainingSummary,
} from './actions';

export default async function PreflopTrainingPage() {
  const [initialQuestion, spots, initialSummary] = await Promise.all([
    getPreflopQuestion(),
    getPreflopSpots(),
    getPreflopTrainingSummary(),
  ]);

  return (
    <PreflopTrainingClient
      initialQuestion={initialQuestion}
      spots={spots}
      initialSummary={initialSummary}
    />
  );
}
