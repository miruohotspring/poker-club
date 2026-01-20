import PreflopTrainingClient from './PreflopTrainingClient';
import { getPreflopQuestion } from './actions';

export default async function PreflopTrainingPage() {
  const initialQuestion = await getPreflopQuestion();

  return <PreflopTrainingClient initialQuestion={initialQuestion} />;
}
