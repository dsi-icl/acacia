import React from 'react';
import * as css from './tabContent.module.css';

export const UploadNewFields: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const [expanded, setExpanded] = React.useState(false);
    const [uploadFileTabSelected, setUploadFileTabSelected] = React.useState(true);

    if (!expanded) {
        return <button onClick={() => setExpanded(true)}>Upload new annotations</button>
    }

    return <>
        <div className={css.add_new_fields_section}>
            <p>Please note that you will need to upload an entire set of annotations and not just the delta.</p>
            <p>You can either upload a new annotation files or select one previously uploaded file:</p>
            <h5 onClick={() => setUploadFileTabSelected(true)} className={uploadFileTabSelected ? css.selected_tab : ''}>Upload a new file</h5><h5 onClick={() => setUploadFileTabSelected(false)} className={!uploadFileTabSelected ? css.selected_tab : ''}>Select from existing file</h5>
            {
                uploadFileTabSelected ? 
                <>
                    <br/>
                    <input type='file'/>
                    <button>Upload</button><button onClick={() => setExpanded(false)} className='button_grey'>Cancel</button>
                </>
                :
                <>
                    <button>Upload</button><button onClick={() => setExpanded(false)} className='button_grey'>Cancel</button>
                </>
            }

        </div>
    </>;
};