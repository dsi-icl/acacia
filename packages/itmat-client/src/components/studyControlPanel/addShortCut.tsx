import * as React from 'react';

export const AddShortCut: React.FunctionComponent = props => {
    return (
        <div>
            <h3>Add Short Cut</h3>
            <p>You can add a shortcut button to this study to the menubar by clicking here:</p>
            <button>
                Add shortcut button to menu
            </button>
        </div>
    );
};