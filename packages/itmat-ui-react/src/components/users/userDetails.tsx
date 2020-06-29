import React from 'react';
import { Mutation, useQuery, useMutation } from 'react-apollo';
import { IUserWithoutToken, userTypes } from 'itmat-commons';
import { Subsection } from '../reusable';
import LoadSpinner from '../reusable/loadSpinner';
import { ProjectSection } from './projectSection';
import { GQLRequests } from 'itmat-commons';
import { Form, Input, Select, DatePicker, Checkbox, Button, Alert, Popconfirm } from 'antd';
import { sites } from '../datasetDetail/tabContent/files/fileTab';
import moment from 'moment';

const {
    WHO_AM_I,
    DELETE_USER,
    EDIT_USER,
    GET_USERS,
    REQUEST_USERNAME_OR_RESET_PASSWORD
} = GQLRequests;

export const UserDetailsSection: React.FunctionComponent<{ userId: string }> = ({ userId }) => {
    const { loading, error, data } = useQuery(GET_USERS, {
        variables: {
            fetchDetailsAdminOnly: true, fetchAccessPrivileges: true, userId
        }
    });
    if (loading) { return <LoadSpinner />; }
    if (error) { return <p>Error :( {error.message}</p>; }
    const user: IUserWithoutToken = data.getUsers[0];
    if (user === null || user === undefined) { return <p>Oops! Cannot find user.</p>; }
    return (
        <>
            <div className='page_ariane'>{data.getUsers[0].username}</div>
            <div className='page_content'>
                <Subsection title='Account Information'>
                    <EditUserForm user={user} key={user.id} />
                    <br />
                </Subsection>
                <Subsection title='Projects'>
                    <ProjectSection projects={data.getUsers[0].access.projects} />
                    <br />
                </Subsection>
                <Subsection title='Datasets'>
                    <ProjectSection study={true} projects={data.getUsers[0].access.studies} />
                    <br />
                </Subsection>
            </div>
        </>
    );
};

export const EditUserForm: React.FunctionComponent<{ user: (IUserWithoutToken & { access?: Record<string, unknown> }) }> = ({ user }) => {

    const [userIsDeleted, setUserIsDeleted] = React.useState(false);
    const [savedSuccessfully, setSavedSuccessfully] = React.useState(false);
    const { loading: whoamiloading, error: whoamierror, data: whoamidata } = useQuery(WHO_AM_I);
    const [requestResetPassword] = useMutation(REQUEST_USERNAME_OR_RESET_PASSWORD, { onCompleted: () => { setRequestResetPasswordSent(true); } });
    const [requestResetPasswordSent, setRequestResetPasswordSent] = React.useState(false);

    function formatSubmitObj(variables) {
        const final = {
            ...user,
            ...variables
        };
        delete final.access;
        return final;
    }

    if (userIsDeleted) { return <p> User {user.username} is deleted. </p>; }
    if (whoamiloading) { return <p>Loading..</p>; }
    if (whoamierror) { return <p>ERROR: please try again.</p>; }

    return (
        <Mutation<any, any>
            mutation={EDIT_USER}
            onCompleted={() => setSavedSuccessfully(true)}
        >
            {(submit, { loading, error }) =>
                <>
                    <Form initialValues={user} layout='vertical' onFinish={(variables) => submit({ variables: formatSubmitObj(variables) })}>
                        <Form.Item name='username' label='Username'>
                            <Input disabled />
                        </Form.Item>
                        <Form.Item name='email' label='Email'>
                            <Input disabled />
                        </Form.Item>
                        <Form.Item name='firstname' label='Firstname'>
                            <Input />
                        </Form.Item>
                        <Form.Item name='lastname' label='Lastname'>
                            <Input />
                        </Form.Item>
                        <Form.Item name='organisation' label='Organisation'>
                            <Select>
                                {Object.entries(sites).map((site) => <Select.Option key={site[0]} value={site[0]}>{site[1]}</Select.Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name='type' label='User type'>
                            <Select>
                                <Select.Option value='STANDARD'>System user</Select.Option>
                                <Select.Option value='ADMIN'>System admin</Select.Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name='emailNotificationsActivated' label='Email notifications' valuePropName='checked'>
                            <Checkbox />
                        </Form.Item>
                        <Form.Item label='Created At'>
                            <DatePicker disabled value={moment(user.createdAt)} />
                        </Form.Item>
                        <Form.Item label='Expire On'>
                            <DatePicker value={moment(user.expiredAt)} />
                        </Form.Item>
                        {error ? (
                            <>
                                <Alert type='error' message={error.graphQLErrors.map(error => error.message).join()} />
                                <br />
                            </>
                        ) : null}
                        {savedSuccessfully ? (
                            <>
                                <Alert type='success' message={'All Saved!'} />
                                <br />
                            </>
                        ) : null}
                        {requestResetPasswordSent ? (
                            <>
                                <Alert type='success' message={'Password reset email sent!'} />
                                <br />
                            </>
                        ) : null}
                        <Form.Item>
                            <Button type='primary' disabled={loading} loading={loading} htmlType='submit'>
                                Save
                            </Button>
                            {whoamidata.whoAmI.id !== user.id && whoamidata.whoAmI.type === userTypes.ADMIN
                                ? <>
                                    &nbsp;&nbsp;&nbsp;
                                    <Button disabled={loading} onClick={() => {
                                        requestResetPassword({
                                            variables: {
                                                forgotUsername: false,
                                                forgotPassword: true,
                                                username: user.username
                                            }
                                        });
                                    }}>
                                        Send a password reset email
                                    </Button>
                                </>
                                : null
                            }
                            &nbsp;&nbsp;&nbsp;
                            <Mutation<any, any>
                                mutation={DELETE_USER}
                                refetchQueries={[{ query: GET_USERS, variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } }]}
                            >

                                {(deleteUser, { loading, error, data: UserDeletedData }) => {
                                    if (UserDeletedData && UserDeletedData.deleteUser && UserDeletedData.deleteUser.successful) {
                                        setUserIsDeleted(true);
                                    }
                                    if (error) return <p>{error.message}</p>;
                                    return (
                                        <Popconfirm title={<>Are you sure about deleting user <i>{user.username}</i>?</>} onConfirm={() => { deleteUser({ variables: { userId: user.id } }); }} okText='Yes' cancelText='No'>
                                            <Button type='primary' danger disabled={loading}>
                                                Delete this user
                                            </Button>
                                        </Popconfirm>
                                    );
                                }}
                            </Mutation>
                        </Form.Item>
                    </Form>
                </>
            }

        </Mutation>
    );
};

/* show date and time separately */
export const showTimeFunc = {
    showDate: function (timestamps: number) {
        return new Date(timestamps).toISOString().substring(0, 10);
    },
    showTime: function (timestamps: number) {
        return new Date(timestamps).toISOString().substring(11, 19);
    }
};

/* More time control due to different behaviors in chrome and firefox, also correct errors of summer/winter time offset */
export const changeTimeFunc = {
    changeDate: function (inputs: any, value: any) {
        /* When in summer time, there is non-zero timezoneoffset which should be considered */
        const offsetTime = new Date(inputs.expiredAt - new Date(inputs.expiredAt).getTimezoneOffset() * 60 * 1000);
        let newDate;
        const recordTime = offsetTime.toISOString().substring(11, 19);
        /* If the input date is invalid, the shown date will keep the original one */
        if (isNaN(new Date(value + 'T' + recordTime).valueOf()) || (new Date(value + 'T' + recordTime).valueOf() < 0)) {
            newDate = new Date(inputs.expiredAt);
        } else {
            newDate = new Date(value + 'T' + recordTime);
        }
        return { ...inputs, expiredAt: newDate.valueOf() };
    },
    changeTime: function (inputs: any, value: any) {
        const recordedDate = new Date(inputs.expiredAt).toISOString().substring(0, 10);
        /* When in summer time, there is non-zero timezoneoffset which should be considered */
        return { ...inputs, expiredAt: new Date(recordedDate + 'T' + value).valueOf() - new Date(inputs.expiredAt).getTimezoneOffset() * 60 * 1000 };
    }
};

