import * as fs from 'fs-extra';
import * as path from 'path';
import * as isogit from 'isomorphic-git';
import * as http from 'isomorphic-git/http/node';
import * as ini from 'ini';
import parse from 'parse-git-config';
import { get as getProperty, set as setProperty, has as hasProperty, delete as deleteProperty } from 'dot-prop';
import getGitConfigPath from 'git-config-path';
import * as io from '../io';
import { matrixEntry, matrixToStatus, resolveRef, statusMatrix } from './git-plumbing';
import { isDefined, removeUndefinedProperties } from '../utils';
import { getRoot, getWorktreePaths } from '../git';
import { GitStatus } from '../../store/types';
import { list } from './git-worktree';
import { add, statusMatrix as shimStatusMatrix } from '../git-worktree-shim';
import * as gitBranch from '../git/git-branch'; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as gitCheckout from '../git/git-checkout'; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as gitClone from '../git/git-clone'; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as gitLog from '../git/git-log'; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as gitMerge from '../git/git-merge'; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as gitStatus from '../git/git-status'; // eslint-disable-line @typescript-eslint/no-unused-vars

export type GitConfig = { scope: 'none' } | { scope: 'local' | 'global', value: string, origin?: string };

/**
 * Create a branch within an existing repository; this function is a wrapper to the *isomorphic-git/branch* function to inject the `fs` 
 * parameter and extend with additional worktree path resolving functionality. If the `gitdir` parameter is a file, then `.git` points 
 * to a file containing updated pathing to translate from the linked worktree to the `.git/worktree` directory in the main worktree and 
 * this path must be used for branch checks.
 * 
 * @deprecated This implementation uses old-git functions that rely on isomorphic-git, please use {@link gitBranch.createBranch} instead.
 * @param obj - A destructured object for named parameters.
 * @param obj.dir - The worktree root directory.
 * @param obj.gitdir - The wortkree git directory.
 * @param obj.ref - The branch name for labeling the new branch.
 * @param obj.checkout - Optional flag to update the working directory along with updating HEAD; defaults to `false`.
 * @returns {Promise<fs.PathLike>} A Promise object containing the worktree root directory (which can vary from the `dir` parameter depending on whether a linked 
 * worktree was created).
 */
export const branch = async ({
  dir, gitdir = path.join(dir.toString(), '.git'), ref, checkout = false
}: {
  dir: fs.PathLike;
  gitdir?: fs.PathLike;
  ref: string;
  checkout?: boolean;
}): Promise<fs.PathLike> => {
  if (checkout) {
    await isogit.branch({ fs: fs, dir: dir.toString(), gitdir: gitdir.toString(), ref, checkout });
    return dir;
  } else {
    // create a linked worktree with the new branch
    const repo = io.extractFilename(dir);
    const linkedRoot = path.normalize(`${dir.toString()}/../.syn/${repo}/${ref}`);
    await add(dir, linkedRoot, ref);
    return linkedRoot;
  }
}

/**
 * Clone a repository; this function is a wrapper to the *isomorphic-git/clone* function to inject the `fs` parameter and extend with
 * additional local-only branch functionality. If the `ref` parameter or the current branch do not exist on the remote repository, then the
 * local-only repository (including the *.git* directory) is copied using the *fs.copy* function (excluding the `node_modules` directory).
 *
 * @deprecated This implementation uses old-git functions that rely on isomorphic-git, please use {@link gitClone.cloneRepo} instead.
 * @param obj - A destructured object for named parameters.
 * @param obj.dir - The worktree root directory to contain the cloned repo.
 * @param obj.url - The URL of a remote repository to be cloned.
 * @param obj.repo - The information associated with a local repository to be cloned.
 * @param obj.repo.root - The worktree root directory of a local repository to be cloned.
 * @param obj.repo.url - The URL associated with an existing local repository to be cloned.
 * @param obj.ref - An optional branch name or SHA-1 hash to target cloning to that specific branch or commit.
 * @param obj.singleBranch - Instead of the default behavior of fetching all the branches, only fetch a single branch.
 * @param obj.noCheckout - Only fetch the repo without checking out a branch. Skipping checkout can save a lot of time normally spent writing
 * files to disk.
 * @param obj.noTags - Disables the default behavior of fetching all tags.
 * @param obj.depth - Set the maximum depth to retrieve from the git repository's history.
 * @param obj.exclude - A list of branches or tags which should be excluded from remote server responses; specifically any commits reachable
 * from these refs will be excluded.
 * @param obj.onProgress - Callback for listening to GitProgressEvent occurrences during cloning.
 * @returns {Promise<boolean>} A Promise object containing a boolean representing success/failure of the cloning operation.
 */
