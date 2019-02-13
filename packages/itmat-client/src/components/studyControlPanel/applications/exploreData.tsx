import * as React from 'react';
import { NavLink } from 'react-router-dom';

export const ExploreData: React.FunctionComponent<{ studyName: string, applicationName: string }> = ({ studyName, applicationName }) => {
    return (
        <div>
            <h3>Explore data</h3>
            <NavLink to={`/queries/${studyName}/${applicationName}`}><button>
                Go to query
            </button></NavLink>
        </div>
    );
};