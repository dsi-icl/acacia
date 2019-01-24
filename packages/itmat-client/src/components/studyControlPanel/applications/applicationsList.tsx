import { Models } from 'itmat-utils';
import * as React from 'react';
import { NavLink } from 'react-router-dom';

export const ApplicationListSection: React.FunctionComponent<{ studyName: string, list: Models.Study.IApplication[]}> = ({list, studyName}) => {
    // const [addNewApplicationShown, setAddNewApplicationShown] = React.useState(false);
    return (
        <div>
            <h3>Applications</h3>
            {list.map(el => <Application key={el.name} name={el.name} studyName={studyName}/>)}
            <NavLink to={`/studies/details/${studyName}/application/addNewApplication`}><span> Add new application </span></NavLink>
        </div>
    );
};


const Application: React.FunctionComponent<{ name: string, studyName: string }> = ({ name, studyName }) => {
    return (
        <div>
            <p>{name}</p> <br/>
            <NavLink to={`/studies/details/${studyName}/application/${name}`}><span>'Show more'</span></NavLink>
        </div>
    );
};