export const clone = async ({ dir, url, repo, ref, singleBranch = false, noCheckout = false, noTags = false, depth, exclude, onProgress }: {
  dir: fs.PathLike;
  url?: URL;
  repo?: { root: fs.PathLike, url: string };
  ref?: string;
  singleBranch?: boolean;
  noCheckout?: boolean;
  noTags?: boolean;
  depth?: number;
  exclude?: string[];
  onProgress?: isogit.ProgressCallback | undefined;
}): Promise<boolean> => {
  const optionals = removeUndefinedProperties({ ref, depth, exclude, onProgress });
  if (dir.toString().length == 0) return false;

  if (url) {
    // cloning a new repository from remote URL
    await isogit.clone({
      fs: fs, http: http, dir: dir.toString(), url: url.toString(), singleBranch: singleBranch, noCheckout: noCheckout,
      noTags: noTags, ...optionals
    });
    return true;
  }

  if (repo) {
    const worktree = await getWorktreePaths(repo.root);
    const existingBranch = worktree.dir ? await currentBranch({ dir: worktree.dir, fullname: false }) : undefined;
    const remoteBranches = worktree.dir ? await isogit.listBranches({ fs: fs, dir: worktree.dir.toString(), remote: 'origin' }) : [];
    const targetBranch = ref ? ref : existingBranch;

    if (targetBranch && !remoteBranches.includes(targetBranch)) {
      // cloning a local-only branch via copy & branch
      await fs.copy(repo.root.toString(), dir.toString(), { filter: path => !(path.indexOf('node_modules') > -1) }); // do not copy node_modules/ directory
      await isogit.branch({ fs: fs, dir: dir.toString(), ref: targetBranch, checkout: false });
      if (!noCheckout) await checkout({ dir: dir, ref: targetBranch, track: false });
      return true;
    } else {
      // cloning an existing repository into a linked worktree root directory
      await isogit.clone({
        fs: fs, http: http, dir: dir.toString(), url: repo.url.toString(), singleBranch: singleBranch, noCheckout: noCheckout,
        noTags: noTags, ...optionals
      });
      return true;
    }
  }
  return false;
};

/**
 * Switch branches or restore working tree files. If the `overwrite` option is enabled, this function becomes a wrapper to inject the 
 * `fs` parameter in to the *isomorphic-git/checkout* function. The `overwrite` option enables checking out the target branch into
 * the main worktree root directory and is destructive to any uncommitted changes in the main worktree. If the branch is not found
 * locally, then a new remote tracking branch will be created and set to track the remote branch of that name. This behavior is similar 
 * to canonical *git*, except that uncommitted changes are not brought forward into the newly checked out branch.
 * 
 * When the `overwrite` option is disabled (which is the default behavior), this function utilizes linked worktrees to facilitate
 * checking out the target branch into a separate linked worktree root directory. If the branch is not found locally, then a new linked
 * worktree will be created to hold the new remote tracking branch which is set to track the remote branch of the same name. If the 
 * branch is found locally as a remote tracking branch, then it will be converted to a linked worktree branch and set to track the 
 * remote branch of the same name. If the target branch matches the current branch in the main worktree or a linked worktree, then 
 * this is a no-op operation.
 *
 * @deprecated This implementation uses old-git functions that rely on isomorphic-git, please use {@link gitCheckout.checkoutBranch} instead.
 * @param obj - A destructured object for named parameters.
 * @param obj.dir - The worktree root directory.
 * @param obj.gitdir - The worktree git directory.
 * @param obj.ref - The branch name or SHA-1 commit hash to checkout files from; defaults to `HEAD`.
 * @param obj.overwrite - Optional flag to checkout into the main worktree root directory; defaults to `false`.
 * @param obj.url - The URL associated with a remote-hosted instances of the repository; use empty string if local-only repository.
 * @param obj.filepaths - Limit the checkout to the given files and directories.
 * @param obj.remote - Which remote repository to use for the checkout process; defaults to `origin`.
 * @param obj.noCheckout - Optional flag to update HEAD but not update the working directory; defaults to `false`.
 * @param obj.noUpdateHead - Optional flag to update the working directory but not update HEAD. Defaults to `false` when `ref` is provided, 
 * and `true` if `ref` is not provided.
 * @param obj.dryRun - Optional flag to simulate a checkout in order to test whether it would succeed; defaults to `false`.
 * @param obj.force - Optional flag where conflicts will be ignored and files will be overwritten regardless of local changes.
 * @param obj.track - Optional flag to set the remote branch tracking information; defaults to `true`.
 * @param obj.onProgress - Optional progress event callback.
 * @returns {Promise<void>} A Promise object for the checkout operation.
 */
