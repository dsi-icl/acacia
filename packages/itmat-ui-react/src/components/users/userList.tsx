import { FunctionComponent, useState } from 'react';
import { GET_USERS } from '@itmat-broker/itmat-models';
import { Query } from '@apollo/client/react/components';
import { useNavigate } from 'react-router-dom';
import LoadSpinner from '../reusable/loadSpinner';
import { Table, Input, Button, Tooltip } from 'antd';
import { EditOutlined, WarningOutlined, PauseCircleOutlined } from '@ant-design/icons';
import Highlighter from 'react-highlight-words';
import dayjs from 'dayjs';
import { IUserWithoutToken } from '@itmat-broker/itmat-types';

export const UserListSection: FunctionComponent = () => {
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
                            Error
                            {error.message}
                        </p>
                    );
                }
                const userList: IUserWithoutToken[] = data.getUsers;
                return (
                    <UserList users={userList} />
                );
            }}
        </Query>
    );
};

const UserList: FunctionComponent<{ users: IUserWithoutToken[] }> = ({ users }) => {

    const navigate = useNavigate();
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
                dayjs().add(4, 'week').valueOf() - dayjs(record.expiredAt).valueOf() > 0
                    ? dayjs().valueOf() - dayjs(record.expiredAt).valueOf() > 0
                        ? <Tooltip title='Account has expired.'><PauseCircleOutlined style={{
                            color: '#cccccc',
                            fontSize: '1.5rem'
                        }} /></Tooltip>
                        : <Tooltip title='Account is close to expiry !'><WarningOutlined style={{
                            color: '#ffaa33',
                            fontSize: '1.5rem'
                        }} /></Tooltip>
                    : null
            ),
            width: '5rem',
            key: 'edit'
        },
        {
            render: (__unused__value, record) => (
                <Button icon={<EditOutlined />} onClick={() => { navigate(`/users/${record.id}`); }}>
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
        <Table rowKey={(rec) => rec.id} onRow={(record: IUserWithoutToken) => ({
            onClick: () => {
                navigate(`/users/${record.id}`);
            },
            style: {
                cursor: 'pointer'
            }
        })} pagination={false} columns={columns} dataSource={users.filter(user => !searchTerm || user.firstname.toUpperCase().search(searchTerm) > -1 || user.lastname.toUpperCase().search(searchTerm) > -1 || user.email.toUpperCase().search(searchTerm) > -1)} size='small' />
    </>;
};
