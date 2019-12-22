import { Actions, ActionKeys } from '../actions';
import { Filetype } from '../../types';
import { addItemInMap, removeItemInMap, updateItemInMapById, updateObject } from '../immutables';

export const filetypeReducer = (state: { [id: string]: Filetype } = {}, action: Actions) => {
  switch (action.type) {
    case ActionKeys.ADD_FILETYPE:
      return addItemInMap(state, action.filetype);
    case ActionKeys.REMOVE_FILETYPE:
      return removeItemInMap(state, action.id);
    case ActionKeys.UPDATE_FILETYPE:
      return updateItemInMapById(state, action.id, (filetype => updateObject(filetype, action.filetype)));
    default:
      return state;
  }
}