export const checkout = async ({
  dir, gitdir = path.join(dir.toString(), '.git'), ref = 'HEAD', overwrite = false, url = '', filepaths, remote = 'origin',
  noCheckout = false, noUpdateHead = ref === undefined, dryRun = false, force = false, track = true, onProgress
}: {
  dir: fs.PathLike;
  gitdir?: fs.PathLike;
  ref?: string;
  overwrite?: boolean;
  url?: string;
  filepaths?: string[];
  remote?: string;
  noCheckout?: boolean;
  noUpdateHead?: boolean;
  dryRun?: boolean;
  force?: boolean;
  track?: boolean;
  onProgress?: isogit.ProgressCallback | undefined;
}): Promise<void> => {
  const optionals = removeUndefinedProperties({ filepaths, onProgress });
  if (overwrite) {
    // checkout the target branch into the main worktree; this is destructive to any uncommitted changes in the main worktree
    if (onProgress) await onProgress({ phase: `Checkout target branch into main worktree: ${dir.toString()}`, loaded: 0, total: 1 });
    return isogit.checkout({
      fs: fs, dir: dir.toString(), gitdir: gitdir.toString(), ref: ref, remote: remote, noCheckout: noCheckout,
      noUpdateHead: noUpdateHead, dryRun: dryRun, force: force, track: track, ...optionals
    });
  } else {
    const localBranches = await isogit.listBranches({ fs: fs, dir: dir.toString() });
    if (localBranches.includes(ref)) {
      if (onProgress) await onProgress({ phase: `Removing non-worktree branch ref: '${ref}' in ${dir.toString()}`, loaded: 0, total: 2 });
      const worktrees = await list(dir); // main working tree and any linked worktrees (non-worktree local branches are excluded)
      const existing = worktrees ? worktrees.find(w => w.ref === ref) : undefined;
      if (existing) return undefined; // target branch matches current branch in main worktree or a linked worktree; no-op operation
      const currentCommit = await resolveRef({ dir: dir, ref: ref });
      const remoteCommit = await listServerRefs({ url: url, prefix: `refs/heads/${ref}`, symrefs: true });
      if (remoteCommit[0] && currentCommit !== remoteCommit[0].oid) return undefined; // local-only commits would be permanently destroyed
      // removing non-worktree local branch reference before creating a new linked worktree version
      isogit.deleteBranch({ fs: fs, dir: dir.toString(), ref: ref });
      if (onProgress) await onProgress({ phase: `Removed non-worktree branch ref: '${ref}' in ${dir.toString()}`, loaded: 1, total: 2 });
    }
    // create a new linked worktree set to track a remote branch of the same name, or a local-only branch if there is no remote
    // tracking branch; this is non-destructive to any uncommitted changes in the main worktree
    const repo = io.extractFilename(dir);
    const linkedRoot = path.normalize(`${dir.toString()}/../.syn/${repo}/${ref}`);
    if (onProgress) await onProgress({ phase: `Adding linked-worktree: '${ref}' in ${linkedRoot}`, loaded: 1, total: 2 });
    await add(dir, linkedRoot, ref);
    if (onProgress) await onProgress({ phase: `Added linked-worktree: '${ref}' in ${linkedRoot}`, loaded: 2, total: 2 });
  }
}

