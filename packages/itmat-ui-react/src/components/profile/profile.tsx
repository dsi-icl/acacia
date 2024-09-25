import { ChangeEvent, FunctionComponent, useEffect, useState } from 'react';
import { IOrganisation, IUserWithoutToken, enumUserTypes } from '@itmat-broker/itmat-types';
import LoadSpinner from '../reusable/loadSpinner';
import { Form, Input, Button, Image as AntdImage, Typography, Row, Col, Divider, message, Select } from 'antd';
import { Key } from '../../utils/dmpCrypto/dmp.key';
import css from './profile.module.css';
import { trpc } from '../../utils/trpc';
import { createUserIcon } from '../../utils/image';
const { Title } = Typography;
const { TextArea } = Input;


export const ProfileManagementSection: FunctionComponent = () => {
    const whoAmI = trpc.user.whoAmI.useQuery();
    const getOrganisations = trpc.organisation.getOrganisations.useQuery({});
    const getUserRoles = trpc.role.getUserRoles.useQuery({ userId: whoAmI?.data.id });
    const getStudies = trpc.study.getStudies.useQuery({});
    const getUserKeys = trpc.user.getUserKeys.useQuery({ userId: whoAmI?.data.id });
    const requestExpiryDate = trpc.user.requestExpiryDate.useMutation({
        onSuccess: () => {
            void message.success('Request sent');
        },
        onError: () => {
            void message.error('Error sending request');
        }
    });
    if (whoAmI.isLoading || getOrganisations.isLoading || getUserRoles.isLoading || getStudies.isLoading || getUserKeys.isLoading) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <LoadSpinner />
            </div>
        </>;
    }
    if (whoAmI.isError || getOrganisations.isError || getUserRoles.isError || getStudies.isError || getUserKeys.isError) {
        return <>
            An error occured.
        </>;
    }
    return (<>
        <div className={css.profile_left}>
            <div className={css.profile_summary_wrapper}>
                <div className={css.profile_summary_profile}>
                    {
                        whoAmI.data ? <AntdImage width={200} height={200} src={createUserIcon(whoAmI.data)} />
                            : <AntdImage width={200} height={200} src="error" fallback="data:image/png;base64,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" />
                    }
                </div>
                <div className={css.profile_summary_statistics}>
                    <Row>
                        <Col className={css.profile_summary_statistics_value} span={7}>{getStudies.data.length ?? 'NA'}</Col>
                        <Divider type='vertical' />
                        <Col className={css.profile_summary_statistics_value} span={7}>{(() => {
                            const remaining: number = whoAmI.data.expiredAt - Date.now();
                            if (whoAmI.data.type === enumUserTypes.ADMIN) {
                                return 'Infinite';
                            }
                            return Math.floor(Math.max(0, remaining) / 1000 / 60 / 60 / 24) + ' days';
                        })()}</Col>
                        <Divider type='vertical' />
                        <Col className={css.profile_summary_statistics_value} span={7}>{getUserKeys.data.length ?? 'NA'}</Col>
                    </Row>
                    <br />
                    <Row>
                        <Col className={css.profile_summary_statistics_tag} span={7}>Datasets</Col>
                        <Divider type='vertical' />
                        <Col className={css.profile_summary_statistics_tag} span={7}>Expired In</Col>
                        <Divider type='vertical' />
                        <Col className={css.profile_summary_statistics_tag} span={7}>Public keys</Col>
                    </Row>
                </div>
                <br />
                <div>
                    <Title level={4}>{getOrganisations.data.filter(el => el.id === whoAmI.data.organisation)?.[0]?.name ?? 'NA'}</Title>
                </div>
                <br />
                <div className={css.profile_summary_description}>
                    {whoAmI.data.description}
                </div><br />
                <div className={css.profile_summary_description}>
                    <Button onClick={() => requestExpiryDate.mutate({ username: whoAmI.data.username })}>Request Account Extension</Button>
                </div>
            </div>
        </div>
        <Divider type='vertical' style={{ color: 'black' }} />
        <div className={css.profile_right}>
            <ProfileEditForm key={whoAmI.data.id} user={whoAmI.data} organisations={getOrganisations.data} />
        </div>
    </>);
};

