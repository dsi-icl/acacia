import * as React from 'react';

export const ExportSection: React.FunctionComponent = props => {
    return (
        <div>
            <h3>Data export</h3>
            <button>
                Download clinical data as csv
            </button>
            <button>
                Download image data
            </button>
        </div>
    );
};