/**
 * Create a new commit; this function is a wrapper to inject the `fs` parameter in to the *isomorphic-git/checkout* function.
 *
 * @param obj - A destructured object for named parameters.
 * @param obj.dir - The worktree root directory.
 * @param obj.gitdir - The worktree git directory.
 * @param obj.message - The commit message to use.
 * @param obj.author - The details about the author (i.e. the `name`, `email`, `timestamp`, and `timezoneOffset`); defaults to the
 * config fields in the local git config file, or the global git config file (if no local is set).
 * @param obj.author.name - Default is `user.name` config.
 * @param obj.author.email - Default is `user.email` config.
 * @param obj.author.timestamp - Set the author timestamp field. This is the integer of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param obj.author.timezoneOffset - Set the author timezone offset field. This is the difference, in minutes, from the current timezone to
 * UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param obj.committer The details about the commit committer, in the same format as the `author` parameter. If not specified,
 * the `author` details are used.
 * @param obj.committer.name - Default is `user.name` config.
 * @param obj.committer.email - Default is `user.email` config.
 * @param obj.committer.timestamp - Set the committer timestamp field. This is the integer of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param obj.committer.timezoneOffset - Set the committer timezone offset field. This is the difference, in minutes, from the current timezone to
 * UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param obj.signingKey - Sign the tag object using this private PGP key.
 * @param obj.dryRun - If true, simulates making a commit in order to test whether it would succeed. Implies `noUpdateBranch` be set to true.
 * @param obj.noUpdateBranch - If true, does not update the branch pointer after creating the commit.
 * @param obj.ref - The fully expanded name of the branch to commit to. Default is the current branch pointed to by `HEAD`. Currently has a 
 * limitation in that it cannot expand branch names without throwing if the branch doesn't exist yet.
 * @param obj.parent - The SHA-1 object ids of the commits to use as parents. If not specified, the commit pointed to by `ref` is used.
 * @param obj.tree - The SHA-1 object id of the tree to use. If not specified, a new tree object is created from the current git index.
 * @returns {Promise<string>} A Promise object containing the SHA-1 object id of the newly created commit.
 */
export const commit = async ({ dir, gitdir = path.join(dir.toString(), '.git'), message, author = {
  timestamp: Math.floor(Date.now() / 1000),
  timezoneOffset: (new Date()).getTimezoneOffset()
}, committer = author, signingKey, dryRun = false, noUpdateBranch = false, ref, parent, tree }: {
  dir: fs.PathLike;
  gitdir?: fs.PathLike;
  message: string;
  author?: { name?: string; email?: string; timestamp?: number; timezoneOffset?: number };
  committer?: { name?: string; email?: string; timestamp?: number; timezoneOffset?: number };
  signingKey?: string;
  dryRun?: boolean;
  noUpdateBranch?: boolean;
  ref?: string;
  parent?: Array<string>;
  tree?: string;
}): Promise<string> => {
  const optionals = removeUndefinedProperties({ author, committer, signingKey, ref, parent, tree });
  return isogit.commit({
    fs: fs, dir: dir.toString(), gitdir: gitdir.toString(), message: message, dryRun, noUpdateBranch, ...optionals
  });
}

/**
 * Get the name of the branch currently pointed to by *.git/HEAD*; this function is a wrapper to the *isomorphic-git/currentBranch* 
 * function to inject the `fs` parameter and extend with additional worktree path resolving functionality. If the `gitdir` parameter is a 
 * file, then `.git` points to a file containing updated pathing to translate from the linked worktree to the `.git/worktree` directory in 
 * the main worktree and this path must be used for branch checks.
 *
 * @deprecated This implementation uses old-git functions that rely on isomorphic-git, please use {@link gitBranch.listBranch} instead.
 * @param obj - A destructured object for named parameters.
 * @param obj.dir - The worktree root directory.
 * @param obj.gitdir - The worktree git directory.
 * @param obj.fullname - Boolean option to return the full path (e.g. "refs/heads/master") instead of the abbreviated form; default is false.
 * @param obj.test - Boolean option to return 'undefined' if the current branch doesn't actually exist (such as 'master' right after git init).
 * @returns {Promise<string | void>} A Promise object containing the current branch name, or undefined if the HEAD is detached.
 */
export const currentBranch = async ({ dir, gitdir = path.join(dir.toString(), '.git'), fullname, test }: {
  dir: fs.PathLike;
  gitdir?: fs.PathLike;
  fullname?: boolean;
  test?: boolean;
}): Promise<string | void> => {
  const optionals = removeUndefinedProperties({ fullname, test });
  const worktree = await getWorktreePaths(gitdir);
  return worktree.worktreeLink
    ? isogit.currentBranch({ fs: fs, dir: worktree.worktreeLink.toString(), gitdir: worktree.worktreeLink.toString(), ...optionals })
    : isogit.currentBranch({ fs: fs, dir: dir.toString(), gitdir: gitdir.toString(), ...optionals });
}

