import React, { FunctionComponent, useState, useEffect} from 'react';
import { Button, message, Modal, Form, Select,  Card, Tag, Progress,  Space, Row, Col , Tooltip} from 'antd';
import { trpc } from '../../utils/trpc';
import css from './instance.module.css';
import { enumAppType,enumInstanceType, enumInstanceStatus, LXDInstanceTypeEnum, enumOpeType, IUserConfig} from '@itmat-broker/itmat-types';

const { Option } = Select;

type CreateInstanceFormValues = {
    name: string;
    type: LXDInstanceTypeEnum;
    appType: enumAppType;
    instanceType: enumInstanceType;
    lifeSpan: number;
    project: string;
    cpuLimit: number;
    memoryLimit: string;
    diskLimit: string;
};

type FlavorDetails = {
    cpuLimit: number;
    memoryLimit: string;
    diskLimit: string;
};


export const InstanceSection: FunctionComponent = () => {

    const [selectedInstanceTypeDetails, setSelectedInstanceTypeDetails] = useState('');
    const [isConnectingToJupyter, setIsConnectingToJupyter] = useState(false);

    const [isConnectingToVNC, setIsConnectingToVNC] = useState(false);

    const [isAtOrOverQuota, setIsAtOrOverQuota] = useState(false);

    // quota (user) and flavor (system)
    const { data: quotaAndFlavors } = trpc.instance.getQuotaAndFlavors.useQuery<{
            userQuota: IUserConfig;
            userFlavors: { [key: string]: FlavorDetails };
        }>();

    const getInstances = trpc.instance.getInstances.useQuery(undefined, {
        refetchInterval: 2 * 60 * 1000,
        refetchIntervalInBackground: true, // Continue refetching when tab is in background
        refetchOnWindowFocus: true, // Refetch when window regains focus
        refetchOnReconnect: true, // Refetch when reconnecting
        retry: 3, // Number of retry attempts
        onError: (error) => {
            console.error('Failed to fetch instances:', error);
        }
    });


    // Recalculate `isAtOrOverQuota` whenever quota or instances data changes
    useEffect(() => {
        if (getInstances.data && quotaAndFlavors) {
            const runningInstancesCount = getInstances.data.length;
            const maxInstancesAllowed = quotaAndFlavors.userQuota.defaultLXDMaximumInstances || 0;
            setIsAtOrOverQuota(runningInstancesCount >= maxInstancesAllowed);
        }
    }, [getInstances.data, quotaAndFlavors]);


    const createInstance = trpc.instance.createInstance.useMutation({
        onSuccess: async () => {
            void message.success('Instance created successfully.');
            await getInstances.refetch();
        },
        onError: (error) => {
            void message.error(`Failed to create instance: ${error.message}`);
        }
    });
    const deleteInstance = trpc.instance.deleteInstance.useMutation({
        onSuccess: async () => {
            void message.success('Instance deleted successfully.');
            await getInstances.refetch();
        },
        onError: (error) => {
            void message.error(`Failed to delete instance: ${error.message}`);
        }
    });
    const startStopInstance = trpc.instance.startStopInstance.useMutation({
        onSuccess: async () => {
            void message.success('Instance status changed successfully.');
            await  getInstances.refetch();
        },
        onError: (error) => {
            void message.error(`Failed to change instance status: ${error.message}`);
        }
    });
    const restartInstance = trpc.instance.restartInstance.useMutation({
        onSuccess: async () => {
            void message.success('Instance restarted successfully.');
            await getInstances.refetch(); // refetch the instances to update the list
        },
        onError: (error) => {
            void message.error(`Failed to restart instance: ${error.message}`);
        }
    });

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [createForm] = Form.useForm<CreateInstanceFormValues>();

    // Define the initial form values including the default instanceType
    const initialFormValues: Partial<CreateInstanceFormValues> = {
        instanceType: enumInstanceType.SMALL,
        lifeSpan: quotaAndFlavors?.userQuota?.defaultLXDMaximumInstanceLife ?? 360 * 60 * 60 * 1000 // Default to 360 hours if no user quota
    };

    useEffect(() => {
        if (quotaAndFlavors?.userFlavors && quotaAndFlavors.userFlavors[enumInstanceType.SMALL]) {

            const { cpuLimit, memoryLimit, diskLimit } = quotaAndFlavors.userFlavors[enumInstanceType.SMALL];
            setSelectedInstanceTypeDetails(`${cpuLimit} CPU, ${memoryLimit} memory, ${diskLimit} disk`);
        }
    }, [quotaAndFlavors]);


    const handleCreateInstance = (values: CreateInstanceFormValues) => {

        const generatedName = `${values.appType}-${Date.now()}`;
        const determinedType = values.appType === enumAppType.DESKTOP ? LXDInstanceTypeEnum.VIRTUAL_MACHINE: LXDInstanceTypeEnum.CONTAINER;
        // get the cpu, memorylimit, disk limit from the backend server
        // Get the flavor details from the selected type
        const flavorDetails = quotaAndFlavors?.userFlavors[values.instanceType];
        if (!flavorDetails) {
            void message.error('Invalid instance type selected.');
            return;
        }
        // Use user-defined maximum instance life or default value
        const effectiveLifeSpan = values.lifeSpan ?? (quotaAndFlavors?.userQuota?.defaultLXDMaximumInstanceLife || 360 * 60 * 60 * 1000);

        createInstance.mutate({
            name: generatedName,
            type: determinedType,
            appType: values.appType,
            lifeSpan: effectiveLifeSpan,
            cpuLimit: flavorDetails.cpuLimit,
            memoryLimit: flavorDetails.memoryLimit,
            diskLimit: flavorDetails.diskLimit
        });
        setIsModalOpen(false);
        createForm.resetFields();
    };

    const handleRestartInstance = async (values: { instance_id: string, lifeSpan: number }) => {
        restartInstance.mutate({
            instanceId:values.instance_id,
            lifeSpan: values.lifeSpan
        });

    };

    const connectToJupyterHandler = async (instance_id: string) => {
        setIsConnectingToJupyter(true); // Indicate that connection attempt is in progress

        try {
            // // Construct the Jupyter proxy URL directly
            const baseUrl = new URL(window.location.href);
            const jupyterProxyUrl = `${baseUrl.origin}/jupyter/${instance_id}`;

            // Open the Jupyter service in a new tab
            window.open(jupyterProxyUrl, '_blank');
            // Construct the Jupyter proxy URL for WebSocket connection


        } catch (error: unknown) {
            if (error instanceof Error) {
                void message.error(error.message || 'Failed to connect to Jupyter. Please try again.');
            } else {
                void message.error('Failed to connect to Jupyter. Please try again.');
            }
        } finally {
            setIsConnectingToJupyter(false); // Reset the connection attempt status
        }
    };


    // instanceActions.tsx
    const connectToVNCHandler = async (instance_id: string) => {
        setIsConnectingToVNC(true);

        try {
            const baseUrl = new URL(window.location.href);
            const vncProxyUrl = `${baseUrl.origin}/matlab/${instance_id}/vnc_auto.html?path=matlab/${instance_id}/websockify`;

            // Open VNC viewer in new tab
            window.open(vncProxyUrl, '_blank');
        } catch (error: unknown) {
            if (error instanceof Error) {
                void message.error(error.message || 'Failed to connect to VNC viewer');
            } else {
                void message.error('Failed to connect to VNC viewer');
            }
        } finally {
            setIsConnectingToVNC(false);
        }
    };

    const handleDeleteInstance = (instance) => {
        Modal.confirm({
            title: (
                <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                    Confirm Deletion
                </span>
            ),
            content: (
                <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    <p>
                        <strong>Warning:</strong> You are about to delete the instance <strong>"{instance.name}"</strong>.
                    </p>
                    <p>
                        <span style={{ color: '#fa8c16' }}>
                            All data inside this instance will be permanently removed.
                        </span>
                    </p>
                    <p>This action <strong>cannot</strong> be undone. Please proceed with caution.</p>
                </div>
            ),
            okText: 'Yes, delete it',
            okType: 'danger',
            cancelText: 'No, cancel',
            onOk: () => {
                deleteInstance.mutate({ instanceId: instance.id });
            }
        });
    };

    if (getInstances.isLoading) {
        return <div>Loading instances...</div>;
    }

    if (getInstances.isError) {
        return <div>Error loading instances: {getInstances.error.message}</div>;
    }

    const getStatusTagColor = (status: enumInstanceStatus) => {
        switch (status) {
            case enumInstanceStatus.PENDING:
                return '#ffecb3';
            case enumInstanceStatus.RUNNING:
                return '#87d068';
            case enumInstanceStatus.STOPPING:
                return '#ffd8bf';
            case enumInstanceStatus.STOPPED:
                return '#d9d9d9';
            case enumInstanceStatus.DELETED:
                return '#f50';
            default:
                return 'default';
        }
    };

    // sorting function
    const sortedInstances = [...getInstances.data].sort((a, b) => {
        if (a.status === enumInstanceStatus.RUNNING && b.status !== enumInstanceStatus.RUNNING) {
            return -1;
        }
        if (b.status === enumInstanceStatus.RUNNING && a.status !== enumInstanceStatus.RUNNING) {
            return 1;
        }
        if (a.status === enumInstanceStatus.FAILED && b.status !== enumInstanceStatus.FAILED) {
            return 1;
        }
        if (b.status === enumInstanceStatus.FAILED && a.status !== enumInstanceStatus.FAILED) {
            return -1;
        }
        // Within the same status, sort by creation time, most recent first
        return new Date(b.createAt).getTime() - new Date(a.createAt).getTime();
    });


    return (
        <div className={css.page_container}>
            <div className={css.marginBottom}>
                <div style={{ marginTop: '10px' }} />
                <Space size="large"> {}
                    <h2 style={{ marginBottom: '0px' }}>My Instances</h2>
                    <Tooltip
                        title={
                            isAtOrOverQuota
                                ? `Over the quota of ${quotaAndFlavors?.userQuota.defaultLXDMaximumInstances} instances. Please delete an instance to create a new one.`
                                : ''
                        }
                    >
                        <Button
                            type="primary"
                            size="large"
                            style={{ backgroundColor: '#108ee9', borderColor: '#108ee9' }}
                            onClick={() => setIsModalOpen(true)}
                            disabled={isAtOrOverQuota} // Disable button if over quota
                        >
                            Create New Instance
                        </Button>
                    </Tooltip>
                    {/* <Button
                        type="default"
                        size="large" // Match the size with "Create New Instance" button
                        style={{
                            borderColor: '#108ee9',
                            color: '#108ee9'
                        }}
                        href="/pun/sys/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                    Go back to old AE v2
                    </Button> */}
                </Space>

            </div>
            <div style={{ marginTop: '50px' }} />

            {sortedInstances.map((instance) => (
                <Card
                    key={instance.id}
                    // headStyle={{ backgroundColor: getStatusTagColor(instance.status) }}
                    styles={{ header: { backgroundColor: getStatusTagColor(instance.status) } }}
                    style={{ maxWidth: '600px', margin: '20px', overflow: 'auto' }}
                    title={<span>{instance.name}</span>}
                    extra={<Tag color={getStatusTagColor(instance.status)}>{instance.status}</Tag>}
                    className={css.cardContainer}
                >
                    <Row>
                        <Col span={16}>
                            <p>Application Type: {instance.appType}</p>
                            <p>Created At: {new Date(instance.createAt).toLocaleString()}</p>
                            <p>Life Span: <strong>{(Number(instance.lifeSpan) / 1000 / 3600 ).toFixed(2)}</strong> (hours)</p>
                            <p>
                                CPU: {instance.config && typeof instance.config['limits.cpu'] === 'string' ? instance.config['limits.cpu'] : 'N/A'} Cores,
                                Memory: {instance.config && typeof instance.config['limits.memory'] === 'string' ? instance.config['limits.memory'] : 'N/A'}
                            </p>
                        </Col>
                        <Col span={8}>
                            {instance.status === enumInstanceStatus.RUNNING && (
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    <Progress
                                        percent={('cpuUsage' in instance.metadata) ? instance.metadata.cpuUsage as number : 0}
                                        status="active"
                                        format={() => (
                                            <span style={{ fontSize: '12px' }}>
                                            CPU: {('cpuUsage' in instance.metadata) ? instance.metadata.cpuUsage as number : 0}%
                                            </span>
                                        )}
                                        size="default"
                                        style={{ width: '150px' }} // Adjust width
                                    />
                                    <Progress
                                        percent={('memoryUsage' in instance.metadata) ? instance.metadata.memoryUsage as number : 0}
                                        status="active"
                                        format={() => (
                                            <span style={{ fontSize: '12px' }}>
                                            Memory: {('memoryUsage' in instance.metadata) ? Math.round(instance.metadata.memoryUsage as number) : 0}%
                                            </span>
                                        )}
                                        size="default"
                                        style={{ width: '150px' }} // Adjust width
                                    />
                                </Space>
                            )}
                        </Col>
                    </Row>
                    {/* Conditionally render Launch/Stop button based on status */}
                    <Space>
                        {instance.status === enumInstanceStatus.STOPPED && instance.lifeSpan > 0 && (
                            <Button type="primary" style={{ backgroundColor: '#87d068', borderColor: '#87d068', marginRight: '8px' }} onClick={() => startStopInstance.mutate({ instanceId: instance.id, action: enumOpeType.START })}>Launch</Button>
                        )}
                        {instance.status === enumInstanceStatus.RUNNING && (
                            // change the danger to warning color
                            <Button type="primary" danger style={{ backgroundColor: '#ffe7ba', borderColor: '#ffd591', color: '#fa8c16', marginRight: '8px' }}  onClick={() => startStopInstance.mutate({ instanceId: instance.id, action: enumOpeType.STOP })}>Stop</Button>
                            // <Button type="primary" danger style={{ marginRight: '8px' }} onClick={() => startStopInstance.mutate({ instanceId: instance.id, action: 'stop' })}>Stop</Button>
                        )}
                        {/* Only show Delete button for STOPPED status */}
                        {(instance.status === enumInstanceStatus.STOPPED || instance.status === enumInstanceStatus.FAILED) && (
                            <Button type="primary" danger style={{ backgroundColor: '#ff4d4f', borderColor: '#ff4d4f', marginRight: '8px' }} onClick={() => handleDeleteInstance(instance)}>Delete</Button>
                        )}
                        {/*Restart button to reset the instance with new lifespan */}
                        {instance.status === enumInstanceStatus.STOPPED && instance.lifeSpan <= 0 && (
                            <Button type="primary" style={{ backgroundColor: '#2db7f5', borderColor: '#2db7f5', marginRight: '8px' }}
                                onClick={() => {
                                    void handleRestartInstance({ instance_id: instance.id, lifeSpan: 360 * 60 * 60 * 1000 });
                                }}>Restart</Button>
                        )}
                        {/** console connection button, only show for RUNNING status */}
                        {instance.appType === enumAppType.MATLAB && instance.status === enumInstanceStatus.RUNNING &&  (
                            // set the button color to green
                            <Button type="primary"
                                style={{ backgroundColor: '#1890ff', borderColor: '#1890ff', marginRight: '8px' }}
                                // onClick={() => handleConsoleConnect(instance)
                                onClick={() => {
                                    void connectToVNCHandler(instance.id);
                                }}
                                disabled={isConnectingToVNC} // Disable button during connection attempt
                            >Open Console</Button>
                        )}
                        {instance.appType === enumAppType.JUPYTER && instance.status === enumInstanceStatus.RUNNING && (
                            <Button
                                type="primary"
                                style={{ backgroundColor: '#1890ff', borderColor: '#1890ff', marginRight: '8px' }}
                                onClick={() => {
                                    void connectToJupyterHandler(instance.id);
                                }}
                                disabled={isConnectingToJupyter} // Disable button during connection attempt
                            >
                          Open Jupyter
                            </Button> )}
                    </Space>
                </Card>
            ))}
            <Modal title="Create New Instance" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => createForm.submit()}>
                <Form form={createForm}
                    layout="vertical"
                    onFinish={handleCreateInstance}
                    initialValues={initialFormValues}
                >
                    <Form.Item name="appType" label="Application Type" rules={[{ required: true, message: 'Please select the application type!' }]}>
                        <Select placeholder="Select an application type">
                            <Option value={enumAppType.JUPYTER}>Jupyter</Option>
                            <Option value={enumAppType.MATLAB}>MATLAB</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item
                        name="instanceType"
                        label="Instance Type"
                        rules={[{ required: true, message: 'Please select the instance type!' }]}>
                        <Select
                            placeholder="Select an instance type"
                            onChange={(value) => {
                                const flavorDetails = quotaAndFlavors?.userFlavors[value];
                                if (flavorDetails) {
                                    setSelectedInstanceTypeDetails(`${flavorDetails.cpuLimit} CPU, ${flavorDetails.memoryLimit} memory, ${flavorDetails.diskLimit} disk`);
                                }
                            }}
                        >

                            {quotaAndFlavors?.userFlavors && Object.keys(quotaAndFlavors.userFlavors).map((flavor) => (
                                <Option key={flavor} value={flavor}>
                                    {flavor.charAt(0).toUpperCase() + flavor.slice(1)} {/* Capitalize flavor name */}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                    {selectedInstanceTypeDetails && (
                        <div style={{ marginTop: '10px' }}>{selectedInstanceTypeDetails}</div>
                    )}
                </Form>
            </Modal>
        </div>
    );
};