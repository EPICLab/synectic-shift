// Type definitions for synectic 2.0.0
// Project: https://github.com/EPICLab/synectic
// Definitions by: Nicholas Nelson <https://github.com/nelsonni>
// TypeScript Version: 4.5

import { DateTime } from 'luxon';
// import { PathLike } from 'fs-extra';
import { v4 } from 'uuid';
import sha1 from 'sha1';
// import { ReadCommitResult } from 'isomorphic-git';

/** Universal unique identifier based on RFC4122 version 4 for cryptographically-strong random values. */
export type UUID = ReturnType<typeof v4>;
/** 160-bit hash value for identify revisions in Git and other VCS. */
export type SHA1 = ReturnType<typeof sha1>;
/** Epoch millisecond representation of a valid DateTime value. */
export type Timestamp = ReturnType<DateTime['valueOf']>;
/**
 * | status                | description                                                                           |
 * | --------------------- | ------------------------------------------------------------------------------------- |
 * | `"ignored"`           | file ignored by a .gitignore rule                                                     |
 * | `"unmodified"`        | file unchanged from HEAD commit                                                       |
 * | `"*modified"`         | file has modifications, not yet staged                                                |
 * | `"*deleted"`          | file has been removed, but the removal is not yet staged                              |
 * | `"*added"`            | file is untracked, not yet staged                                                     |
 * | `"absent"`            | file not present in HEAD commit, staging area, or working dir                         |
 * | `"modified"`          | file has modifications, staged                                                        |
 * | `"deleted"`           | file has been removed, staged                                                         |
 * | `"added"`             | previously untracked file, staged                                                     |
 * | `"*unmodified"`       | working dir and HEAD commit match, but index differs                                  |
 * | `"*absent"`           | file not present in working dir or HEAD commit, but present in the index              |
 * | `"*undeleted"`        | file was deleted from the index, but is still in the working dir                      |
 * | `"*undeletemodified"` | file was deleted from the index, but is present with modifications in the working dir |
*/
export type GitStatus = 'modified' | 'ignored' | 'unmodified' | '*modified' | '*deleted' | '*added'
    | 'absent' | 'deleted' | 'added' | '*unmodified' | '*absent' | '*undeleted' | '*undeletemodified';
/**
 * | status                | description                                                                           |
 * | --------------------- | ------------------------------------------------------------------------------------- |
 * | `"unmodified"`        | file unchanged from metafile content                                                  |
 * | `"modified"`          | file has modifications, not yet saved                                                 |
 * | `"unlinked"`          | no file linked to metafile, virtual metafile                                          |
 */
export type FilesystemStatus = 'modified' | 'unmodified' | 'unlinked';

export type CardType = 'Loading' | 'Editor' | 'Diff' | 'Explorer' | 'Browser' | 'BranchTracker' | 'Merge' | 'SourceControl' | 'ConflictManager';
export type ModalType = 'BranchList' | 'CloneSelector' | 'DiffPicker' | 'Error' | 'GitGraph' | 'MergeSelector' | 'NewCardDialog' | 'SourcePicker' | 'CommitDialog' | 'Notification';