/**
 * Get the name of the default branch pointed to by *.git/refs/remotes/origin/HEAD*.
 *
 * @deprecated This implementation uses old-git functions that rely on isomorphic-git, please use {@link gitBranch.listBranch} instead.
 * @param obj - A destructured object for named parameters.
 * @param obj.dir - The worktree root directory.
 * @param obj.gitdir - The worktree git directory.
 * @returns {Promise<string>} A Promise object containing the default branch name, or undefined if no default branch has been set.
 */
export const defaultBranch = async ({ dir, gitdir = path.join(dir.toString(), '.git') }: {
  dir: fs.PathLike;
  gitdir?: fs.PathLike;
}): Promise<string> => {
  return (await io.readFileAsync(path.join(gitdir.toString(), 'refs', 'remotes', 'origin', 'HEAD'), { encoding: 'utf-8' })).slice('ref: refs/remotes/origin/'.length).trim();
};

/**
 * Delete a local branch; this function is a wrapper to inject the `fs` parameter in to the *isomorphic-git/deleteBranch* function.
 *
 * @deprecated This implementation uses old-git functions that rely on isomorphic-git, please use {@link gitBranch.removeBranch} instead.
 * @param obj - A destructured object for named parameters.
 * @param obj.dir - The worktree root directory.
 * @param obj.gitdir - The git directory path.
 * @param obj.ref - The branch name to delete.
 * @returns {Promise<void>} A Promise object for the branch deletion operation; succeeds when filesystem operations are complete.
 */
export const deleteBranch = ({ dir, gitdir = path.join(dir.toString(), '.git'), ref }: {
  dir: fs.PathLike;
  gitdir?: fs.PathLike;
  ref: string;
}): Promise<void> => {
  return isogit.deleteBranch({ fs: fs, dir: dir.toString(), gitdir: gitdir.toString(), ref: ref });
}

/**
 * Get commit descriptions from the git history; this function is a wrapper to inject the `fs` parameter in to the 
 * isomorphic-git/log* function.
 *
 * @deprecated This implementation uses old-git functions that rely on isomorphic-git, please use {@link gitLog.log} instead.
 * @param obj - A destructured object for named parameters.
 * @param obj.dir - The worktree root directory.
 * @param obj.gitdir - The git directory path.
 * @param obj.ref - The commit to begin walking backwards through the history from.
 * @param obj.depth - Limit the number of commits returned. No limit by default.
 * @param obj.since - Return history newer than the given date. Can be combined with `depth` to get whichever is shorter.
 * @returns {Promise<isogit.ReadCommitResult[]>} A Promise object containing an array of `ReadCommitResult` objects 
 * (per https://isomorphic-git.org/docs/en/log).
 */
export const log = async ({ dir, gitdir = path.join(dir.toString(), '.git'), ref = 'HEAD', depth, since }: {
  dir: fs.PathLike;
  gitdir?: fs.PathLike;
  ref?: string;
  depth?: number;
  since?: Date;
}): Promise<isogit.ReadCommitResult[]> => {
  const optionals = removeUndefinedProperties({ since: since });
  const worktree = await getWorktreePaths(gitdir);
  if (!worktree.dir && !worktree.worktreeDir) return []; // linked worktree might have been removed (i.e. prunable)
  return (worktree.dir && worktree.gitdir)
    ? isogit.log({ fs: fs, dir: worktree.dir.toString(), gitdir: worktree.gitdir.toString(), ref: ref, depth: depth, ...optionals })
    : isogit.log({ fs: fs, dir: dir.toString(), ref: ref, depth: depth, ...optionals });
}

/**
 * Merge two branches; this function is a wrapper to inject the fs parameter in to the *isomorphic-git/merge* function. The
 * `dryRun` option additionally checks for `user.name` and `user.email` from git-config, and injects a `missingConfig` return
 * object that indicates whether either git-config field is missing from the local configuration level 
 * (see https://www.atlassian.com/git/tutorials/setting-up-a-repository/git-config).
 *
 * @deprecated This implementation uses old-git functions that rely on isomorphic-git, please use {@link gitMerge.mergeBranch} instead.
 * @param dir The worktree root directory.
 * @param base The base branch to merge delta commits into.
 * @param compare The compare branch to examine for delta commits.
 * @param dryRun Optional parameter for simulating a merge in order to preemptively test for a successful merge. 
 * @returns {Promise<isogit.MergeResult & { missingConfigs?: string[] }>} A Promise object containing the merge results 
 * (per https://isomorphic-git.org/docs/en/merge) and any missing git-config fields (only if fields are missing, undefined otherwise).
 */
