import React from 'react';
// eslint-disable-next-line import/named
import { useDrop, XYCoord } from 'react-dnd';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '@material-ui/core';

import { RootState } from '../store/root';
import { Canvas } from '../types';
import { ActionKeys } from '../store/actions';
import NewCardButton from './NewCardDialog';
import FilePickerButton from './FilePickerDialog';
import { BrowserButton } from './Browser';
import DiffPickerButton from './DiffPickerDialog';
import CardComponent from './CardComponent';
import StackComponent from './StackComponent';
import { loadStack } from '../containers/handlers';
import ErrorDialog from './ErrorDialog';
import VersionStatusButton from './RepoBranchList';
import MergeButton from './MergeDialog';
import GitInfoButton from './GitInfoDialog';
import { GitGraphButton } from './GitGraphButton';

const CanvasComponent: React.FunctionComponent<Canvas> = props => {
  const cards = useSelector((state: RootState) => state.cards);
  const stacks = useSelector((state: RootState) => state.stacks);
  const metafiles = useSelector((state: RootState) => Object.values(state.metafiles));
  const filetypes = useSelector((state: RootState) => Object.values(state.filetypes));
  const repos = useSelector((state: RootState) => Object.values(state.repos));
  const errors = useSelector((state: RootState) => Object.values(state.errors));
  const dispatch = useDispatch();

  const [, drop] = useDrop({
    accept: ['CARD', 'STACK'],
    collect: monitor => ({
      isOver: !!monitor.isOver(),
      canDrop: !!monitor.canDrop()
    }),
    drop: (item, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset() as XYCoord;
      switch (item.type) {
        case 'CARD': {
          const card = cards[monitor.getItem().id];
          dispatch({
            type: ActionKeys.UPDATE_CARD,
            id: card.id,
            card: { ...card, left: Math.round(card.left + delta.x), top: Math.round(card.top + delta.y) }
          });
          break;
        }
        case 'STACK': {
          const stack = stacks[monitor.getItem().id];
          dispatch({
            type: ActionKeys.UPDATE_STACK,
            id: stack.id,
            stack: { ...stack, left: Math.round(stack.left + delta.x), top: Math.round(stack.top + delta.y) }
          });
          break;
        }
        default: {
          console.log('useDrop Error: default option, no item.type found');
          break;
        }
      }
    }
  });

  const createStack = () => {
    const cardsList = Object.values(cards);
    const actions = loadStack('test', [cardsList[0], cardsList[1]], 'go get some testing');
    actions.map(action => dispatch(action));
  }

  const showState = () => {
    const allCards = Object.values(cards);
    console.log(`CARDS: ${allCards.length}`)
    allCards.map(c => console.log(`name: ${c.name}, type: ${c.type}, metafile: ${c.metafile}`));
    console.log(`METAFILES: ${metafiles.length}`);
    metafiles.map(m => console.log(`id: ${m.id}, name: ${m.name}, path: ${m.path}, branch: ${m.branch}, contains: ${m.contains
      ? JSON.stringify(m.contains) : ''}, content: ${m.content ? m.content : ''}, targets: ${m.targets ? JSON.stringify(m.targets) : ''}`));
    console.log(`REPOS: ${repos.length}`);
    repos.map(r =>
      console.log(`name: ${r.name}, path: ${r.url.href}, local: ${JSON.stringify(r.local)}, remote: ${JSON.stringify(r.remote)}`));
    console.log(`FILETYPES: ${filetypes.length}`);
    // filetypes.map(f => console.log(`filetype: ${f.filetype}, handler: ${f.handler.toString()}, extensions: ${f.extensions}`));
    console.log(`ERRORS: ${errors.length}`);
    console.log(JSON.stringify(errors));
  }

  return (
    <div className='canvas' ref={drop}>
      <GitInfoButton />
      <NewCardButton />
      <FilePickerButton />
      <BrowserButton />
      <VersionStatusButton />
      <Button id='state-button' variant='contained' color='primary' onClick={showState}>Show...</Button>
      <MergeButton />
      <DiffPickerButton />
      <Button id='stack-button' variant='contained' color='primary' disabled={Object.values(cards).length < 2}
        onClick={createStack}>Stack...</Button>
      <GitGraphButton />
      {Object.values(stacks).map(stack => <StackComponent key={stack.id} {...stack} />)}
      {Object.values(cards).filter(card => !card.captured).map(card => <CardComponent key={card.id} {...card} />)}
      {errors.map(error => <ErrorDialog key={error.id} {...error} />)}
      {props.children}
    </div >
  );
}

export default CanvasComponent;