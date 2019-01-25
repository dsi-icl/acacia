import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { GET_USERS_LIST_ONLY_USERNAME } from '../../graphql/appUsers';
import { IUser } from 'itmat-utils/dist/models/user';
import { Select } from 'antd';
import 'antd/lib/select/style/css';
import { DocumentNode } from 'graphql';

export const GenericUserList: React.FunctionComponent<{ 
        mutationToAddUser: DocumentNode,
        mutationToDeleteUser: DocumentNode,
        type?: SECTIONTYPE,
        listOfUsers: string[],
        studyName: string,
        applicationName?: string,
        title?: string,
        submitButtonString: string
    }> = ({submitButtonString, title, mutationToAddUser, type, listOfUsers, studyName: study, applicationName: application, mutationToDeleteUser }) => {

    const [addUserInput, setAddUserInput]: [string|undefined, Function] = React.useState(undefined);

    return <>
        <h3>{title ? title : type}</h3>
        {listOfUsers.map(el => <OneUserOrAdmin key={el} user={el} {...{mutationToDeleteUser, application, study}}/>)}
        <div style={{ position: 'relative' }}>
            <Query query={GET_USERS_LIST_ONLY_USERNAME}>
                {({ data, loading: loadingQuery, error}) => {
                    if (loadingQuery) return (
                    <>
                    <Select 
                        showSearch
                        getPopupContainer={ev => ev!.parentElement!}
                        dropdownStyle={{ maxHeight: 250, overflow: 'auto' }}
                        style={{ width: '100%' }}
                        value={addUserInput}
                        onChange={e => { setAddUserInput(e)}}
                        notFoundContent='Loading users..'
                    ></Select><button>{submitButtonString}</button></>);
                    if (!data.getUsers) return null;
                    return (
                        <>
                        <Select
                            showSearch
                            getPopupContainer={ev => ev!.parentElement!}
                            dropdownStyle={{ maxHeight: 250, overflow: 'auto' }}
                            style={{ width: '100%' }}
                            value={addUserInput}
                            onChange={e => { setAddUserInput(e)}}
                            notFoundContent='No user matches your search'
                        >
                        {data.getUsers.map((el: IUser) => <Select.Option key={el.id} value={el.username}>{el.username}</Select.Option>)}
                        </Select>
                        <Mutation
                            mutation={mutationToAddUser}
                        >
                        {(addUser, { loading: loadingMutation, error }) => {
                            const variables: any = { username: addUserInput, study };
                            if (application !== undefined) variables.application = application;
                            if (type !== undefined) variables.type = type === SECTIONTYPE.ADMINS ? 'APPLICATION_ADMIN' : 'APPLICATION_USER';
                            return (
                                <>
                                    { loadingMutation  ? <button>Loading...</button> : 
                                        <button onClick={e => { addUserInput && addUser({ variables }); }}>
                                            {submitButtonString}
                                        </button> }
                                </>
                            );
                        }}
                        </Mutation>
                        </>
                    );
                }}
            </Query>
        </div>
    </>;
};

const OneUserOrAdmin: React.FunctionComponent<{ mutationToDeleteUser: DocumentNode, user: string, application?: string, study: string }> = ({ mutationToDeleteUser, user, application, study }) => {
    const variables: any = { username: user, study };
    if (application !== undefined) variables.application = application;

    return (
        <div>
            <span>{user}</span>
            <Mutation
                mutation={mutationToDeleteUser}
            >
                {(deleteUserFromList, { loading, error }) => {
                    return (
                        <>
                            { loading  ? <span style={{ marginLeft: '1rem', cursor: 'pointer' }}>x</span> : 
                                <span style={{ marginLeft: '1rem', cursor: 'pointer' }} onClick={e => { deleteUserFromList({ variables }) }}>
                                    x
                                </span> }
                        </>
                    );
                }}
            </Mutation>
        </div>
    );
};

export enum SECTIONTYPE {
    ADMINS = 'Application Admins',
    USERS = 'Application Users'
}