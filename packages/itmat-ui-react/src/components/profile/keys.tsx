import React, { FunctionComponent, useState } from 'react';
import LoadSpinner from '../reusable/loadSpinner';
// import { ProjectSection } from '../users/projectSection';
import { Button, List, Table, message, Modal, Popconfirm } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import css from './profile.module.css';
import { trpc } from '../../utils/trpc';
import copy from 'copy-to-clipboard';
import { Key } from '../../utils/dmpCrypto/dmp.key';
import { useQueryClient } from '@tanstack/react-query';
import { IPubkey } from '@itmat-broker/itmat-types';

export const MyKeys: FunctionComponent = () => {
    const whoAmI = trpc.user.whoAmI.useQuery();
    const getUserKeys = trpc.user.getUserKeys.useQuery({ userId: whoAmI.data.id });
    const queryClient = useQueryClient();
    const deletePubkey = trpc.user.deletePubkey.useMutation({
        onSuccess: (data) => {
            void message.success('Key deleted.');
            const queryKey = [['user', 'getUserKeys'], { input: { userId: whoAmI.data.id }, type: 'query' }];
            const cache: IPubkey[] = queryClient.getQueryData(queryKey) ?? [];
            const newCache = cache.filter((el) => el.id !== data.id);
            queryClient.setQueryData(queryKey, newCache);
        },
        onError: () => {
            void message.error('Failed to delete this key.');
        }
    });
    if (whoAmI.isLoading || getUserKeys.isLoading) {
        return <>
            <div className='page_ariane'>Loading...</div>
            <div className='page_content'>
                <LoadSpinner />
            </div>
        </>;
    }
    if (whoAmI.isError || getUserKeys.isError) {
        return <>
            An error occured.
        </>;
    }

    const columns = [{
        title: 'Pubkey',
        dataIndex: 'pubkey',
        key: 'value',
        render: (__unused__value, record) => {
            const pubkey = record.pubkey ?? '';
            // Remove headers and footers from the public key
            const keyBody = pubkey.replace('-----BEGIN PUBLIC KEY-----', '')
                .replace('-----END PUBLIC KEY-----', '')
                .trim(); // Remove extra whitespace

            // Extract the first few characters of the key body
            const displayKey = keyBody.substring(0, 26) + '...'; // Adjust number of characters as needed
            return (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span>{displayKey}</span>
                    <Button
                        icon={<CopyOutlined />}
                        onClick={() => {
                            copy(pubkey);
                            void message.success('Publick key copied to clipboard');
                        }}
                        style={{ marginLeft: '8px' }}
                    />
                </div>
            );
        }
    }, {
        title: 'Created At',
        dataIndex: 'createdAt',
        key: 'value',
        render: (__unused__value, record) => {
            return (new Date(record.life.createdTime)).toDateString();
        }
    }, {
        title: '',
        dataIndex: 'delete',
        key: 'delete',
        render: (_, record) => {
            return <Popconfirm
                title="Are you sure to delete this key?"
                onConfirm={() => deletePubkey.mutate({
                    associatedUserId: whoAmI.data.id,
                    keyId: record.id
                })}
            >
                <Button danger>Delete</Button>
            </Popconfirm >;
        }
    }];
    return (<div className={css.key_wrapper}>
        <List
            header={
                <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className={css['overview-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div className={css['overview-icon']}></div>
                            <div>My Keys</div>
                        </div>
                    </div>
                    <div>
                        <KeyGeneration userId={whoAmI.data.id} />
                    </div>
                </div>
            }
        >
            <List.Item>
                <Table
                    style={{ width: '100%' }}
                    dataSource={getUserKeys.data}
                    columns={columns}
                />
            </List.Item>
        </List>

    </div>);
};

const KeyGeneration: React.FunctionComponent<{ userId: string }> = ({ userId }) => {
    const [isKeyGenOpen, setIsKeyGenOpen] = useState(false);
    const [completedKeypairGen, setcompletedKeypairGen] = useState(false);
    const [exportedKeyPair, setExportedKeyPair] = useState({ privateKey: '', publicKey: '' });
    const queryClient = useQueryClient();
    const registerPubkey = trpc.user.registerPubkey.useMutation({
        onSuccess: (data) => {
            void message.success('Key registered.');
            const queryKey = [['user', 'getUserKeys'], { input: { userId: userId }, type: 'query' }];
            const cache: IPubkey[] = queryClient.getQueryData(queryKey) ?? [];
            const newCache = [...cache, data];
            queryClient.setQueryData(queryKey, newCache);
        },
        onError: () => {
            void message.error('Failed to register this key.');
        }
    });

    const [downloadLink, setDownloadLink] = useState('');
    // function for generating file and set download link
    const makeTextFile = (filecontent: string) => {
        const data = new Blob([filecontent], { type: 'text/plain' });
        // Avoid memory leaks
        if (downloadLink !== '') window.URL.revokeObjectURL(downloadLink);
        // Update the download link state
        setDownloadLink(window.URL.createObjectURL(data));
    };

    const hashedPrivateKey = async (privateKey) => {
        const encoder = new TextEncoder();
        const privateKeyBuffer = encoder.encode(privateKey);

        // Compute the SHA-256 hash
        const hashBuffer = await crypto.subtle.digest('SHA-256', privateKeyBuffer);

        // Convert the hash to a hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
        return hashHex;
    };

    return (
        <div>
            <Button type='primary' onClick={() => setIsKeyGenOpen(true)}>Generate a Key Pair</Button>
            <Modal
                title='Generate a new key pair'
                open={isKeyGenOpen}
                width={'80%'}
                onOk={() => {
                    void (async () => {
                        await registerPubkey.mutate({
                            pubkey: exportedKeyPair.publicKey,
                            hashedPrivateKey: await hashedPrivateKey(exportedKeyPair.privateKey),
                            associatedUserId: userId
                        });
                    })();
                    setIsKeyGenOpen(false);
                }}
                okText={completedKeypairGen ? 'Register this key pair' : 'Ok'}
                onCancel={() => {
                    setIsKeyGenOpen(false);
                }}
            >
                <Button type='primary' onClick={() => {
                    void (async () => {
                        const keyPair = await cryptoInBrowser.keyGen();
                        const exportedKeyPair = await Key.exportRSAKey(keyPair);
                        setExportedKeyPair(exportedKeyPair);
                        setcompletedKeypairGen(true);
                    })();
                }}>
                    Do not have public/private keypair? Generate one (In-browser)!
                </Button><br /><br />
                {
                    completedKeypairGen ? <div>
                        Public key:
                        <a download='publicKey.pem' href={downloadLink}>
                            <Button onClick={() => makeTextFile(exportedKeyPair.publicKey)}>
                                Save the public key (PEM file)
                            </Button>
                        </a><br /><br />
                        Secret key:
                        <a download='privateKey.pem' href={downloadLink}>
                            <Button onClick={() => makeTextFile(exportedKeyPair.privateKey)}>
                                Save the private key (PEM file)
                            </Button>
                        </a><br />
                    </div>
                        : null
                }
            </Modal>
        </div >
    );
};

export const cryptoInBrowser = {
    keyGen: async function () {
        return Key.createRSAKey();
    },
    signGen: async function (message: string, signKey: CryptoKey) {
        return Key.signwtRSAKey(message, signKey);
    }
};
