import * as React from 'react';
import { FilePond, File } from 'react-filepond';
import '!style-loader!css-loader!filepond/dist/filepond.min.css';

// import { Models } from 'itmat-utils';

export const ClinicalDataCurationUKBSection: React.FunctionComponent<{ studyName: string }> = ({ studyName }) => {
    const [fileInput, setFileInput] = React.useState([]);

    return (
        <div>
            <h4>Curation CSV</h4>
            <label>Select CSV for phenotypic data provided by UK Biobank:</label>

            <FilePond
                allowMultiple={false}
                instantUpload={false}
                server={{
                    timeout: 7000,
                    process: (fieldName: any, file: any, metadata: any, load: any, error: any, progress: any, abort: any) => {
                        const formData = new FormData();
                        formData.append('study', studyName);
                        formData.append('jobType', 'UKB_CSV_UPLOAD');
                        formData.append('file', file, file.name);
                        fetch('http://localhost:3003/file', 
                            {
                                method: 'POST',
                                body: formData,
                                credentials: 'include'
                            }
                        ).then(
                            res => {
                                if (res.status === 200) {
                                    load('fdsaf');
                                } else {
                                    error('ohhhhh')
                                }
                            }
                        );
                    }
                }}
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
        </div>
    );
}