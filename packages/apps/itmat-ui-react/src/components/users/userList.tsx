import { SearchOutlined } from '@ant-design/icons';
import { IUserWithoutToken } from '@itmat/commons';
import * as React from 'react';
import { Query } from '@apollo/react-components';
import { NavLink } from 'react-router-dom';
import { GET_USERS } from '@itmat/commons';
import { LoadingBalls } from '../reusable/icons/loadingBalls';
import css from './userList.module.css';

export const UserListSection: React.FC = (props) => (
    <Query<any, any>
        query={GET_USERS}
        variables={{ fetchDetailsAdminOnly: true, fetchAccessPrivileges: false }}
    >
        {({ loading, error, data }) => {
            if (loading) { return <LoadingBalls />; }
            if (error) {
                return (
                    <p>
                        Error :(
                        {error.message}
                    </p>
                );
            }
            const userList: IUserWithoutToken[] = data.getUsers;
            return (
                <UserList list={userList} />
            );
        }}
    </Query>
);

const User: React.FC<{ data: IUserWithoutToken }> = ({ data }) => (
    <tr>
        <td>{data.username}</td>
        <td>{data.realName}</td>
        <td>{data.type}</td>
        <td>{data.email}</td>
        <td><NavLink to={`/users/${data.id}`} activeClassName={css.button_clicked}><button>More/Edit</button></NavLink></td>
    </tr>
);

const UserList: React.FC<{ list: IUserWithoutToken[] }> = ({ list }) => {
    const [searchString, setSearchString] = React.useState('');

    function highermappingfunction() {
        if (searchString === '') {
            return (el: IUserWithoutToken) => <User key={el.id} data={el} />;
        }
        return (el: IUserWithoutToken) => {
            if (
                el.username.toLowerCase().indexOf(searchString.toLowerCase()) !== -1
                || el.email.toLowerCase().indexOf(searchString.toLowerCase()) !== -1
                || el.type.toLowerCase().indexOf(searchString.toLowerCase()) !== -1
                || el.realName.toLowerCase().indexOf(searchString.toLowerCase()) !== -1
            ) {
                return <User key={el.id} data={el} />;
            }
            return null;
        };
    }

    return (
        <div className={css.user_list}>
            <table>
                <thead>
                    <tr>
                        <th>
                            <SearchOutlined />
                            <input name="search" value={searchString} onChange={(e) => { setSearchString(e.target.value); }} />
                        </th>
                        <th />
                        <th />
                        <th />
                        <th><NavLink to="/users/createNewUser" activeClassName={css.button_clicked}><button>Create new user</button></NavLink></th>
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
                        <th />
                    </tr>
                </thead>
                <tbody>
                    {list.map(highermappingfunction())}
                </tbody>
            </table>
        </div>
    );
};
