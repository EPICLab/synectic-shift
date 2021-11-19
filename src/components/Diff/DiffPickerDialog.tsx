import React, { useState } from 'react';
import * as MUI from '@material-ui/core';
import type { UUID, Modal } from '../../types';
import { RootState } from '../../store/store';
import { loadCard } from '../../store/thunks/handlers';
import { modalRemoved } from '../../store/slices/modals';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import cardSelectors from '../../store/selectors/cards';
import { DateTime } from 'luxon';
import { v4 } from 'uuid';
import { fetchMetafile, fetchMetafileById } from '../../store/thunks/metafiles';

const DiffPickerDialog: React.FunctionComponent<Modal> = props => {
  const cards = useAppSelector((state: RootState) => cardSelectors.selectAll(state));
  const dispatch = useAppDispatch();
  const [selectedLeft, setSelectedLeft] = useState<UUID>('');
  const [selectedRight, setSelectedRight] = useState<UUID>('');

  const handleClose = async (canceled: boolean, selected: [UUID, UUID]) => {
    if (canceled || selected[0] === '' || selected[1] === '') return dispatch(modalRemoved(props.id));
    const left = cards.find(c => c.id === selected[0]);
    const right = cards.find(c => c.id === selected[1]);
    if (!left || !right) return dispatch(modalRemoved(props.id));

    const leftMetafile = await dispatch(fetchMetafileById(left.metafile)).unwrap();
    const rightMetafile = await dispatch(fetchMetafileById(right.metafile)).unwrap();
    const diffCardName = `Δ ${leftMetafile?.branch}/${left.name} -> ${rightMetafile?.branch}/${right.name}`;
    const diffMetafile = await dispatch(fetchMetafile({
      virtual: {
        id: v4(),
        modified: DateTime.local().valueOf(),
        name: diffCardName,
        handler: 'Diff',
        targets: [left.id, right.id]
      }
    })).unwrap();
    if (diffMetafile && leftMetafile && rightMetafile) dispatch(loadCard({ metafile: diffMetafile }));
    return dispatch(modalRemoved(props.id));
  };

  return (
    <MUI.Dialog id='picker-dialog' data-testid='diff-picker-dialog' role='dialog' open={true} onClose={() => handleClose(true, ['', ''])}>
      <div className='diff-container'>
        <MUI.DialogTitle id='picker-dialog-title' style={{ gridArea: 'header' }}>Select cards to diff</MUI.DialogTitle>
        <MUI.FormControl id='form-control-left' aria-label='Left Form' style={{ gridArea: 'left', width: 100 }}>
          <MUI.InputLabel htmlFor='diff-card-select-left' id='diff-card-select-left-label'>Left</MUI.InputLabel>
          <MUI.Select id='diff-card-select-left' aria-labelledby='diff-card-select-left-label' value={selectedLeft}
            autoWidth={true} onChange={(e) => setSelectedLeft(e.target.value as UUID)} input={<MUI.Input />}>
            {Object.values(cards).filter(card => card.type === 'Editor').map(card => (
              <MUI.MenuItem key={card.id} value={card.id}>
                {card.name} (uuid: ...{card.id.slice(-5)}, modified {DateTime.fromMillis(card.modified).toRelative()})
              </MUI.MenuItem>
            ))}
          </MUI.Select>
        </MUI.FormControl>
        <img className='diff_icon' />
        <MUI.FormControl id='form-control-right' aria-label='Right Form' style={{ gridArea: 'right', width: 100 }}>
          <MUI.InputLabel htmlFor='dif-card-select-right' id='diff-card-select-right-label'>Right</MUI.InputLabel>
          <MUI.Select labelId='diff-card-select-right' id='diff-card-select-right' value={selectedRight}
            autoWidth={true} onChange={(e) => setSelectedRight(e.target.value as UUID)} input={<MUI.Input />}>
            {Object.values(cards).filter(card => card.type === 'Editor').map(card => (
              <MUI.MenuItem key={card.id} value={card.id}>
                {card.name} (uuid: ...{card.id.slice(-5)}, modified {DateTime.fromMillis(card.modified).toRelative()})
              </MUI.MenuItem>
            ))}
          </MUI.Select>
        </MUI.FormControl>
        <MUI.Button style={{ gridArea: 'footer' }} id='diffpickerdialog-button' variant='contained' color='primary' onClick={() => {
          handleClose(false, [selectedLeft, selectedRight]);
        }}>Run Diff</MUI.Button>
      </div>
    </MUI.Dialog >
  );
}

export default DiffPickerDialog;