export const merge = async (
  dir: fs.PathLike, base: string, compare: string, dryRun = false
): Promise<isogit.MergeResult & { missingConfigs?: string[] }> => {
  const name = { path: 'user.name', value: await isogit.getConfig({ fs: fs, dir: dir.toString(), path: 'user.name' }) };
  const email = { path: 'user.email', value: await isogit.getConfig({ fs: fs, dir: dir.toString(), path: 'user.email' }) };
  const missing: string[] = [name, email].filter(config => !config.value || config.value.length <= 0).map(config => config.path);
  const mergeResult = await isogit.merge({
    fs: fs,
    dir: dir.toString(),
    ours: base,
    theirs: compare,
    dryRun: dryRun,
    author: {
      name: name.value ? name.value : 'Mr. Test',
      email: email.value ? email.value : 'mrtest@example.com',
    }
  });
  const optionals = removeUndefinedProperties({ missingConfigs: missing.length > 0 ? missing : undefined });
  return { ...mergeResult, ...optionals };
}

/**
 * Determines the git tracking status of a specific file or directory path. If the filepath is tracked by a branch in a linked worktree,
 * then status checks will look at the index file in the `GIT_DIR/worktrees/{branch}` directory for determining HEAD, WORKDIR, and STAGE
 * status codes. Status codes are translated into the comparable `GitStatus` type.
 *
 * @deprecated This implementation uses old-git functions that rely on isomorphic-git, please use {@link gitStatus.worktreeStatus} instead.
 * @param filepath - The relative or absolute path to evaluate.
 * @returns {Promise<GitStatus | undefined>} A Promise object containing undefined if the path is not contained within a directory under 
 * version control, or a git status indicator (see `GitStatus` type definition for all possible status values).
 */
export const getStatus = async (filepath: fs.PathLike): Promise<GitStatus | undefined> => {
  if (await io.isDirectory(filepath)) {
    const root = await getRoot(filepath);
    const { worktreeDir } = await getWorktreePaths(filepath);
    if (!root) return undefined; // not under version control

    if (worktreeDir) {
      const statuses = await shimStatusMatrix(filepath);
      const changed = statuses ? statuses.filter(row => row.status !== 'unmodified') : [];
      return (changed.length > 0) ? 'modified' : 'unmodified';
    } else {
      const statuses = await statusMatrix(filepath);
      const changed = statuses ? statuses
        .filter(row => row[1] !== row[2])   // filter for files that have been changed since the last commit
        .map(row => row[0])                 // return the filenames only
        : [];                               // handle the case that `statusMatrix` returned undefined
      return (changed.length > 0) ? 'modified' : 'unmodified';
    }
  }

  return await matrixEntry(filepath);
}

/**
 * Checks the git tracking status of a specific file or directory path for matches against a set of status filters. If the file is
 * tracked by a branch in a linked worktree then status checks will look at the index file in the `GIT_DIR/worktrees/{branch}` directory
 * for determining HEAD, WORKDIR, and STAGE status codes. Status codes are translated into comparable `GitStatus` type before comparison
 * with the provided status filters.
 *
 * @param filepath - The relative or absolute path to evaluate.
 * @param statusFilters - Array of `GitStatus` values to check against.
 * @returns {Promise<boolean>} A Promise object containing false if the path is not contained within a directory under version control, or 
 * a boolean indicating whether any file or files matched at least one of the `GitStatus` values in the provided status filter.
 */
export const hasStatus = async (filepath: fs.PathLike, statusFilters: GitStatus[]): Promise<boolean> => {
  const statuses = await statusMatrix(filepath);
  const found: GitStatus[] = statuses ? statuses
    .map(row => matrixToStatus({ matrixEntry: row }))
    .filter(isDefined)
    .filter(status => statusFilters.includes(status))
    : [];
  return (found.length > 0) ? true : false;
}

