import { FunctionComponent, useState } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { IOrganisation, IUserWithoutToken, userTypes } from '@itmat-broker/itmat-types';
import { WHO_AM_I, DELETE_USER, EDIT_USER, GET_USERS, REQUEST_USERNAME_OR_RESET_PASSWORD, GET_ORGANISATIONS, GET_STUDY } from '@itmat-broker/itmat-models';
import { Subsection } from '../reusable';
import LoadSpinner from '../reusable/loadSpinner';
import { ProjectSection } from './projectSection';
import { Form, Input, Select, DatePicker, Button, Alert, Popconfirm, Checkbox } from 'antd';
import dayjs from 'dayjs';
import { WarningOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';

export const UserDetailsSection: FunctionComponent = () => {

    const { userId } = useParams();

    const { loading, error, data } = useQuery(GET_USERS, {
        variables: {
            fetchDetailsAdminOnly: true, fetchAccessPrivileges: true, userId
        }
    });

    if (!userId) {
        return <>
            <div className='page_ariane'></div>
            <div className='page_content'>Select a user on the left hand side to open the details panel.</div>
        </>;
    }

    if (loading) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <LoadSpinner />
            </div>
        </>;
    }

    if (error) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <Alert type='error' message={error.message} />
            </div>
        </>;
    }

    const user: IUserWithoutToken = data?.getUsers?.[0];
    if (!user) {
        return <>
            <div className='page_ariane'>{data.getUsers[0]?.username ?? userId}</div>
            <div className='page_content'>Sorry we could not find this user.</div>
        </>;
    }

    return (
        <>
            <div className='page_ariane'>{data.getUsers[0].username}</div>
            <div className='page_content'>
                {
                    dayjs().add(4, 'week').valueOf() - dayjs(data.getUsers[0].expiredAt).valueOf() > 0
                        ? dayjs().valueOf() - dayjs(data.getUsers[0].expiredAt).valueOf() > 0
                            ? <>
                                <PauseCircleOutlined style={{
                                    color: '#cccccc',
                                    fontSize: '1.5rem'
                                }} /> This account has expired.
                                <br />
                                <br />
                                <br /></>
                            : <>
                                <WarningOutlined style={{
                                    color: '#ffaa33',
                                    fontSize: '1.5rem'
                                }} /> This account is close to expiring !
                                <br />
                                <br />
                                <br /></>
                        : null
                }
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

export const EditUserForm: FunctionComponent<{ user: (IUserWithoutToken & { access?: { id: string, projects: { id: string, name: string, studyId: string }[], studies: { id: string, name: string }[] } }) }> = ({ user }) => {

    const [userIsDeleted, setUserIsDeleted] = useState(false);
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);
    const { loading: whoamiloading, error: whoamierror, data: whoamidata } = useQuery(WHO_AM_I);
    const [requestResetPassword] = useMutation(REQUEST_USERNAME_OR_RESET_PASSWORD, { onCompleted: () => { setRequestResetPasswordSent(true); } });
    const [requestResetPasswordSent, setRequestResetPasswordSent] = useState(false);
    const { loading: getorgsloading, error: getorgserror, data: getorgsdata } = useQuery(GET_ORGANISATIONS);

    function formatSubmitObj(variables) {
        const final = {
            ...user,
            organisation: variables.organisation,
            type: variables.type,
            metadata: {
                ...user.metadata ?? {},
                aePermission: variables.ae,
                logPermission: variables.log
            },
            expiredAt: variables.expiredAt.valueOf()
        };
        delete final.access;
        return final;
    }

    if (userIsDeleted) { return <p> User {user.username} is deleted. </p>; }
    if (whoamiloading) { return <p>Loading..</p>; }
    if (whoamierror) { return <p>ERROR: please try again.</p>; }

    const disabledDate = (current) => {
        return current && (current < dayjs().endOf('day') || current > dayjs().add(3, 'month'));
    };

    if (getorgsloading) { return <p>Loading..</p>; }
    if (getorgserror) { return <p>ERROR: please try again.</p>; }
    const orgList: IOrganisation[] = getorgsdata.getOrganisations;
    return (
        <Mutation<any, any>
            mutation={EDIT_USER}
            onCompleted={() => setSavedSuccessfully(true)}
        >
            {(submit, { loading, error }) =>
                <Form initialValues={{
                    ...user,
                    ae: user.metadata?.aePermission ?? false,
                    createdAt: dayjs(user.createdAt),
                    expiredAt: dayjs(user.expiredAt),
                    organisation: orgList.find(org => org.id === user.organisation)?.id
                }} layout='vertical' onFinish={async (variables) => submit({ variables: formatSubmitObj(variables) })}>
                    <Form.Item name='username' label='Username'>
                        <Input disabled />
                    </Form.Item>
                    <Form.Item name='email' label='Email'>
                        <Input disabled />
                    </Form.Item>
                    <Form.Item name='firstname' label='Firstname'>
                        <Input disabled />
                    </Form.Item>
                    <Form.Item name='lastname' label='Lastname'>
                        <Input disabled />
                    </Form.Item>
                    <Form.Item name='organisation' label='Organisation'>
                        <Select placeholder='Organisation' showSearch filterOption={(input, option) =>
                            option?.children?.toLocaleString()?.toLocaleLowerCase()?.includes(input.toLocaleLowerCase()) ?? false
                        }>
                            {orgList.map((org) => <Select.Option key={org.id} value={org.id}>{org.name}</Select.Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name='createdAt' label='Created On'>
                        <DatePicker disabled style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name='expiredAt' label='Expire On'>
                        <DatePicker disabledDate={disabledDate} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name='type' label='User type'>
                        <Select>
                            <Select.Option value='STANDARD'>System user</Select.Option>
                            <Select.Option value='ADMIN'>System admin</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name='ae' label='Analytical Environment Permission' valuePropName="checked">
                        <Checkbox></Checkbox>
                    </Form.Item>
                    <Form.Item name='log' label='Logs Permission' valuePropName="checked">
                        <Checkbox></Checkbox>
                    </Form.Item>
                    <Form.Item name='emailNotificationsActivated' label='Email Notification' valuePropName='checked'>
                        <Checkbox disabled>Email Notification</Checkbox>
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
                        {whoamidata.whoAmI.id !== user.id && whoamidata.whoAmI.type === userTypes.ADMIN
                            ? <Mutation<any, any>
                                mutation={DELETE_USER}
                                refetchQueries={[
                                    { query: GET_USERS, variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } },
                                    /* quick fix: TO_DO, change to cache modification later */
                                    ...(user.access!.studies.map(el => ({ query: GET_STUDY, variables: { studyId: el.id } })))
                                ]}
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
                            : null
                        }
                    </Form.Item>
                </Form>
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

