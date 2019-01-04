import { Models } from 'itmat-utils';
import * as React from 'react';

export const StudySection: React.FunctionComponent<{ data: Models.Study.IStudy[] }> = props => 
    <div className='studySection'>
        <div>Studies</div>
        {props.data.map(study => <Study data={study}/>)}
    </div>;

const Study: React.FunctionComponent<{ data: Models.Study.IStudy }> = props => {
    const { name, studyAndDataManagers, applications, createdBy } = props.data;
    return (
        <div className='study'>
            <div>{name}</div>
            <p>Data managers: {studyAndDataManagers.map(el => <div key={el}>{el}</div>)}</p>
            <p>Created by: {createdBy} </p>
            <p>Applications: {applications.map(el => <Application key={el.name} data={el}/>)}</p>
        </div>
    );
};

const Application: React.FunctionComponent<{ data: Models.Study.IApplication }> = props => {
    const { name, pendingUserApprovals, applicationAdmins, applicationUsers, approvedFields } = props.data;
    const [detailsShown, setDetailsShown] = React.useState(false);
    return (
        <div className='application'>
            <p>{name}</p> <button onClick={() => setDetailsShown(!detailsShown)}>+</button>
            { detailsShown ?
            <>
                Admins: {applicationAdmins.map(el => <span key={`Admin_${el}`}>{el}</span>)} <br/>
                Users: {applicationUsers.map(el => <span key={`User_${el}`}>{el}</span>)} <br/>
                Pending approvals: {pendingUserApprovals.map(el => <span key={`User_${el.user}_${el.type}`}>{el.user} | {el.type} </span>)} <br/>
                Approved fields: {approvedFields.map(el => <span key={`User_${el}`}>{el}</span>)}

            </> : null }
        </div>
    );
};