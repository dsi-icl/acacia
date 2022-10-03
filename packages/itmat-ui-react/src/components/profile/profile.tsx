import { ChangeEvent, FunctionComponent, useState } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { useQuery, useMutation } from '@apollo/client/react/hooks';
import { IUserWithoutToken, userTypes, IPubkey, IOrganisation } from '@itmat-broker/itmat-types';
import { WHO_AM_I, EDIT_USER, REQUEST_USERNAME_OR_RESET_PASSWORD, REGISTER_PUBKEY, GET_PUBKEYS, ISSUE_ACCESS_TOKEN, GET_ORGANISATIONS, REQUEST_EXPIRY_DATE } from '@itmat-broker/itmat-models';
import { Subsection } from '../reusable';
import LoadSpinner from '../reusable/loadSpinner';
import { ProjectSection } from '../users/projectSection';
import { Form, Input, Select, DatePicker, Button, Alert } from 'antd';
import dayjs from 'dayjs';
import { WarningOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { Key } from '../../utils/dmpCrypto/dmp.key';

export const ProfileManagementSection: FunctionComponent = () => {
    const { loading: whoamiloading, error: whoamierror, data: whoamidata } = useQuery(WHO_AM_I);
    const [requestExpiryDate] = useMutation(REQUEST_EXPIRY_DATE, { onCompleted: () => { setRequestExpiryDateSent(true); } });
    const [requestExpiryDateSent, setRequestExpiryDateSent] = useState(false);

    if (whoamiloading) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <LoadSpinner />
            </div>
        </>;
    }
    if (whoamierror) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <Alert type='error' message={whoamierror.message} />
            </div>
        </>;
    }

    const user: IUserWithoutToken = whoamidata.whoAmI;
    return (
        <>
            <div className='page_ariane'>{whoamidata.whoAmI.username}</div>
            <div className='page_content'>
                {
                    dayjs().add(4, 'week').valueOf() - dayjs(user.expiredAt).valueOf() > 0
                        ? dayjs().valueOf() - dayjs(user.expiredAt).valueOf() > 0
                            ? <>
                                <PauseCircleOutlined style={{
                                    color: '#cccccc',
                                    fontSize: '1.5rem'
                                }} /> Your account has expired.
                                <br />
                                <br />
                                <br /></>
                            : <>
                                <WarningOutlined style={{
                                    color: '#ffaa33',
                                    fontSize: '1.5rem'
                                }} /> Your account is close to expiring!
                                <br />
                                <br />
                                <Button disabled={requestExpiryDateSent} onClick={() => {
                                    requestExpiryDate({
                                        variables: {
                                            username: user.username,
                                            email: user.email
                                        }
                                    });
                                }}>
                                    Request new expiry date!
                                </Button>
                                <br />
                                <br /></>
                        : null
                }
                {requestExpiryDateSent ? (
                    <>
                        <Alert type='success' message={'New expiry date has been requested! Please wait for ADMIN to approve.'} />
                        <br />
                    </>
                ) : null}

                <Subsection title='Account Information'>
                    <EditUserForm user={user} key={user.id} />
                    <br />
                </Subsection>
                <Subsection title='Projects'>
                    <ProjectSection projects={whoamidata.whoAmI.access.projects} />
                    <br />
                </Subsection>
                <Subsection title='Datasets'>
                    <ProjectSection study={true} projects={whoamidata.whoAmI.access.studies} />
                    <br />
                </Subsection>
                <Subsection title='Public-key management'>
                    <RegisterPublicKey userId={user.id} />
                    <br />
                    <br />
                </Subsection>
                <Subsection title='Signature generation'>
                    <RsaSigner />
                    <br />
                    <br />
                </Subsection>
                <Subsection title='Access Token management'>
                    <TokenManagement userId={user.id} />
                    <br />
                    <br />
                </Subsection>

            </div>
        </>
    );
};

