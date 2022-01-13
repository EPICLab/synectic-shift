import type { MockInstance } from './__mocks__/mock-fs-promise';
import { mock } from './__mocks__/mock-fs-promise';
import * as isogit from 'isomorphic-git';
import { getBranchRoot, getRoot, getWorktreePaths } from '../src/containers/git-path';

describe('containers/git-path', () => {
    let mockedInstance: MockInstance;
    beforeAll(async () => {
        const instance = await mock({
            '.syn': {
                'bad-branch': {
                    '.git': 'gitdir: foo/.git/worktrees/bad-branch',
                    'delta.txt': 'file contents'
                }
            },
            foo: {
                'add.ts': 'content',
                '.git': {
                    worktrees: {
                        'bad-branch': {
                            gitdir: '.syn/bad-branch/.git'
                        }
                    }
                }
            },
            bar: {
                'beta.ts': 'content',
                '.git': { /* empty directory */ }
            }
        });
        return mockedInstance = instance;
    });

    afterAll(() => mockedInstance.reset());

    it('getRoot resolves to Git root directory on file in tracked directory', async () => {
        expect.assertions(1);
        await expect(getRoot('foo/add.ts')).resolves.toBe('foo');
    });

    it('getRoot resolves to Git root directory on untracked file in tracked directory', async () => {
        expect.assertions(1);
        await mockedInstance.addItem('foo/haze/test.js', 'content');
        await expect(getRoot('foo/haze/test.js')).resolves.toBe('foo');
    });

    it('getBranchRoot resolves `dir` path for branch on main worktree', async () => {
        expect.assertions(1);
        const mockedBranches = new Promise<string[]>(resolve => resolve(['bad-branch', 'main']));
        jest.spyOn(isogit, 'listBranches').mockReturnValue(mockedBranches);
        await expect(getBranchRoot('foo', 'main')).resolves.toEqual('foo');
    });

    it('getBranchRoot resolves `worktreeDir` path for branch on linked worktree', async () => {
        expect.assertions(1);
        const mockedBranches = new Promise<string[]>(resolve => resolve(['bad-branch', 'main']));
        jest.spyOn(isogit, 'listBranches').mockReturnValue(mockedBranches);
        await expect(getBranchRoot('foo', 'bad-branch')).resolves.toEqual('.syn/bad-branch');
    });

    it('getWorktreePaths resolves path to main worktree file', async () => {
        expect.assertions(1);
        await expect(getWorktreePaths('foo/add.ts')).resolves.toEqual(
            expect.objectContaining({
                dir: 'foo',
                gitdir: 'foo/.git',
                worktrees: 'foo/.git/worktrees',
                worktreeDir: undefined,
                worktreeGitdir: undefined,
                worktreeLink: undefined
            })
        );
    });

    it('getWorktreePaths resolves path in repo without linked worktrees', async () => {
        expect.assertions(1);
        await expect(getWorktreePaths('bar/beta.ts')).resolves.toEqual(
            expect.objectContaining({
                dir: 'bar',
                gitdir: 'bar/.git',
                worktrees: undefined,
                worktreeDir: undefined,
                worktreeGitdir: undefined,
                worktreeLink: undefined
            })
        );
    });

    it('getWorktreePaths resolves path to linked worktree file', async () => {
        expect.assertions(1);
        await expect(getWorktreePaths('.syn/bad-branch/delta.txt')).resolves.toEqual(
            expect.objectContaining({
                dir: 'foo',
                gitdir: 'foo/.git',
                worktrees: 'foo/.git/worktrees',
                worktreeDir: '.syn/bad-branch',
                worktreeGitdir: '.syn/bad-branch/.git',
                worktreeLink: 'foo/.git/worktrees/bad-branch'
            })
        );
    });

    it('getWorktreePaths resolves path in the GIT_DIR/worktrees directory', async () => {
        expect.assertions(1);
        await expect(getWorktreePaths('foo/.git/worktrees/bad-branch')).resolves.toEqual(
            expect.objectContaining({
                dir: 'foo',
                gitdir: 'foo/.git',
                worktrees: 'foo/.git/worktrees',
                worktreeDir: '.syn/bad-branch',
                worktreeGitdir: '.syn/bad-branch/.git',
                worktreeLink: 'foo/.git/worktrees/bad-branch'
            })
        );
    });
})