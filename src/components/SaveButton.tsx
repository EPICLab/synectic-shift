import React, { useContext } from 'react';
import { Save } from '@material-ui/icons';
import type { UUID } from '../types';
import { fileSaveDialog } from '../containers/dialogs';
import { writeFileAsync } from '../containers/io';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addItemInArray, removeItemInArray } from '../store/immutables';
import cardSelectors from '../store/selectors/cards';
import metafileSelectors from '../store/selectors/metafiles';
import { cardUpdated } from '../store/slices/cards';
import { metafileUpdated } from '../store/slices/metafiles';
import { RootState } from '../store/store';
import { fetchVersionControl, isFileMetafile, isVirtualMetafile } from '../store/thunks/metafiles';
import { Mode, useIconButtonStyle } from './StyledIconButton';
import { FSCache } from './Cache/FSCache';
import { IconButton, Tooltip } from '@material-ui/core';

/**
 * Button for saving the content of modified metafiles to their associated files. This button tracks the state of metafiles associated
 * with the list of cards supplied via props. The button is only enabled when at least one associated metafile has content that is
 * diverged from the cache (according to FSCache). Clicking on the button will trigger all modified metafiles to write their content
 * to the associates files. This button operates as the inverse operation to the `UndoButton`.
 * @param cardIds List of Card UUIDs that should be tracked by this button.
 * @param mode Optional theme mode for switching between light and dark themes.
 * @returns 
 */
const SaveButton: React.FunctionComponent<{ cardIds: UUID[], mode?: Mode }> = ({ mode = 'light', cardIds }) => {
    const cards = useAppSelector((state: RootState) => cardSelectors.selectByIds(state, cardIds));
    const metafiles = useAppSelector((state: RootState) => metafileSelectors.selectByIds(state, cards.map(c => c.metafile)));
    const { cache } = useContext(FSCache);
    const modified = metafiles.filter(m => m.path && m.content !== cache.get(m.path));
    const dispatch = useAppDispatch();
    const classes = useIconButtonStyle({ mode: mode });

    const save = async () => {
        await Promise.all(modified
            .filter(isFileMetafile)
            .map(async metafile => {
                await writeFileAsync(metafile.path, metafile.content);
                const vcs = await dispatch(fetchVersionControl(metafile)).unwrap();
                dispatch(metafileUpdated({ ...metafile, ...vcs, state: 'unmodified' }));
            })
        );

        await Promise.all(modified
            .filter(isVirtualMetafile)
            .map(async metafile => {
                await dispatch(fileSaveDialog(metafile)); // will update metafile
            })
        );

        offHover();
    }

    // checks for whether button is on a single card and also captured
    const isCaptured = cards.length == 1 && cards[0].captured !== undefined;

    const onHover = () => {
        if (cards.length > 1) {
            cards.filter(c => modified.find(m => c.metafile === m.id) ? true : false)
                .map(c => dispatch(cardUpdated({ ...c, classes: addItemInArray(c.classes, 'selected') })));
        }
    }

    const offHover = () => {
        cards.map(c => dispatch(cardUpdated({ ...c, classes: removeItemInArray(c.classes, 'selected') })));
    }

    return (
        <>
            {modified.length > 0 && !isCaptured &&
                <Tooltip title='Save'>
                    <IconButton
                        className={classes.root}
                        aria-label='save'
                        onClick={save}
                        onMouseEnter={onHover}
                        onMouseLeave={offHover}
                    >
                        <Save />
                    </IconButton>
                </Tooltip>}
        </>
    );
}

export default SaveButton;