import { DateTime } from 'luxon';
import { v4 } from 'uuid';
import parsePath from 'parse-path';

import { Canvas, Stack, Card, Filetype, Metafile, Repository } from '../../src/types';
import { createStore } from 'redux';
import { rootReducer } from '../../src/store/root';

export const getMockStore = () => {
  type initStateT = {
    canvas: { [id: string]: Canvas };
    stacks: { [id: string]: Stack };
    cards: { [id: string]: Card };
    filetypes: { [id: string]: Filetype };
    metafiles: { [id: string]: Metafile };
    repos: { [id: string]: Repository };
  }
  const initialState: initStateT = {
    canvas: {},
    stacks: {
      33: {
        id: '33',
        name: 'sample stack',
        created: DateTime.fromISO('2019-01-21T08:14:52.181-08:00'),
        modified: DateTime.fromISO('2019-11-19T19:22:47.572-08:00'),
        note: '',
        cards: [],
        left: 5,
        top: 5
      }
    },
    cards: {
      14: {
        id: '14',
        name: 'test.js',
        type: 'Editor',
        related: ['243'],
        created: DateTime.fromISO('2019-01-21T08:14:52.181-08:00'),
        modified: DateTime.fromISO('2019-11-19T19:22:47.572-08:00'),
        captured: false,
        left: 10,
        top: 10
      },
      29: {
        id: '29',
        name: 'example.ts',
        type: 'Editor',
        related: ['199'],
        created: DateTime.fromISO('2019-01-21T08:14:52.181-08:00'),
        modified: DateTime.fromISO('2019-11-19T19:22:47.572-08:00'),
        captured: false,
        left: 10,
        top: 10
      }
    },
    filetypes: {
      91: {
        id: '91',
        filetype: 'JavaScript',
        handler: 'Editor',
        extensions: ['js', 'jsm']
      },
      45: {
        id: '45',
        filetype: 'TypeScript',
        handler: 'Editor',
        extensions: ['ts', 'typescript', 'str']
      }
    },
    metafiles: {
      199: {
        id: '199',
        name: 'test.js',
        modified: DateTime.fromISO('2019-11-19T19:19:47.572-08:00')
      },
      243: {
        id: '243',
        name: 'example.ts',
        modified: DateTime.fromISO('2015-06-19T19:10:47.572-08:00')
      }
    },
    repos: {
      13: {
        id: '13',
        name: 'test/repo',
        corsProxy: new URL('http://www.random_proxy.edu'),
        url: parsePath('http://www.random_proxy.edu'),
        refs: ['master'],
        oauth: 'github',
        username: 'sam',
        password: 'pass123',
        token: '934394304234231'
      }
    }
  };
  return createStore(rootReducer, initialState);
};

export const getCanvasProps = (): Canvas => {
  return {
    id: v4(),
    created: DateTime.fromISO('2019-11-19T19:22:47.572-08:00'),
    repos: ['13'],
    cards: ['29', '14'],
    stacks: ['33']
  };
};