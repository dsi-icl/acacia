import * as React from 'react';
import { NavLink } from 'react-router-dom';

export const CurationSection: React.FunctionComponent<{ studyName: string }> = ({ studyName }) => {
    return (
        <div>
            <h3>Curation</h3>
            <button>
                Manually trigger update UKB field dictionary
            </button>
            <NavLink to={`/studies/details/${studyName}/curation/uploadData`}><button>
                Upload / update study clinical data
            </button></NavLink>
            <button>
                Upload / update patient image data
            </button>
        </div>
    );
};