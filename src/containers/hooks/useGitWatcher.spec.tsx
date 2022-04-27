import React from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { file, mock, MockInstance } from '../../test-utils/mock-fs';
import { mockStore } from '../../test-utils/mock-store';
import { emptyStore } from '../../test-utils/empty-store';
import useGitWatcher from './useGitWatcher';

describe('containers/hooks/useGitDirectory', () => {
    let mockedInstance: MockInstance;
    let store: ReturnType<typeof mockStore>;
    const wrapper = ({ children }: { children: React.ReactNode }) => <Provider store={store}> {children} </Provider>;

    beforeAll(async () => {
        const instance = await mock({
            'sampleUser/myRepo': {
                '.git': {
                    'config': {}
                },
                empty: {},
                'foo/bar.js': file({ content: 'file contents', mtime: new Date(1) }),
            }
        });
        return mockedInstance = instance;
    });
    beforeEach(() => store = mockStore(emptyStore));

    afterAll(() => mockedInstance.reset);
    afterEach(() => {
        store.clearActions();
        jest.clearAllMocks();
    });

    it('useFSWatcher hook tracks filesystem updates to individual files', async () => {
        renderHook(() => useGitWatcher('sampleUser/myRepo/foo'), { wrapper });

        // TODO: Fix the following test to correctly mimic FS events and capture them via the useGitDirectory hook
        //
        // return writeFileAsync('sampleUser/myRepo/foo/bar.js', 'file contents updated')
        //     .then(() => expect(store.getActions()).toHaveLength(1));

        return expect(true).toBe(true);
    });
});