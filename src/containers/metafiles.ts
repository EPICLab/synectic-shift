import { PathLike, remove } from 'fs-extra';
import { v4 } from 'uuid';
import { DateTime } from 'luxon';
import { createAsyncThunk } from '@reduxjs/toolkit';

import type { Metafile, UUID } from '../types';
import * as io from './io';
import { AppThunkAPI } from '../store/hooks';
import { getRepository } from './repos';
import { asyncFilter, removeUndefinedProperties } from './format';
import { currentBranch, getRepoRoot, getStatus } from './git-porcelain';
import { resolveHandler } from './handlers';
import { getMetafileByBranch, getMetafileByFilepath, getMetafileByVirtual, metafileAdded, metafileUpdated } from '../store/slices/metafiles';
import { isHiddenFile, discardChanges } from './git-plumbing';
// import { isHiddenFile } from 'is-hidden-file';

// Type-narrowed utility types for Metafile
export type MetafileWithPath = Metafile & Required<Pick<Metafile, 'path'>>;
export type MetafileWithContent = Metafile & Required<Pick<Metafile, 'content'>>;
export type MetafileWithContains = Metafile & Required<Pick<Metafile, 'contains'>>;
export type MetafileWithTargets = Metafile & Required<Pick<Metafile, 'targets'>>;

export const isMetafilePathed = (metafile: Metafile): metafile is MetafileWithPath => {
  return (metafile as MetafileWithPath).path !== undefined;
}

export const isMetafileFile = (metafile: Metafile): metafile is MetafileWithContent => {
  return (metafile as MetafileWithContent).content !== undefined;
}

export const isMetafileDirectory = (metafile: Metafile): metafile is MetafileWithContains => {
  return (metafile as MetafileWithContains).contains !== undefined;
}

export const isMetafileDiff = (metafile: Metafile): metafile is MetafileWithTargets => {
  return (metafile as MetafileWithTargets).targets !== undefined;
}

/**
 * Filter the paths within the metafile `contains` field and return an anonymous JavaScript object containing the 
 * differentiated `directories` and `files` paths. Filtering requires examining the file system properties associated
 * with each contained path, and is therefore asynchronous and computationally expensive.
 * @param metafile A `Metafile` object that includes a valid `contains` field.
 * @param includeHidden (Optional) Flag for returning hidden files (e.g. `.<filename>` format on MacOS); defaults to true.
 * @return An anonymous JavaScript object with directories and files lists containing the filtered paths.
 */
export const filterDirectoryContainsTypes = async (metafile: MetafileWithContains, includeHidden = true):
  Promise<{ directories: string[], files: string[] }> => {
  const directories: string[] = await asyncFilter(metafile.contains, async (e: string) => io.isDirectory(e));
  let files: string[] = metafile.contains.filter(childPath => !directories.includes(childPath));
  if (includeHidden == false) files = files.filter(childPath => !isHiddenFile(childPath));
  return { directories: directories, files: files };
};

/**
 * Async Thunk action creator for updating the file stats properties (i.e. `filetype` and `handler`) of a metafile
 * based on the filetype extension and the associated entry in `filetypes.json`.
 * @param id The UUID corresponding to the metafile that should be updated.
 * @return A Thunk that can be executed via `store/hooks/useAppDispatch` to update the Redux store state; automatically 
 * wrapped in a [Promise Lifecycle](https://redux-toolkit.js.org/api/createAsyncThunk#promise-lifecycle-actions)
 * that generates `pending`, `fulfilled`, and `rejected` actions as needed.
 */
export const updateFileStats = createAsyncThunk<void, UUID, AppThunkAPI & { rejectValue: string }>(
  'metafiles/updateFileStats',
  async (id, thunkAPI) => {
    const metafile = thunkAPI.getState().metafiles.entities[id];
    if (!metafile || !metafile.path) return thunkAPI.rejectWithValue(metafile ? metafile.id : 'unknown');
    const handler = await thunkAPI.dispatch(resolveHandler(metafile.path)).unwrap();
    const fileStats = removeUndefinedProperties({ filetype: handler?.filetype, handler: handler?.handler });
    if (fileStats.filetype || fileStats.handler) thunkAPI.dispatch(metafileUpdated({ ...metafile, ...fileStats }));
  }
)

