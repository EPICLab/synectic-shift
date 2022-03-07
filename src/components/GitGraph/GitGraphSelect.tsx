import React, { useState, useEffect } from 'react';
import { createStyles, FormControl, makeStyles, MenuItem, Select, Theme, withStyles } from '@material-ui/core';
import InputBase from '@material-ui/core/InputBase';
import { RootState } from '../../store/store';
import { modalAdded, modalRemoved } from '../../store/slices/modals';
import { v4 } from 'uuid';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import repoSelectors from '../../store/selectors/repos';
import { UUID } from '../../store/types';
import { Repository } from '../../store/slices/repos';

const StyledInput = withStyles((theme: Theme) =>
  createStyles({
    input: {
      borderRadius: 4,
      position: 'relative',
      backgroundColor: theme.palette.background.paper,
      border: '1px solid #ced4da',
      fontSize: 14,
      padding: '10px 26px 10px 12px',
      transition: theme.transitions.create(['border-color', 'box-shadow']),
      '&:focus': {
        borderRadius: 4,
        borderColor: '#80bdff',
        boxShadow: '0 0 0 0.2rem rgba(0,123,255,.25)',
      },
    },
  }),
)(InputBase);

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    margin: {
      margin: theme.spacing(1),
    },
    defaultItem: {
      color: 'rgba(125,125,125,1)',
    }
  }),
);

const GitGraphSelect = () => {
  const repos = useAppSelector((state: RootState) => repoSelectors.selectAll(state));
  const [repo, setRepo] = useState<UUID>();
  const [graph, setGraph] = useState<UUID>();
  const dispatch = useAppDispatch();
  const classes = useStyles();

  useEffect(() => {
    clearMap();
  }, [repos]);

  const updateMap = (selected: Repository) => {
    const modal = dispatch(modalAdded({ id: v4(), type: 'GitGraph', target: selected.id })).payload;
    setGraph(modal.id); // track the modal UUID so that we can remove the graph later
    setRepo(selected.id); // update the select menu
  }

  const clearMap = () => {
    if (graph) dispatch(modalRemoved(graph));
    setGraph(undefined);
    setRepo(undefined);
  }

  const repoChange = async (event: React.ChangeEvent<{ value: UUID }>) => {
    const selected = repos.find(r => r.id === event.target.value);
    selected ? updateMap(selected) : clearMap();
  };

  return (
    <div style={{ marginLeft: 'auto' }}>
      <FormControl className={classes.margin}>
        <Select
          labelId='repo-select-label'
          id='repo-select'
          value={repo ? repo : ''}
          displayEmpty
          disabled={repos.length === 0}
          defaultValue=''
          onChange={repoChange}
          input={<StyledInput />}
        >
          <MenuItem key='' value='' className={classes.defaultItem}>{repo ? 'Clear Map' : 'Repository Map'}</MenuItem>
          {repos.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
        </Select>
      </FormControl>
    </div>
  );
}

export default GitGraphSelect;