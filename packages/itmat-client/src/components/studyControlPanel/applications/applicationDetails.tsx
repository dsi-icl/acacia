import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_APPLICATION, ADD_USER_TO_APPLICATION, DELETE_USER_FROM_APPLICATION, DELETE_APPLICATION } from '../../../graphql/studyDetails';
import { IApplication, IPendingApproval, APPLICATION_USER_TYPE } from 'itmat-utils/dist/models/study';
import { GenericUserList, SECTIONTYPE } from '../genericUserList';
import { AddOrDeleteShortCut } from '../addShortCut';

export const ApplicationDetails: React.FunctionComponent<{ studyName: string, applicationName: string }> = ({ studyName, applicationName }) => {
    const [applicationDeleted, setApplicationDeleted] = React.useState(false);
    const [currentStudyName, setCurrentStudyName] = React.useState(studyName);
    const [currentApplicationName, setCurrentApplicationName] = React.useState(applicationName);
    console.log(studyName, currentStudyName);

    if (applicationName !== currentApplicationName || studyName !== currentStudyName) {
        setApplicationDeleted(false);
        setCurrentApplicationName(applicationName);
        setCurrentStudyName(studyName);
    }

    if (applicationDeleted) return <>{`Application "${applicationName}" of study "${studyName}" has been successfully deleted.`}</>;

    return (
        <Query
            query={GET_APPLICATION}
            variables={{ name: studyName }}
        >
        {({loading, error, data }) => {
            if (loading) return <p>Loading...</p>;
            if (error) return <p>Error :( {error}</p>;
            if (data === undefined || data.getStudies === undefined || data.getStudies.length !== 1) {
                return `Cannot find study "${studyName}".`;
            }
            const application: IApplication[] = data.getStudies[0].applications.filter((el: IApplication) => el.name === applicationName);

            if (application.length !== 1) {
                return `Cannot find application "${applicationName}" of study "${studyName}".`;
            }

            return <>
                <h1>{applicationName}</h1>
                <GenericUserList mutationToDeleteUser={DELETE_USER_FROM_APPLICATION} mutationToAddUser={ADD_USER_TO_APPLICATION} type={SECTIONTYPE.ADMINS} listOfUsers={application[0] ? application[0].applicationAdmins : []} {...{applicationName, studyName}} submitButtonString='add user to admins'/>
                <GenericUserList mutationToDeleteUser={DELETE_USER_FROM_APPLICATION} mutationToAddUser={ADD_USER_TO_APPLICATION} type={SECTIONTYPE.USERS} listOfUsers={application[0] ? application[0].applicationUsers : []} {...{applicationName, studyName}} submitButtonString='add user'/>                
                <PendingUserApprovalsSection listOfPendingApprovals={application[0] ? application[0].pendingUserApprovals : []} {...{applicationName, studyName}}/>
                Approved fields: {application[0].approvedFields.map(el => <span key={`User_${el}`}>{el}</span>)}
                <button>Export CSV</button>
                <AddOrDeleteShortCut {...{applicationName, studyName}}/>
                <DeleteApplicationSection {...{studyName, applicationName, setApplicationDeleted}}/>
            </>;

        }}
        </Query>
    );
};

const PendingUserApprovalsSection: React.FunctionComponent<{listOfPendingApprovals: IPendingApproval[], studyName: string, applicationName: string }> = ({ listOfPendingApprovals, studyName, applicationName }) => {
    return (
        <div>
        <h3>Pending approvals</h3>
        {listOfPendingApprovals.map(el => <OnePendingApproval key={el.user} pendingApproval={el} {...{applicationName, studyName}}/>)}
        </div>
    );
};

const OnePendingApproval: React.FunctionComponent<{ pendingApproval: IPendingApproval, studyName: string, applicationName: string }> = ({ pendingApproval, studyName: study, applicationName: application }) => {
    const [typeInput, setTypeInput] = React.useState(pendingApproval.type);

    return (
        <div>
            <span>{pendingApproval.user}</span>
            <select value={typeInput} onChange={e => { setTypeInput(e.target.value as any);}}>
                <option value={APPLICATION_USER_TYPE.applicationAdmin}>admin</option>
                <option value={APPLICATION_USER_TYPE.applicationUser}>user</option>
            </select>
            <Mutation
                mutation={ADD_USER_TO_APPLICATION}
            >
                {(addUserToApplication, { loading: loadingMutation, error }) => {
                    return ( loadingMutation  ? 
                        <span style={{ cursor: 'pointer'}}>YES</span> : 
                        <span style={{ cursor: 'pointer'}} onClick={e => { addUserToApplication({ variables: { username: pendingApproval.user, study, application, type: typeInput }}) }}>
                            YES
                        </span>
                    );
                }}
            </Mutation>
            <span>NO</span>
        </div>
    );
};


const DeleteApplicationSection: React.FunctionComponent<{ studyName: string, applicationName: string, setApplicationDeleted: Function }> = ({ setApplicationDeleted, studyName, applicationName }) => {
    const [showDeleteButton, setShowDeleteButton] = React.useState(false);

    return (
        <div>
        <h3>Delete this application</h3>
        
        <span onClick={() => setShowDeleteButton(!showDeleteButton)}>Click here</span>

        { showDeleteButton ? 
            <Mutation mutation={DELETE_APPLICATION}>
                {(deleteApplication, { loading, error }) => {
                    return ( 
                        <>
                        {
                        loading  ? 
                        <span style={{ cursor: 'pointer'}}>{`Delete ${applicationName}`}</span> : 
                        <span style={{ cursor: 'pointer'}} onClick={e => { deleteApplication({ variables: { study: studyName, application: applicationName }}) && setApplicationDeleted(true); }}>
                            {`Delete ${applicationName}`}
                        </span>}
                        <span onClick={() => { setShowDeleteButton(false); }}>Cancel</span>
                        </>
                    );
                }}
            </Mutation> : null}
        </div>
    );
};