export const EditUserForm: FunctionComponent<{ user: (IUserWithoutToken & { access?: { id: string, projects: { id: string, name: string, studyId: string }[], studies: { id: string, name: string }[] } }) }> = ({ user }) => {
    const [savedSuccessfully, setSavedSuccessfully] = useState(false);
    const [requestResetPassword] = useMutation(REQUEST_USERNAME_OR_RESET_PASSWORD, { onCompleted: () => { setRequestResetPasswordSent(true); } });
    const [requestResetPasswordSent, setRequestResetPasswordSent] = useState(false);
    const { loading: getorgsloading, error: getorgserror, data: getorgsdata } = useQuery(GET_ORGANISATIONS);

    function formatSubmitObj(variables) {
        const final = {
            ...user,
            ...variables,
            expiredAt: variables.expiredAt.valueOf()
        };
        delete final.access;
        return final;
    }

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
                <Form title='EditUserForm' initialValues={{
                    ...user,
                    createdAt: dayjs(user.createdAt),
                    expiredAt: dayjs(user.expiredAt),
                    organisation: orgList.find(org => org.id === user.organisation)?.name
                }} layout='vertical' onFinish={(variables) => submit({ variables: formatSubmitObj(variables) })}>
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
                        <Select disabled placeholder='Organisation' showSearch filterOption={(input, option) =>
                            option?.children?.toLocaleString()?.toLocaleLowerCase()?.includes(input.toLocaleLowerCase()) ?? false
                        }>
                            {orgList.map((org) => <Select.Option key={org.id} value={org.id}>{org.name}</Select.Option>)}
                        </Select>
                    </Form.Item>
                    <Form.Item name='createdAt' label='Created On'>
                        <DatePicker disabled style={{ width: '100%' }} />
                    </Form.Item>
                    {
                        user.type === userTypes.ADMIN ? null :
                            <Form.Item name='expiredAt' label='Expire On'>
                                <DatePicker disabled disabledDate={disabledDate} style={{ width: '100%' }} />
                            </Form.Item>
                    }
                    <Form.Item name='type' label='User type'>
                        <Select disabled>
                            <Select.Option value='STANDARD'>System user</Select.Option>
                            <Select.Option value='ADMIN'>System admin</Select.Option>
                        </Select>
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
                        {user.type === userTypes.ADMIN
                            ? <Button type='primary' disabled={loading} loading={loading} htmlType='submit'>
                                Save
                            </Button>
                            : null
                        }
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

export const cryptoInBrowser = {
    keyGen: async function () {
        return Key.createRSAKey();
    },
    signGen: async function (message: string, signKey: CryptoKey) {
        return Key.signwtRSAKey(message, signKey);
    }
};

export const RegisterPublicKey: FunctionComponent<{ userId: string }> = ({ userId }) => {
    const [completedKeypairGen, setcompletedKeypairGen] = useState(false);
    const [exportedKeyPair, setExportedKeyPair] = useState({ privateKey: '', publicKey: '' });
    const [signature, setSignature] = useState('');

    const keyGenInBrowser = async function () {
        const keyPair = await cryptoInBrowser.keyGen();
        const exportedKeyPair = await Key.exportRSAKey(keyPair);
        setExportedKeyPair(exportedKeyPair);
        const message = exportedKeyPair.publicKey;
        const signature = await cryptoInBrowser.signGen(message, keyPair.privateKey!);
        setSignature(signature);
        setcompletedKeypairGen(true);
    };

    const [downloadLink, setDownloadLink] = useState('');
    // function for generating file and set download link
    const makeTextFile = (filecontent: string) => {
        const data = new Blob([filecontent], { type: 'text/plain' });
        // this part avoids memory leaks
        if (downloadLink !== '') window.URL.revokeObjectURL(downloadLink);
        // update the download link state
        setDownloadLink(window.URL.createObjectURL(data));
    };

    const [completedRegister, setCompletedRegister] = useState(false);
    const { loading: getPubkeysloading, error: getPubkeyserror, data: getPubkeysdata } = useQuery(GET_PUBKEYS, {
        variables: {
            associatedUserId: userId
        }
    });
    if (getPubkeysloading) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <LoadSpinner />
            </div>
        </>;
    }
    if (getPubkeyserror) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <Alert type='error' message={getPubkeyserror.message} />
            </div>
        </>;
    }
    const ipubkey: IPubkey = getPubkeysdata?.getPubkeys?.[0];

    if (completedKeypairGen) {
        return (
            <Mutation<any, any>
                mutation={REGISTER_PUBKEY}
                onCompleted={() => setCompletedRegister(true)}
            >
                {(submit, { loading, error }) =>
                    <Form title='RegisterPublicKeyCompletedKeyPai' initialValues={{
                        associatedUserId: userId
                    }} layout='vertical' onFinish={(variables) => submit({ variables })}>

                        <Form.Item name='associatedUserId' label='User ID'>
                            <Input disabled />
                        </Form.Item>

                        {((ipubkey === null) || (ipubkey === undefined))
                            ? <p>Register your public-key for use.</p>
                            :
                            <>
                                <Form.Item name='currentPubkey' label='Current registered public key'>
                                    <Input disabled placeholder={ipubkey?.pubkey.replace(/\n/g, '\\n')} />
                                </Form.Item>
                                <br />
                                <p>Register a new public-key. The current one will then be no longer valid.</p>
                            </>
                        }

                        <h2>Securely keep the private key and the signature for use as we do not store such information on the server!.</h2>

                        <p>Private Key:</p>
                        <textarea title='Private Key' disabled value={exportedKeyPair.privateKey.replace(/\n/g, '\\n')} cols={120} rows={20} />
                        <br />
                        <a download='privateKey.pem' href={downloadLink}>
                            <Button type='primary' onClick={() => makeTextFile(exportedKeyPair.privateKey.replace(/\n/g, '\\n'))}>
                                Save the private key (PEM file)
                            </Button>
                        </a>
                        <br />
                        <br />

                        <p>Public Key:</p>
                        <textarea title='Public Key' disabled value={exportedKeyPair.publicKey.replace(/\n/g, '\\n')} cols={120} rows={7} />
                        <br />
                        <a download='publicKey.pem' href={downloadLink}>
                            <Button type='primary' onClick={() => makeTextFile(exportedKeyPair.publicKey.replace(/\n/g, '\\n'))}>
                                Save the public key (PEM file)
                            </Button>
                        </a>
                        <br />
                        <br />

                        <p>Signature:</p>
                        <textarea title='Signature' disabled value={signature} cols={120} rows={7} />
                        <br />
                        <a download='signature.txt' href={downloadLink}>
                            <Button type='primary' onClick={() => makeTextFile(signature)}>
                                Save the signature (TXT file)
                            </Button>
                        </a>
                        <br />
                        <br />

                        <Form.Item name='pubkey' label='Public key' hasFeedback rules={[{ required: true, message: 'Please enter your public key' }]}>
                            <textarea title='Public key' cols={120} rows={10} />
                        </Form.Item>

                        <Form.Item name='signature' label='Signature' hasFeedback rules={[{ required: true, message: 'Please enter the signature' }]}>
                            <textarea title='Signature' cols={120} rows={10} />
                        </Form.Item>

                        {error ? (
                            <>
                                <Alert type='error' message={error.graphQLErrors.map(error => error.message).join()} />
                                <br />
                            </>
                        ) : null}
                        {completedRegister ? (
                            <>
                                <Alert type='success' message={'Public-key is Sucessfully Registered!'} />
                                <br />
                            </>
                        ) : null}

                        <Form.Item>
                            <Button type='primary' disabled={loading} loading={loading} htmlType='submit'>
                                Register
                            </Button>
                        </Form.Item>

                    </Form>
                }

            </Mutation>
        );
    }

    return (
        <Mutation<any, any>
            mutation={REGISTER_PUBKEY}
            onCompleted={() => setCompletedRegister(true)}
        >
            {(submit, { loading, error }) =>
                <>
                    <Form title='RegisterPublicKey' initialValues={{
                        associatedUserId: userId
                    }} layout='vertical' onFinish={(variables) => submit({ variables })}>

                        <Form.Item name='associatedUserId' label='User ID'>
                            <Input disabled />
                        </Form.Item>

                        {((ipubkey === null) || (ipubkey === undefined))
                            ? <p>Register your public-key for use.</p>
                            :
                            <>
                                <Form.Item name='currentPubkey' label='Current registered public key'>
                                    <Input disabled placeholder={ipubkey?.pubkey.replace(/\n/g, '\\n')} />
                                </Form.Item>
                                <br />
                                <p>Register a new public-key. The current one will then be no longer valid.</p>
                            </>
                        }

                        <Form.Item name='pubkey' label='Public key' hasFeedback rules={[{ required: true, message: 'Please enter your public key' }]}>
                            <textarea title='Public key' cols={120} rows={10} />
                        </Form.Item>

                        <Form.Item name='signature' label='Signature' hasFeedback rules={[{ required: true, message: 'Please enter the signature' }]}>
                            <textarea title='Signature' cols={120} rows={10} />
                        </Form.Item>

                        {error ? (
                            <>
                                <Alert type='error' message={error.graphQLErrors.map(error => error.message).join()} />
                                <br />
                            </>
                        ) : null}
                        {completedRegister ? (
                            <>
                                <Alert type='success' message={'Public-key is Sucessfully Registered!'} />
                                <br />
                            </>
                        ) : null}

                        <Form.Item>
                            <Button type='primary' disabled={loading} loading={loading} htmlType='submit'>
                                Register
                            </Button>
                        </Form.Item>

                    </Form>

                    <br />
                    <Button type='primary' onClick={() => keyGenInBrowser()}>
                        Do not have public/private keypair? Generate one (In-browser)!
                    </Button>

                </>
            }

        </Mutation>
    );

};
export const RsaSigner: FunctionComponent = () => {
    const [privateKey, setPrivateKey] = useState('');
    const [publicKey, setPublicKey] = useState('');

    const handlePrivateKey = (event: ChangeEvent<HTMLTextAreaElement>) => {
        const privateKey = event.target.value;
        setPrivateKey(privateKey);
    };

    const handlePublicKey = (event: ChangeEvent<HTMLTextAreaElement>) => {
        const publicKey = event.target.value;
        setPublicKey(publicKey);
    };

    const [signature, setSignature] = useState('');
    const [completedSignatureGen, setcompletedSignatureGen] = useState(false);

    const signGen = async function () {
        const privateKeyFormatted = await Key.importRSAPrivateKey(privateKey);
        const signature = await cryptoInBrowser.signGen(publicKey, privateKeyFormatted);
        //const signature  = await cryptoInBrowser.signGen('abc', privateKeyFormatted);
        setSignature(signature);
        setcompletedSignatureGen(true);
    };

    const [downloadLink, setDownloadLink] = useState('');
    // function for generating file and set download link
    const makeTextFile = (filecontent: string) => {
        const data = new Blob([filecontent], { type: 'text/plain' });
        // this part avoids memory leaks
        if (downloadLink !== '') window.URL.revokeObjectURL(downloadLink);
        // update the download link state
        setDownloadLink(window.URL.createObjectURL(data));
    };

    if (completedSignatureGen) {
        return (
            <div>
                <h3>The signature is successfully generated!</h3>
                <br />
                <p>Securely keep this signature to register with the data management portal!</p>
                <textarea title='Signature' disabled value={signature} cols={120} rows={7} />
                <br />
                <a download='signature.txt' href={downloadLink}>
                    <Button type='primary' onClick={() => makeTextFile(signature)}>
                        Save the signature (TXT file)
                    </Button>
                </a>
            </div>
        );
    }

    return (
        <div>
            <p>To generate a digital signature to use in the data management portal, you need a public and private keypair</p>
            <p>Private Key: </p>
            <textarea cols={120} rows={10} name='privateKey' value={privateKey} onChange={handlePrivateKey} required> </textarea>
            <br />
            <p>Public Key: </p>
            <textarea cols={120} rows={10} name='privateKey' value={publicKey} onChange={handlePublicKey} required> </textarea>
            <br />
            <Button type='primary' onClick={() => signGen()}>
                Generate Signature (In-Browser)
            </Button>
        </div>
    );

};