export const ProfileEditForm: FunctionComponent<{ user: IUserWithoutToken, organisations: IOrganisation[] }> = ({ user, organisations }) => {
    const editUser = trpc.user.editUser.useMutation({
        onSuccess: () => {
            void message.success('Profile updated successfully');
        },
        onError: () => {
            void message.error('Error updating profile');
        }
    });
    const [form] = Form.useForm();
    useEffect(() => {
        if (user) {
            form.resetFields(); // Reset the form fields when user data changes
        }
    }, [user, form]);
    if (!user) {
        return null;
    }

    const handleSubmit = async (variables: Record<string, string>, user: { id: string }) => {
        await editUser.mutateAsync({ userId: user.id, ...variables });
    };

    const onFinish = (variables) => {
        void handleSubmit(variables, user);
    };

    return (<Form
        form={form}
        initialValues={{ ...user }}
        onFinish={(variables) => void onFinish(variables)}
    >
        <Row justify={'space-between'}>
            <div className={css.profile_edit_special_title}>BASIC INFO</div>
        </Row>
        <Divider />
        <Row justify={'space-between'}>
            <Col span={10}>
                <div className={css.profile_edit_normal_title}>FIRST NAME</div><br />
                <Form.Item name='firstname'>
                    <Input className={css.login_box_input} placeholder='FIRST NAME' />
                </Form.Item>
            </Col>
            <Col span={13}>
                <div className={css.profile_edit_normal_title}>LAST NAME</div><br />
                <Form.Item name='lastname' hasFeedback rules={[{ required: false, message: ' ' }]}>
                    <Input className={css.login_box_input} placeholder='LAST NAME' />
                </Form.Item>
            </Col>
        </Row>
        <Row justify={'space-between'}>
            <Col span={10}>
                <div className={css.profile_edit_normal_title}>USER NAME</div><br />
                <Form.Item name='username' hasFeedback rules={[{ required: true, message: ' ' }]}>
                    <Input className={css.login_box_input} placeholder='USER NAME' disabled={true} />
                </Form.Item>
            </Col>
            <Col span={13}>
                <div className={css.profile_edit_normal_title}>PASSWORD</div><br />
                <Form.Item className={css.profile_edit_lastname} name='password' hasFeedback rules={[{ required: false, message: ' ' }]}>
                    <Input.Password className={css.login_box_input} placeholder='Password' />
                </Form.Item>
            </Col>
        </Row>
        <Row justify={'space-between'}>
            <Col span={10}>
                <div className={css.profile_edit_normal_title}>Email</div><br />
                <Form.Item name='email' hasFeedback rules={[{ required: true, message: ' ' }]}>
                    <Input className={css.login_box_input} placeholder='Email' disabled={true} />
                </Form.Item>
            </Col>
            <Col span={13}>
                <div className={css.profile_edit_normal_title}>Organisation</div><br />
                <Form.Item className={css.profile_edit_lastname} name='organisation' hasFeedback rules={[{ required: false, message: ' ' }]}>
                    <Select placeholder='Organisation' showSearch filterOption={(input, option) =>
                        option?.children?.toLocaleString()?.toLocaleLowerCase()?.includes(input.toLocaleLowerCase()) ?? false
                    }>
                        {
                            organisations.map((organisation) =>
                                <Select.Option key={organisation.id} value={organisation.id}>{organisation.name}</Select.Option>)
                        }
                    </Select>
                </Form.Item>
            </Col>
        </Row>
        <Row justify={'space-between'}>
            <Col span={24}>
                <div className={css.profile_edit_special_title}>Description</div>
                <Divider />
                <Form.Item name='description' hasFeedback rules={[{ required: false, message: ' ' }]}>
                    <TextArea className={css.login_box_input} placeholder='DESCRIPTION' />
                </Form.Item>
            </Col>
        </Row>
        <Row className={css.profile_edit_submit}>
            <Col span={5} >
                <Button className={css.login_box_input} type='primary' disabled={false} loading={false} htmlType='submit'>
                    SAVE
                </Button><br /><br />
            </Col>
        </Row>
    </Form>);
};

export const cryptoInBrowser = {
    keyGen: async function () {
        return Key.createRSAKey();
    },
    signGen: async function (message: string, signKey: CryptoKey) {
        return Key.signwtRSAKey(message, signKey);
    }
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
            <Button
                type="primary"
                onClick={() => {
                    signGen().catch((error) => {
                        // Handle error if necessary
                        void message.error({ content: 'Error generating signature: ' + error });
                    });
                }}
            >
                Generate Signature (In-Browser)
            </Button>
        </div>
    );

};

