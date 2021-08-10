import { DateTime } from 'luxon';

import type { Card } from '../src/types';
import reducer, { addCard } from '../src/store/slices/cards';

describe('cardReducer', () => {
  const cards: { [id: string]: Card } = {
    '40d14391c': {
      id: '40d14391c',
      name: 'card1',
      type: 'Editor',
      metafile: '29334943',
      created: DateTime.fromISO('2019-11-19T19:22:47.572-08:00', { setZone: true }).valueOf(),
      modified: DateTime.fromISO('2019-11-19T19:22:47.572-08:00', { setZone: true }).valueOf(),
      left: 0, top: 0
    }
  }

  const newCard: Card = {
    id: 't829w0351',
    name: 'card2',
    type: 'Editor',
    metafile: '84354571',
    created: DateTime.fromISO('2014-04-09T08:14:02.371-08:00', { setZone: true }).valueOf(),
    modified: DateTime.fromISO('2014-06-23T21:58:44.507-08:00', { setZone: true }).valueOf(),
    left: 100, top: 50
  }

  it('cardReducer appends a new card to state on action ADD_CARD', () => {
    expect(reducer(cards, addCard(newCard))).toEqual(
      {
        '40d14391c': cards['40d14391c'],
        't829w0351': newCard
      }
    );
  });

});