export const x = 1;// import * as React from 'react';

// import { Query, Mutation } from 'react-apollo';
// import { GET_USERS } from '../../graphql/appUsers';
// import { IUser } from 'itmat-utils/dist/models/user';
// import { Select } from 'antd';
// import css from './genericUserList.module.css';
// import 'antd/lib/select/style/css';
// import '../../css/antdOverride.css';
// import { DocumentNode } from 'graphql';

// export const GenericUserList: React.FunctionComponent<{ 
//         mutationToAddUser: DocumentNode,
//         mutationToDeleteUser: DocumentNode,
//         type?: SECTIONTYPE,
//         listOfUsers: ({ id: string, realName: string, organisation: string, username: string })[],
//         studyName: string,
//         projectName?: string,
//         title?: string,
//         submitButtonString: string
//     }> = ({submitButtonString, title, mutationToAddUser, type, listOfUsers, studyName, projectName, mutationToDeleteUser }) => {

//     const [addUserInput, setAddUserInput]: [string|undefined, Function] = React.useState(undefined);

//     return <div>
//         {
//             listOfUsers.length === 0 ?
//             <span>There is no user added currently.</span> :
//             listOfUsers.map(el => <OneUserOrAdmin key={el.id} user={el} {...{mutationToDeleteUser, application, study}}/>)
//         }
//             <div className={css.addUserSectionWrapper}>
//             <Query query={GET_USERS} variables={{ fetchDetailsAdminOnly: false, fetchAccessPrivileges: false }}>
//                 {({ data, loading: loadingQuery, error}) => {
//                     if (loadingQuery) return (
//                     <>
//                     <div className={css.selectionWrapper}>
//                     <Select
//                         showSearch
//                         getPopupContainer={ev => ev!.parentElement!}
//                         dropdownStyle={{ maxHeight: 250, overflow: 'auto' }}
//                         style={{ width: '100%' }}
//                         value={addUserInput}
//                         onChange={e => { setAddUserInput(e)}}
//                         notFoundContent='Loading users..'
//                     ></Select></div><div className={css.button}>{submitButtonString}</div></>);
//                     if (!data.getUsers) return null;
//                     return (
//                         <>
//                         <div className={css.selectionWrapper}>
//                         <Select
//                             showSearch
//                             getPopupContainer={ev => ev!.parentElement!}
//                             dropdownStyle={{ maxHeight: 250, overflow: 'auto' }}
//                             style={{ width: '100%' }}
//                             value={addUserInput}
//                             onChange={e => { setAddUserInput(e)}}
//                             notFoundContent='No user matches your search'
//                         >
//                         {data.getUsers.map((el: IUser) => <Select.Option key={el.id} value={el.id}>{`${el.realName} (${el.organisation || 'unknown organisation'})`}</Select.Option>)}
//                         </Select>
//                         </div>
//                         <Mutation
//                             mutation={mutationToAddUser}
//                         >
//                         {(addUser, { loading: loadingMutation, error }) => {
//                             const variables: any = { username: addUserInput, study };
//                             if (application !== undefined) variables.application = application;
//                             if (type !== undefined) variables.type = type === SECTIONTYPE.ADMINS ? 'APPLICATION_ADMIN' : 'APPLICATION_USER';
//                             return (
//                                 <>
//                                     { loadingMutation  ? <div className={css.button}>Loading...</div> : 
//                                         <div className={css.button} onClick={e => { addUserInput && addUser({ variables }) && setAddUserInput(undefined); }}>
//                                             {submitButtonString}
//                                         </div> }
//                                 </>
//                             );
//                         }}
//                         </Mutation>
//                         </>
//                     );
//                 }}
//             </Query>
//         </div>
//         </div>;
// };

// const OneUserOrAdmin: React.FunctionComponent<{ mutationToDeleteUser: DocumentNode, user: string, projectName?: string, studyName: string }> = ({ mutationToDeleteUser, user, projectName, studyName }) => {
//     const variables: any = { username: user, studyName };
//     if (application !== undefined) variables.application = application;

//     return (
//         <div className={css.userSpan}>
//             <span>{user}</span>
//             <Mutation
//                 mutation={mutationToDeleteUser}
//             >
//                 {(deleteUserFromList, { loading, error }) => {
//                     return (
//                         <>
//                             { loading  ? <div className={css.deleteButton}>x</div> : 
//                                 <div className={css.deleteButton} onClick={e => { deleteUserFromList({ variables }) }}>
//                                     x
//                                 </div> }
//                         </>
//                     );
//                 }}
//             </Mutation>
//         </div>
//     );
// };

// export enum SECTIONTYPE {
//     ADMINS = 'Application Admins',
//     USERS = 'Application Users'
// }