/**
 * List a remote servers branches, tags, and capabilities; this function is a wrapper to inject the `http` parameter in to the 
 * isomorphic-git/getRemoteInfo* function.
 *
 * @param obj - A destructured object for named parameters.
 * @param obj.onAuth - Optional auth fill callback.
 * @param obj.onAuthFailure - Optional auth rejection callback.
 * @param obj.onAuthSuccess - Optional auth approved callback.
 * @param obj.url - The URL of the remote repository. Will be retrieved from local `gitconfig` if absent.
 * @param obj.corsProxy - Optional CORS proxy. Overrides value in repo config.
 * @param obj.forPush Optional flag to enable queries for `push` capabilities, otherwise queries are for `fetch` capabilities 
 * only; defaults to `false`.
 * @param obj.headers Additional headers to include in the HTTP requests, similar to the `extraHeader` config in canonical git.
 * @returns {Promise<isogit.GetRemoteInfoResult>} A Promise object containing an object that lists the branches, tags, and capabilities of the remote.
 */
export const getRemoteInfo = ({ onAuth, onAuthFailure, onAuthSuccess, url = '', corsProxy, forPush = false, headers = {} }: {
  onAuth?: isogit.AuthCallback;
  onAuthFailure?: isogit.AuthFailureCallback;
  onAuthSuccess?: isogit.AuthSuccessCallback;
  url?: string;
  corsProxy?: string;
  forPush?: boolean;
  headers?: Record<string, string>;
}): Promise<isogit.GetRemoteInfoResult> => {
  const optionals = removeUndefinedProperties({ onAuth: onAuth, onAuthFailure: onAuthFailure, onAuthSuccess: onAuthSuccess, corsProxy: corsProxy });
  return isogit.getRemoteInfo({
    http: http, url: url, forPush: forPush, headers: headers, ...optionals
  })
};

/**
 * Fetch a list of refs (branches, tags, etc.) from a server; this function is a wrapper to inject the `http` parameter in to the
 * isomorphic-git/listServerRefs* function.
 *
 * @param obj - A destructured object for named parameters.
 * @param obj.onAuth - Optional auth fill callback.
 * @param obj.onAuthFailure - Optional auth rejection callback.
 * @param obj.onAuthSuccess - Optional auth approved callback.
 * @param obj.url - The URL of the remote repository. Will be retrieved from local `gitconfig` if absent.
 * @param obj.corsProxy - Optional CORS proxy. Overrides value in repo config.
 * @param obj.forPush - Optional flag to enable queries for `push` capabilities, otherwise queries are for `fetch` capabilities 
 * only; defaults to `false`.
 * @param obj.headers - Additional headers to include in the HTTP requests, similar to the `extraHeader` config in canonical git.
 * @param obj.protocolVersion - Which version of the Git Protocol to use.
 * @param obj.prefix - Only list refs that start with this prefix.
 * @param obj.symrefs - Optional flag for including symbolic ref targets; defaults to `false`.
 * @param obj.peelTags - Optional flag for including annotated tag peeled targets; defaults to `false`.
 * @returns {Promise<Array<isogit.ServerRef>>} A Promise object containing an array of `ServerRef` objects.
 */
export const listServerRefs = ({ onAuth, onAuthFailure, onAuthSuccess, url = '', corsProxy, forPush = false, headers = {}, protocolVersion = 2,
  prefix, symrefs = false, peelTags = false }: {
    onAuth?: isogit.AuthCallback;
    onAuthFailure?: isogit.AuthFailureCallback;
    onAuthSuccess?: isogit.AuthSuccessCallback;
    url?: string;
    corsProxy?: string;
    forPush?: boolean;
    headers?: Record<string, string>;
    protocolVersion?: 1 | 2;
    prefix?: string;
    symrefs?: boolean;
    peelTags?: boolean;
  }): Promise<Array<isogit.ServerRef>> => {
  const optionals = removeUndefinedProperties({ onAuth: onAuth, onAuthFailure: onAuthFailure, onAuthSuccess: onAuthSuccess, corsProxy: corsProxy, prefix: prefix });
  return isogit.listServerRefs({ http: http, url: url, forPush: forPush, headers: headers, protocolVersion: protocolVersion, symrefs: symrefs, peelTags: peelTags, ...optionals });
};