export const TokenManagement: FunctionComponent<{ userId: string }> = ({ userId }) => {
    const [completedTokenGen, setcompletedTokenGen] = useState(false);
    //const [accessTokenGen, setaccessTokenGen] = useState('');
    const [tokenGen, { data: tokendata, loading, error }] = useMutation(ISSUE_ACCESS_TOKEN, {
        onCompleted: () => {
            setcompletedTokenGen(true);
        }
    });

    const { loading: getPubkeysloading, error: getPubkeyserror, data: getPubkeysdata } = useQuery(GET_PUBKEYS, {
        variables: {
            associatedUserId: userId
        }
    });

    if (getPubkeysloading) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <LoadSpinner />
            </div>
        </>;
    }
    if (getPubkeyserror) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <Alert type='error' message={getPubkeyserror.message} />
            </div>
        </>;
    }

    const ipubkey: IPubkey = getPubkeysdata?.getPubkeys?.[0];
    if ((ipubkey === null) || (ipubkey === undefined)) {
        return <p>You need to register a public-key for generating access token.</p>;
    }

    if (completedTokenGen) {
        return (
            <div>
                <h2>The access token is successfully generated!</h2>
                <br />
                <p>Securely keep this token as an authentication key when interacting with APIs</p>
                <textarea title='Token' disabled value={tokendata.issueAccessToken.accessToken} cols={120} rows={20} />
                <br />
            </div>
        );
    }

    return (
        <Form title='TokenManagement' initialValues={{
            pubkey: ipubkey?.pubkey.replace(/\n/g, '\\n')
        }} layout='vertical' onFinish={(variables) => tokenGen({ variables })}>
            <p>To generate an access token, you need to enter the signature signed by your private-key</p>
            <p>Current refresh counter: <strong>{ipubkey?.refreshCounter}</strong></p>
            <Form.Item name='pubkey' label='Your registered public key'>
                <Input disabled placeholder={ipubkey?.pubkey.replace(/\n/g, '\\n')} />
            </Form.Item>

            <Form.Item name='signature' label='Signature' hasFeedback rules={[{ required: true, message: 'Please enter the signature' }]}>
                <Input />
            </Form.Item>

            {error ? (
                <>
                    <Alert type='error' message={error.graphQLErrors.map(error => error.message).join()} />
                    <br />
                </>
            ) : null}

            <Form.Item>
                <Button type='primary' disabled={loading} loading={loading} htmlType='submit'>
                    Generate Token
                </Button>
            </Form.Item>
        </Form>
    );

};
