// import * as React from 'react';
// import { Query, Mutation } from 'react-apollo';
// import { GET_APPLICATION, DELETE_USER_FROM_APPLICATION } from '../../../graphql/studyDetails';
// import { GET_USERS_LIST } from '../../../graphql/appUsers';
// import { IApplication } from 'itmat-utils/dist/models/study';
// import { IUser } from 'itmat-utils/dist/models/user';

import * as React from 'react';
import { Query } from 'react-apollo';
import { GET_APPLICATION } from '../../../graphql/studyDetails';
import { IApplication } from 'itmat-utils/dist/models/study';

export const ApplicationDetails: React.FunctionComponent<{ studyName: string, applicationName: string }> = ({ studyName, applicationName }) => {
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
                <h4>{applicationName}</h4>
                {/* <AdminsSection adminList={application[0].applicationAdmins} studyName={studyName} applicationName={applicationName}/>
                <UsersSection userList={application[0].applicationUsers} studyName={studyName} applicationName={applicationName}/> */}
                Pending approvals: {application[0].pendingUserApprovals.map(el => <span key={`User_${el.user}_${el.type}`}>{el.user} | {el.type} </span>)} <br/>
                Approved fields: {application[0].approvedFields.map(el => <span key={`User_${el}`}>{el}</span>)}
            </>;

        }}
        </Query>
    );
};

// const UsersSection: React.FunctionComponent<{ userList: string[], studyName: string, applicationName: string }> = ({ userList, studyName, applicationName }) => {
//     return (
//         <>
//         <h3>Application users</h3>
//         {userList.map(el => <OneUserOrAdmin key={`User_${el}`} applicationName={applicationName} username={el} studyName={studyName}/>)}
//         </>
//     );
// };

// const AdminsSection: React.FunctionComponent<{ adminList: string[], studyName: string, applicationName: string }> = ({ adminList, studyName, applicationName }) => {
//     return (
//         <>
//         <h3>Application admins</h3>
//         {adminList.map(el => <OneUserOrAdmin key={`Admin_${el}`} applicationName={applicationName} username={el} studyName={studyName}/>)}

//         </>
//     );
// };

// const AddUserSection: React.FunctionComponent<{ type: USER_TYPE }> = ({ type }) => {
//     <Query
//         query={GET_USERS_LIST}
//     >
//     {({loading, error, data }) => {
//         if (loading) return <p>Loading...</p>;
//         if (error) return <p>Error :( {error}</p>;
//         return data.getStudies.map((el: Models.Study.IStudy) => <StudyButton key={el.name} data={el}/>);
//     }}
//     </Query>
// };

// const AddUserInput: React.FunctionComponent<{ availableUsers: IUser[]}> = ({ availableUsers }) => {
//     const [nameInput, setNameInput] = React.useState('');
    
//     return (
//         <input value={nameInput}/>
//     );
// };

// const OneUserOrAdmin: React.FunctionComponent<{ username: string, studyName: string, applicationName: string }> = ({ username, applicationName, studyName }) => {
//     return (
//         <Mutation
//             mutation={DELETE_USER_FROM_APPLICATION}
//             // TO_DO: update store
//         >
//         {(deleteUseFromApplication, { loading, error, data }) => {
//                 if (data && data.deleteUserFromApplication && data.deleteUserFromApplication.successful) { return null; }

//                 return (
//                     <>
//                         <span><b>{username}</b>{ loading ? 'remove' : <span onClick={() => { deleteUseFromApplication({ variables: { username, study: studyName, application: applicationName }})}}>remove</span> }</span><br/><br/>
//                     </>
//                 );
//         }}
//         </Mutation>
        
//     );
// };

// const enum USER_TYPE {
//     admin = 'admin',
//     user = 'user'
// }