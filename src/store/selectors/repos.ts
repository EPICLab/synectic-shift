import { RootState } from '../root';
import { UUID, Card } from '../../types';

export const getCardsByRepo = (repo: UUID, branch?: string) => (state: RootState): Card[] => {
  return Object.values(state.cards)
    .filter(c => c.metafile !== undefined)
    .filter(c => state.metafiles[c.metafile] ? (state.metafiles[c.metafile].repo === repo) : false)
    .filter(c => branch ? (state.metafiles[c.metafile].branch === branch) : true);
};