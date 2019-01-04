import { Models } from 'itmat-utils';
import * as React from 'react';
import { Query } from "react-apollo";
import { GET_STUDIES } from '../graphql/study';
import * as css from '../css/leftPanel.css';

export const StudySection: React.FunctionComponent = props => 
    <div className={css.leftPanel}>
        <div className={css.title}>STUDIES</div>
        <div className={css.contentContainer}>
            <Query query={GET_STUDIES}>
                {({loading, error, data }) => {
                    console.log('rendering', loading, error, data);
                    if (loading) return <p>Loading...</p>;
                    if (error) return <p>Error :( {error}</p>;
                    if (data.getStudies !== null && data.getStudies !== undefined) return <>{data.getStudies.map((study: Models.Study.IStudy) => <Study key={study.name} data={study}/>)}</>;
                    return <p>Cannot find any study.</p>
                }}
            </Query>
        </div>
    </div>;

const Study: React.FunctionComponent<{ data: Models.Study.IStudy }> = props => {
    const { name, studyAndDataManagers, applications, createdBy } = props.data;
    return (
        <div>
            <h3>{name}</h3>
            <p>Data managers:</p>{studyAndDataManagers.map(el => <div key={el}>{el}</div>)}
            <p>Created by: {createdBy} </p>
            <p>Applications:</p> {applications.map(el => <Application key={el.name} data={el}/>)}
        </div>
    );
};

export const Application: React.FunctionComponent<{ data: Models.Study.IApplication }> = props => {
    const { name, pendingUserApprovals, applicationAdmins, applicationUsers, approvedFields } = props.data;
    const [detailsShown, setDetailsShown] = React.useState(false);
    return (
        <div>
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