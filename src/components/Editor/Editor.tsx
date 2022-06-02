import React, { useState, useEffect } from 'react';
import 'ace-builds';
import AceEditor from 'react-ace';
/* webpack-resolver incorrectly resolves basePath for file-loader unless at least one mode has already been loaded, 
thus the following javascript mode file is loaded to fix this bug */
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/ext-searchbox';
import 'ace-builds/src-noconflict/ext-beautify';
import 'ace-builds/webpack-resolver'; // resolver for dynamically loading modes, requires webpack file-loader module
import metafileSelectors from '../../store/selectors/metafiles';
import { metafileUpdated } from '../../store/slices/metafiles';
import { getRandomInt, isDefined, removeUndefinedProperties } from '../../containers/utils';
import { RootState } from '../../store/store';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { UUID } from '../../store/types';
import { isHydrated } from '../../store/thunks/metafiles';
import { Skeleton } from '@material-ui/lab';
import cardSelectors from '../../store/selectors/cards';

const Editor = (props: { metafile: UUID }) => {
  const metafile = useAppSelector((state: RootState) => metafileSelectors.selectById(state, props.metafile));
  const card = useAppSelector((state: RootState) => cardSelectors.selectByMetafile(state, props.metafile))[0];
  const loaded = isDefined(metafile) && isHydrated(metafile);
  const [code, setCode] = useState(metafile && metafile.content ? metafile.content : '');
  const [editorRef] = useState(React.createRef<AceEditor>());
  const [random] = useState(getRandomInt(55, 90));
  const mode = removeUndefinedProperties({ mode: metafile?.filetype?.toLowerCase() });
  const dispatch = useAppDispatch();

  useEffect(() => (metafile && metafile.content) ? setCode(metafile.content) : undefined, [metafile]);
  useEffect(() => editorRef.current?.editor.resize(), [editorRef, card.expanded]);

  const onChange = async (newCode: string | undefined) => {
    setCode(newCode ? newCode : '');
    if (metafile) {
      if (newCode !== metafile.content) dispatch(metafileUpdated({ ...metafile, content: newCode ? newCode : '', state: 'modified' }));
      else dispatch(metafileUpdated({ ...metafile, content: newCode ? newCode : '', state: 'unmodified' }));
    }
  };

  return (
    <>
      {loaded ?
        <AceEditor {...mode} theme='monokai' onChange={onChange} name={props.metafile + '-editor'} value={code}
          ref={editorRef} className='editor' height='100%' width='100%' showGutter={card.expanded} focus={false}
          setOptions={{ useWorker: false, hScrollBarAlwaysVisible: false, vScrollBarAlwaysVisible: false }} />
        : <Skeleton variant='text' aria-label='loading' width={`${random}%`} />}
    </>
  );
}

export default Editor;