/**
* Async Thunk action creator for updating the git information of a metafile based on the associated repository and
* branch; this function is worktree-aware and can handle linked worktrees.
* @param id The UUID corresponding to the metafile that should be updated.
* @return A Thunk that can be executed via `store/hooks/useAppDispatch` to update the Redux store state; automatically 
 * wrapped in a [Promise Lifecycle](https://redux-toolkit.js.org/api/createAsyncThunk#promise-lifecycle-actions)
 * that generates `pending`, `fulfilled`, and `rejected` actions as needed.
*/
export const updateGitInfo = createAsyncThunk<void, UUID, AppThunkAPI & { rejectValue: string }>(
  'metafiles/updateGitInfo',
  async (id, thunkAPI) => {
    const metafile = thunkAPI.getState().metafiles.entities[id];
    if (!metafile || !metafile.path) return thunkAPI.rejectWithValue(metafile ? `metafile: ${metafile.id}` : 'metafile: unknown');
    try {
      let repo = metafile.repo ? await thunkAPI.dispatch(getRepository({ id: metafile.repo })).unwrap() : undefined;
      if (!repo) repo = await thunkAPI.dispatch(getRepository({ filepath: metafile.path })).unwrap();
      const root = await getRepoRoot(metafile.path);
      if (!root) {
        console.log(`updateGitInfo root: ${root}`);
        return;
      }
      const branch = repo ? (await currentBranch({
        dir: root ? root : repo.root.toString(),
        fullname: false
      })) : undefined;
      const status = await getStatus(metafile.path);
      const gitInfo = removeUndefinedProperties({ repo: repo?.id, branch: branch ? branch : 'HEAD', status: status });
      if (gitInfo.repo && gitInfo.status) thunkAPI.dispatch(metafileUpdated({ ...metafile, ...gitInfo }));
    } catch (error) {
      console.log(`updateGitInfo error: ${error}`);
      return thunkAPI.rejectWithValue(`${error}`);
    }
  }
)

/**
 * Async Thunk action creator for updating the contents of a metafile based on the associated file content, or the
 * subfiles and subdirectories contained within an associated directory. If the metafile is associated with a 
 * directory, then the paths of direct child files and directories are added to the `contains` field. If the metafile 
 * is associated with a file, then the file content is read and added to the `content` field.
 * @param id The UUID corresponding to the metafile that should be updated.
 * @return A Thunk that can be executed via `store/hooks/useAppDispatch` to update the Redux store state; automatically 
 * wrapped in a [Promise Lifecycle](https://redux-toolkit.js.org/api/createAsyncThunk#promise-lifecycle-actions)
 * that generates `pending`, `fulfilled`, and `rejected` actions as needed.
 */
export const updateContents = createAsyncThunk<void, UUID, AppThunkAPI & { rejectValue: string }>(
  'metafiles/updateContents',
  async (id, thunkAPI) => {
    const metafile = thunkAPI.getState().metafiles.entities[id];
    if (!metafile || !metafile.path) return thunkAPI.rejectWithValue(metafile ? metafile.id : 'unknown');
    thunkAPI.dispatch(metafileUpdated(
      (metafile.filetype === 'Directory') ?
        { ...metafile, contains: (await io.readDirAsyncDepth(metafile.path, 1)).filter(p => p !== metafile.path) } :
        { ...metafile, content: await io.readFileAsync(metafile.path, { encoding: 'utf-8' }), state: 'unmodified' }
    ));
  }
)

/**
 * Async Thunk action creator for updating all fields (file stats, git information, and contents) of a metafile.
 * @param id The UUID corresponding to the metafile that should be updated.
 * @return A Thunk that can be executed via `store/hooks/useAppDispatch` to update the Redux store state; automatically 
 * wrapped in a [Promise Lifecycle](https://redux-toolkit.js.org/api/createAsyncThunk#promise-lifecycle-actions)
 * that generates `pending`, `fulfilled`, and `rejected` actions as needed. Executes all metafile update actions and
 * returns `true` if all succeed, otherwise `false` is returned (including if the UUID does not match a current metafile
 * entry in the Redux store).
 */
export const updateAll = createAsyncThunk<boolean, UUID, AppThunkAPI>(
  'metafiles/updateAll',
  async (id, thunkAPI) => {
    const existing = thunkAPI.getState().metafiles.entities[id];
    if (!existing) return false;
    await thunkAPI.dispatch(updateFileStats(id));
    await thunkAPI.dispatch(updateGitInfo(id));
    await thunkAPI.dispatch(updateContents(id));
    return true;
  }
)

// Descriminated union type for emulating a `mutually exclusive or` (XOR) operation between parameter types
// Ref: https://github.com/microsoft/TypeScript/issues/14094#issuecomment-344768076
type MetafileGettableFields =
  { id: UUID, filepath?: never, virtual?: never } |
  { id?: never, filepath: PathLike, virtual?: never } |
  {
    id?: never, filepath?: never, virtual:
    Required<Pick<Metafile, 'name' | 'handler'>> & Omit<Metafile, 'id' | 'modified' | 'name' | 'handler'>
  };

