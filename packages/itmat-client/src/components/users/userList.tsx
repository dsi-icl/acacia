import * as React from 'react';
import { Query } from 'react-apollo';
import { GET_USERS_LIST } from '../../graphql/appUsers';
import { Models } from 'itmat-utils';
import * as css from '../../css/userList.css';
import { NavLink } from 'react-router-dom';
import { Icons } from '../icons';

export const UserListSection: React.FunctionComponent = props => {
    return (
        <Query query={GET_USERS_LIST}>
            {({loading, error, data }) => {
                if (loading) return <p>Loading...</p>;
                if (error) return <p>Error :( {error.message}</p>;
                const userList: Models.UserModels.IUserWithoutToken[] = data.getUsers;
                return (
                    <div className={css.userList}>
                        <table>
                            <thead>
                                <tr>
                                    <th><Icons type='search'/><input name='search'/></th>
                                    <th></th>
                                    <th></th>
                                    <th></th>
                                    <th></th>
                                    <th><NavLink to={`/users/createNewUser`} activeClassName={css.showMoreButton}><button>Create new user</button></NavLink></th>
                                </tr>
                            </thead>
                        </table>

                        <table>
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Real Name</th>
                                    <th>Type</th>
                                    <th>Email</th>
                                    <th>#Studies</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {userList.map(el => <User key={el.username} data={el}/>)}
                            </tbody>
                        </table>
                    </div>
                );
            }}
        </Query>
    );
};

const User: React.FunctionComponent<{ data: Models.UserModels.IUserWithoutToken}> = ({ data }) => {
    return (
            <tr>
                <td><b>{data.username}</b></td>
                <td>{data.realName}</td>
                <td>{data.type}</td>
                <td>{data.email}</td>
                <td>''</td>
                <td><NavLink to={`/users/${data.username}`} activeClassName={css.showMoreButton}><span> Show more </span></NavLink></td>
            </tr>
    );
};