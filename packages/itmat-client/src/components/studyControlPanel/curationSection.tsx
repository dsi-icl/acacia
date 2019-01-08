import * as React from 'react';

export const CurationSection: React.FunctionComponent = props => {
    return (
        <div>
            <h3>Curation</h3>
            <button>
                Manually trigger update UKB field dictionary
            </button>
            <button>
                Upload / update study clinical data
            </button>
            <button>
                Upload / update patient image data
            </button>
        </div>
    );
};