/**
 * Async Thunk action creator for simplifying the process of obtaining an updated metafile from the Redux store.
 * The Thunk handles three different scenarios:
 *  * retrieving and updating an existing metafile by UUID, or
 *  * retrieving an existing (or creating a new) metafile by filepath, or 
 *  * retrieving an existing (or creating a new) virtual metafile by name and handler.
 * 
 * If there is no existing metafile associated with a particular UUID under scenario (1), then a `rejected` action will
 * be returned. Both scenario (2) and (3) are guaranteed to return a metafile, since a new metafile can be created when
 * no existing entry is found in the Redux store. This function will trigger Redux state updates as needed.
 * @param id The UUID corresponding to the metafile that should be updated and returned.
 * @param filepath The relative or absolute path to a file or directory that should be represented by an updated metafile.
 * @param virtual A named object containing at least the `name` and `handler` fields of a valid metafile (existing or new), and any other 
 * metafile fields except for `id` and `modified` (which are auto-generated on metafile creation).
 * @return A Thunk that can be executed via `store/hooks/useAppDispatch` to update the Redux store state; automatically 
 * wrapped in a [Promise Lifecycle](https://redux-toolkit.js.org/api/createAsyncThunk#promise-lifecycle-actions)
 * that generates `pending`, `fulfilled`, and `rejected` actions as needed. Returns a metafile that was either created or retrieved
 * and updated based on the filesystem, or `undefined` if unable to find the new/existing metafile from the Redux store.
 */
export const getMetafile = createAsyncThunk<Metafile | undefined, MetafileGettableFields, AppThunkAPI & { rejectValue: string }>(
  'metafiles/getMetafile',
  async (retrieveBy, thunkAPI) => {
    console.log(`getMetafile for ${JSON.stringify(retrieveBy)}`);
    if (retrieveBy.id) {
      const existing = await thunkAPI.dispatch(updateAll(retrieveBy.id)).unwrap();
      return existing ? thunkAPI.getState().metafiles.entities[retrieveBy.id] : undefined;
    }
    if (retrieveBy.filepath) {
      const root = await getRepoRoot(retrieveBy.filepath);
      const branch = root ? (await currentBranch({ dir: root.toString(), fullname: false })) : undefined;
      const existing = await (branch ?
        thunkAPI.dispatch(getMetafileByBranch({ filepath: retrieveBy.filepath, branch: branch })) :
        thunkAPI.dispatch(getMetafileByFilepath(retrieveBy.filepath))
      ).unwrap();
      const metafile = existing ?
        thunkAPI.getState().metafiles.entities[existing.id] :
        thunkAPI.dispatch(metafileAdded({
          id: v4(),
          name: io.extractFilename(retrieveBy.filepath),
          modified: DateTime.local().valueOf(),
          path: retrieveBy.filepath
        })).payload;
      const updated = metafile ? await thunkAPI.dispatch(updateAll(metafile.id)).unwrap() : undefined;
      if (!updated || !metafile) return undefined;
      return thunkAPI.getState().metafiles.entities[metafile.id];
    }
    if (retrieveBy.virtual) {
      const existing = await (thunkAPI.dispatch(getMetafileByVirtual({
        name: retrieveBy.virtual.name,
        handler: retrieveBy.virtual.handler
      })).unwrap());
      const metafile = existing ?
        thunkAPI.getState().metafiles.entities[existing.id] :
        thunkAPI.dispatch(metafileAdded({
          id: v4(),
          modified: DateTime.local().valueOf(),
          ...retrieveBy.virtual
        })).payload;
      return metafile ? thunkAPI.getState().metafiles.entities[metafile.id] : undefined;
    }
    return thunkAPI.rejectWithValue('Failed to match any containers/metafiles/getMetafile parameter types');
  }
)

export const discardMetafileChanges = createAsyncThunk<undefined, Metafile, AppThunkAPI & { rejectValue: string }>(
  'metafiles/discardMetafileChanges',
  async (metafile, thunkAPI) => {
    if (!metafile.path) return thunkAPI.rejectWithValue('Error: Failed to discard changes for undefined filepath');
    switch (metafile.status) {
      case '*added': // Fallthrough
      case 'added': {
        // added file; removing file and refetch to dischard changes
        remove(metafile.path.toString(), (error) => thunkAPI.rejectWithValue(`${error.name}: ${error.message}`));
        const handler = await thunkAPI.dispatch(resolveHandler(metafile.path)).unwrap();
        if (handler) await thunkAPI.dispatch(getMetafile({ virtual: { name: metafile.name, handler: handler.handler } }));
        break;
      }
      case '*modified': // Fallthrough
      case 'modified': {
        // modified; overwrite metafile with original content from file (if changed)
        const updatedContent = await discardChanges(metafile.path);
        if (updatedContent) {
          await io.writeFileAsync(metafile.path, updatedContent);
          await thunkAPI.dispatch(getMetafile({ filepath: metafile.path }));
        }
        break;
      }
      case '*deleted': // Fallthrough
      case 'deleted': {
        // deleted; rewrite file content to discard changes
        const content = await discardChanges(metafile.path);
        if (content) {
          await io.writeFileAsync(metafile.path, content);
          await thunkAPI.dispatch(getMetafile({ filepath: metafile.path }));
        }
        break;
      }
    }
    return thunkAPI.rejectWithValue('Error: Failed to discard changes; unknown git status.');
  }
);