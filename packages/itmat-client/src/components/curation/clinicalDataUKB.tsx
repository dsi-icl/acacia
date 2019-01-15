import * as React from 'react';
import { FilePond, File } from 'react-filepond';
import '!style-loader!css-loader!filepond/dist/filepond.min.css';

// import { Models } from 'itmat-utils';

export const ClinicalDataCurationUKBSection: React.FunctionComponent = props => {
    const [fileInput, setFileInput] = React.useState([]);
    return (
        <div>
            <h4>Curation CSV</h4>
            <label>Select CSV for phenotypic data provided by UK Biobank:</label>

            <FilePond
                allowMultiple={false}
                onupdatefiles={(fileItems: any) => {
                    // Set current file objects to this.state
                    setFileInput(fileItems.map( (fileItem:any) => fileItem.file));
                }}
            >
                    
                    {/* Update current files  */}
                    {fileInput.map(file => (
                        <File key={file} src={file} origin="local" />
                    ))}
            </FilePond>
            <button>Submit</button>
        </div>
    );
}