/**
 * Read an entry from git-config files; modeled after the *isomorphic-git/getConfig* function, but includes additional functionality to resolve global 
 * git-config files. The return object indicates the value for the git config entry and the scope (`local` or `global`) in which the value was located. 
 * If the `local` or `global` parameter are disabled, set to `false`, then the search will not attempt to locate git-config files in that scope. If both
 * parameters are enabled, then `local` scope is searched first and only if there were no matches will the `global` scope then be searched.
 *
 * @param obj - A destructured object for named parameters.
 * @param obj.dir - The working tree directory path.
 * @param obj.gitdir - The git directory path.
 * @param obj.keyPath - The dot notation path of the desired git config entry (i.e. `user.name` or `user.email`).
 * @param obj.local - Allow search in the `local` git-config file (i.e. the `local` scope); defaults to true.
 * @param obj.global - Allow search in the `global` git-config file (i.e. the `global` scope); defaults to true.
 * @param obj.showOrigin - Show the origin path of the git-config file containing the matched entry.
 * @returns {Promise<GitConfig>} A Promise object containing the value and a scope indicating whether the entry was found in the `local` or `global` git-config
 * file, or only a scope of `none` if the value could not be found in any scope.
 */
export const getConfig = async ({ dir, gitdir = path.join(dir.toString(), '.git'), keyPath, local = true, global = true, showOrigin = false }: {
  dir: fs.PathLike,
  gitdir?: fs.PathLike,
  keyPath: string,
  local?: boolean,
  global?: boolean,
  showOrigin?: boolean
}): Promise<GitConfig> => {
  const worktree = await getWorktreePaths(gitdir);
  const localConfigPath = (local && worktree.gitdir) ? path.resolve(path.join(worktree.gitdir.toString(), 'config')) : null;
  const globalConfigPath = (global) ? getGitConfigPath('global') : null;

  const readConfigValue = async (configPath: string | null, key: string) => {
    if (!configPath) return null;
    const configFile = await parse({ path: configPath });
    if (!configFile) return null;
    const config = parse.expandKeys(configFile);
    return hasProperty(config, key) ? getProperty(config, key) as string : null;
  }
  const includeOrigin = (configPath: string | null) => showOrigin ? removeUndefinedProperties({ origin: configPath }) : {};

  const localValue = local ? await readConfigValue(localConfigPath, keyPath) : null;
  const globalValue = global ? await readConfigValue(globalConfigPath, keyPath) : null;

  if (localValue) return { scope: 'local', value: localValue, ...includeOrigin(localConfigPath) };
  if (globalValue) return { scope: 'global', value: globalValue, ...includeOrigin(globalConfigPath) };
  return { scope: 'none' };
};

/**
 * Update an entry in the git-config files; modeled after the *isomorphic-git/setConfig* function, but includes additional functionality
 * to resolve global git-config files. The scope is strictly respected (i.e. if the entry exists only in `global` scope but `local` scope 
 * is specified, then a new entry will be added to the git-config file in `local` scope). Entries can be removed by setting value to
 * `undefined`; attempting to remove a non-existing entry will result in a no-op.
 *
 * @param obj - A destructured object for named parameters.
 * @param obj.dir - The worktree root directory path.
 * @param obj.gitdir - The worktree git file or directory path.
 * @param obj.scope - The scope indicating whether the entry update should occur in the `local` or `global` git-config file. 
 * @param obj.keyPath - The dot notation path of the desired git config entry (i.e. `user.name` or `user.email`).
 * @param obj.value - The value to be added, updated, or removed (by setting `undefined`) from the git-config file.
 * @returns {Promise<string | null>} A Promise object containing a string in ini-format with the contents of the updated git-config file.
 */
export const setConfig = async ({ dir, gitdir = path.join(dir.toString(), '.git'), scope, keyPath, value }: {
  dir: fs.PathLike,
  gitdir?: fs.PathLike,
  scope: 'local' | 'global',
  keyPath: string,
  value: string | boolean | number | undefined
}): Promise<string | null> => {
  const worktree = await getWorktreePaths(gitdir);
  const configPath = (scope == 'local' && worktree.gitdir) ? path.resolve(path.join(worktree.gitdir.toString(), 'config')) : getGitConfigPath('global');
  if (!configPath) return null; // no git-config file exists for the requested scope

  const configFile = await parse({ path: configPath });
  if (!configFile) return null; // git-config file cannot be parsed; possible corrupted file?
  if (value === undefined) deleteProperty(configFile, keyPath);
  else setProperty(configFile, keyPath, value);

  const updatedConfig = ini.stringify(configFile, { section: '', whitespace: true });
  await io.writeFileAsync(configPath, updatedConfig);
  return updatedConfig;
}