import { Models, GET_USERS } from 'itmat-commons';
import React, { useState } from 'react';
import { Query } from 'react-apollo';
import { useHistory } from 'react-router-dom';
import LoadSpinner from '../reusable/loadSpinner';
import { Table, Input, Button } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import Highlighter from 'react-highlight-words';

export const UserListSection: React.FunctionComponent = () => {
    return (
        <Query<any, any>
            query={GET_USERS}
            variables={{ fetchDetailsAdminOnly: true, fetchAccessPrivileges: false }}
        >
            {({ loading, error, data }) => {
                if (loading) { return <LoadSpinner />; }
                if (error) {
                    return (
                        <p>
                            Error :(
                            {error.message}
                        </p>
                    );
                }
                const userList: Models.UserModels.IUserWithoutToken[] = data.getUsers;
                return (
                    <UserList users={userList} />
                );
            }}
        </Query>
    );
};

const UserList: React.FunctionComponent<{ users: Models.UserModels.IUserWithoutToken[] }> = ({ users }) => {

    const history = useHistory();
    const [searchTerm, setSearchTerm] = useState<string | undefined>();

    const columns = [
        {
            title: 'Firstname',
            dataIndex: 'firstname',
            key: 'firstname',
            render: (__unused__value, record) => {
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={record.firstname} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return record.firstname;
            },
            sorter: (a, b) => a.firstname.localeCompare(b.firstname)
        },
        {
            title: 'Lastname',
            dataIndex: 'lastname',
            key: 'lastname',
            render: (__unused__value, record) => {
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={record.lastname} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return record.lastname;
            },
            sorter: (a, b) => a.lastname.localeCompare(b.lastname)
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            render: (__unused__value, record) => {
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={record.email} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return record.email;
            },
            sorter: (a, b) => a.email.localeCompare(b.email)
        },
        {
            render: (__unused__value, record) => (
                <Button icon={<EditOutlined />} danger onClick={() => { history.push(`/users/${record.id}`); }}>
                    Edit
                </Button>
            ),
            width: '5rem',
            key: 'edit'
        }
    ];

    return <>
        <Input.Search allowClear placeholder='Search' onChange={({ target: { value } }) => setSearchTerm(value.toUpperCase())} />
        <br />
        <br />
        <Table rowKey={(rec) => rec.id} pagination={false} columns={columns} dataSource={users.filter(user => !searchTerm || user.firstname.toUpperCase().search(searchTerm) > -1 || user.lastname.toUpperCase().search(searchTerm) > -1 || user.email.toUpperCase().search(searchTerm) > -1)} size='small' />
    </>;
};
