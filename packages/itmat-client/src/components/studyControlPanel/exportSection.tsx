import * as React from 'react';

export const ExportSection: React.FunctionComponent = props => {
    return (
        <div>
            <h4>Data export</h4>
            <button>
                Download clinical data as csv
            </button>
            <button>
                Download image data
            </button>
        </div>
    );
};