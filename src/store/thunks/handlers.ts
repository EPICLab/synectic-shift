import { v4 } from 'uuid';
import { PathLike } from 'fs-extra';
import type { Filetype, Metafile } from '../../types';
import * as io from '../../containers/io';
import filetypesJson from '../../containers/filetypes.json';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { cardAdded, cardUpdated } from '../slices/cards';
import { DateTime } from 'luxon';
import type { AppThunkAPI } from '../hooks';
import { filetypeAdded } from '../slices/filetypes';
import { fetchMetafile, fetchVersionControl, isFilebasedMetafile } from './metafiles';
import { metafileUpdated } from '../slices/metafiles';

export type HandlerRequiredMetafile = Metafile & Required<Pick<Metafile, 'handler'>>;

/**
 * Type Guard for narrowing the `Metafile` type to the more-specific `HandlerRequiredMetafile` type, which requires the
 * optional `handler` property be defined in order to allow the appropriate handlers to be loaded.
 * @param metafile A `Metafile` that should be run-time checked for the `handler` property.
 * @return Boolean indicating whether the metafile can be type narrowed to `HandlerRequiredMetafile`.
 */
export const isHandlerRequiredMetafile = (metafile: Metafile): metafile is HandlerRequiredMetafile => {
  return 'handler' in metafile;
}

/**
 * Extracts and updates list of supported filetypes in Redux store.
 * @return A Thunk that can be executed via `store/hooks/useAppDispatch` to update the Redux store state; automatically 
 * wrapped in a [Promise Lifecycle](https://redux-toolkit.js.org/api/createAsyncThunk#promise-lifecycle-actions)
 * that generates `pending`, `fulfilled`, and `rejected` actions as needed.
 */
export const importFiletypes = createAsyncThunk<void, void, AppThunkAPI>(
  'handlers/importFiletypes',
  async (_, thunkAPI) => {
    const filetypes = filetypesJson as Omit<Filetype, 'id'>[];
    filetypes.map(filetype => {
      thunkAPI.dispatch(filetypeAdded({ id: v4(), ...filetype }));
    });
  }
)

/**
 * Locate filetype information for a specific filepath. If none exists, then the filepath points to an unsupported file.
 * @param filepath The relative or absolute path to evaluate.
 * @return A Thunk that can be executed via `store/hooks/useAppDispatch` to update the Redux store state; automatically 
 * wrapped in a [Promise Lifecycle](https://redux-toolkit.js.org/api/createAsyncThunk#promise-lifecycle-actions)
 * that generates `pending`, `fulfilled`, and `rejected` actions as needed.
 */
export const resolveHandler = createAsyncThunk<Filetype | undefined, PathLike, AppThunkAPI & { rejectValue: string }>(
  'handlers/resolveHandler',
  async (filepath, thunkAPI) => {
    const stats = await io.extractStats(filepath);
    const filetypes = Object.values(thunkAPI.getState().filetypes.entities);
    let handler: Filetype | undefined;
    if (stats && stats.isDirectory()) {
      handler = filetypes.find(filetype => filetype?.filetype === 'Directory');
    } else {
      const extension = io.extractExtension(filepath);
      handler = filetypes.find(filetype => filetype?.extensions.some(ext => ext === extension));
      if (!handler) handler = filetypes.find(filetype => filetype?.filetype === 'Text');
    }
    if (!handler) thunkAPI.rejectWithValue(`No handler found for '${filepath.toString()}'`);
    return handler;
  }
)

// Descriminated union type for emulating a `mutually exclusive or` (XOR) operation between parameter types
// Ref: https://github.com/microsoft/TypeScript/issues/14094#issuecomment-344768076
type CardLoadableFields =
  { metafile: Metafile, filepath?: never } |
  { metafile?: never, filepath: PathLike };

/**
 * Utility for adding a new Card, either by providing one or more metafile (specifically to support Diff cards which require 
 * two metafiles) with an appropriate handler field or by providing a filepath in order to read the filesystem and dispatch 
 * any necessary Redux store updates before loading a new Card. This function will load an error if the metafile does not 
 * contain a valid filetype handler.
 * @param metafile A `Metafile` objects previously created or retrieved from the Redux state.
 * @param filepath The relative or absolute path to evaluate.
 * @return A Thunk that can be executed to load a card onto the canvas and dispatch Redux updates, if the card cannot
 * be added to the Redux store and no errors can be generated, then `undefined` is returned instead.
 */
export const loadCard = createAsyncThunk<void, CardLoadableFields, AppThunkAPI & { rejectValue: string }>(
  'handlers/loadCard',
  async (param, thunkAPI) => {
    const card = thunkAPI.dispatch(cardAdded({
      id: v4(),
      name: param.metafile ? param.metafile.name : param.filepath.toString(),
      created: DateTime.local().valueOf(),
      modified: DateTime.local().valueOf(),
      zIndex: 0,
      left: 10,
      top: 70,
      type: 'Loading',
      metafile: '',
      classes: []
    })).payload;
    const metafile = param.metafile ? param.metafile : await thunkAPI.dispatch(fetchMetafile({ filepath: param.filepath })).unwrap();
    if (param.filepath && isFilebasedMetafile(metafile)) {
      const vcs = await thunkAPI.dispatch(fetchVersionControl(metafile)).unwrap();
      thunkAPI.dispatch(metafileUpdated({ ...metafile, ...vcs }));
    }
    if (isHandlerRequiredMetafile(metafile)) {
      thunkAPI.dispatch(cardUpdated({
        ...card,
        name: metafile.name,
        type: metafile.handler,
        metafile: metafile.id
      }));
    } else {
      thunkAPI.rejectWithValue(`Metafile '${metafile.name}' missing handler for filetype: '${metafile.filetype}'`);
    }
  }
)