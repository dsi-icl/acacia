import { FunctionComponent, useState } from 'react';
import { GET_LOGS } from '@itmat-broker/itmat-models';
import { userTypes, LOG_ACTION, LOG_TYPE, LOG_STATUS, USER_AGENT, ILogEntry } from '@itmat-broker/itmat-types';
import { Query } from '@apollo/client/react/components';
import LoadSpinner from '../reusable/loadSpinner';
import { Table, Input, Button, Checkbox, Descriptions, DatePicker, Modal } from 'antd';
import Highlighter from 'react-highlight-words';
import dayjs from 'dayjs';

export const LogListSection: FunctionComponent = () => {

    return (
        <Query<any, any>
            query={GET_LOGS}
            variables={{}}
        >
            {({ loading, error, data }) => {
                if (loading) { return <LoadSpinner />; }
                if (error) {
                    return (
                        <p>
                            Error {error.message}
                        </p>
                    );
                }
                const logList: ILogEntry[] = data.getLogs;
                return (
                    <LogList list={logList} />
                );
            }}
        </Query>
    );
};

const LogList: FunctionComponent<{ list: ILogEntry[] }> = ({ list }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const initInputs = {
        requesterName: '',
        requesterType: [],
        userAgent: [],
        logType: [],
        actionType: [],
        time: '',
        status: [],
        dateRange: ['', '']
    };
    const [inputs, setInputs]: [{ [key: string]: any }, any] = useState(initInputs);
    const [verbose, setVerbose] = useState(false);
    const [verboseInfo, setVerboseInfo] = useState(({ actionData: JSON.stringify({}) }));
    const [advancedSearch, setAdvancedSearch] = useState(false);
    const dateFormat = 'YYYY-MM-DD';
    function formatActionData(data: any) {
        const obj = JSON.parse(data.actionData);
        const keys = Object.keys(obj);
        const keysMap = keys.map((el) => <><span>{el}</span><br /></>);
        const valuesMap = keys.map((el) => <><span>{JSON.stringify((obj[el] || 'NA'))}</span><br /></>);
        return { keyList: keysMap, valueList: valuesMap };
    }
    /* time offset, when filter by time, adjust all date to utc time */
    const timeOffset = dayjs().utcOffset() /* minutes */ * 60 /* seconds */ * 1000 /* to UNIX millisec */;

    const inputControl = (property: string) => ({
        value: inputs[property],
        onChange: (e: any) => {
            setInputs({ ...inputs, [property]: property === 'requesterName' ? e.target.value : e });
        }
    });

    const checkboxControl = (property: string) => ({
        value: inputs[property],
        onChange: (e: any) => {
            setInputs({ ...inputs, [property]: e });
        }
    });
    function dataSourceFilter(logList: ILogEntry[]) {
        return logList.filter((log) => {
            // convert the contest of log to be string (except for value), as null could not be parsed
            const logCopy: any = { ...log };
            Object.keys(logCopy).forEach(item => {
                logCopy[item] = (logCopy[item] || '').toString();
            });
            return (searchTerm === '' || (logCopy.requesterName.toUpperCase().search(searchTerm) > -1 || logCopy.requesterType.toUpperCase().search(searchTerm) > -1
                || logCopy.logType.toUpperCase().search(searchTerm) > -1 || logCopy.actionType.toUpperCase().search(searchTerm) > -1
                || logCopy.status.toUpperCase().search(searchTerm) > -1 || logCopy.userAgent.toUpperCase().search(searchTerm) > -1
                || new Date(logCopy.time).toUTCString().toUpperCase().search(searchTerm) > -1 || logCopy.status.toUpperCase().search(searchTerm) > -1))
                && (inputs.requesterName === '' || logCopy.requesterName.toLowerCase().indexOf(inputs.requesterName.toLowerCase()) !== -1)
                && (inputs.requesterType.length === 0 || inputs.requesterType.includes(logCopy.requesterType))
                && (inputs.userAgent.length === 0 || inputs.userAgent.includes(logCopy.userAgent))
                && (inputs.logType.length === 0 || inputs.logType.includes(logCopy.logType))
                && (inputs.actionType.length === 0 || inputs.actionType.includes(logCopy.actionType))
                && (inputs.status.length === 0 || inputs.status.includes(logCopy.status))
                && (inputs.dateRange[0] === '' || (dayjs(inputs.dateRange[0].startOf('day')).valueOf() - timeOffset) < logCopy.time)
                && (inputs.dateRange[1] === '' || (dayjs(inputs.dateRange[1].startOf('day')).valueOf() + 24 * 60 * 60 * 1000 /* ONE DAY IN MILLSEC */ - timeOffset) > logCopy.time);
        });
    }

    const columns = [
        {
            title: 'Requester Name',
            dataIndex: 'requesterName',
            key: 'requesterName',
            render: (__unused__value, record) => {
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={record.requesterName} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return record.requesterName;
            }
        },
        {
            title: 'Requester Type',
            dataIndex: 'requesterType',
            key: 'requesterType',
            render: (__unused__value, record) => {
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={record.requesterType} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return record.requesterType;
            }
        },
        {
            title: 'Request Type',
            dataIndex: 'logType',
            key: 'logType',
            render: (__unused__value, record) => {
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={record.logType} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return record.logType;
            }
        },
        {
            title: 'Request From',
            dataIndex: 'userAgent',
            key: 'userAgent',
            render: (__unused__value, record) => {
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={record.userAgent} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return record.userAgent;
            }
        },
        {
            title: 'API Type',
            dataIndex: 'actionType',
            key: 'actionType',
            render: (__unused__value, record) => {
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={record.actionType} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return record.actionType;
            }
        },
        {
            title: 'Time',
            dataIndex: 'time',
            key: 'time',
            render: (__unused__value, record) => {
                return new Date(record.time).toUTCString();
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (__unused__value, record) => {
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={record.status} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
                    return record.status;
            }
        }
    ];

    const detailColumns = [
        {
            title: 'Field',
            dataIndex: 'keyList',
            key: 'keyList',
            render: (__unused__value, record) => {
                return record.keyList;
            }
        },
        {
            title: 'Value',
            dataIndex: 'valueList',
            key: 'valueList',
            render: (__unused__value, record) => {
                return record.valueList;
            }
        }
    ];

    return <>
        <Input.Search allowClear style={{
            maxWidth: '65%'
        }} defaultValue={searchTerm} value={searchTerm} placeholder='Search' onChange={({ target: { value } }) => setSearchTerm(value.toUpperCase())} />&nbsp;&nbsp;&nbsp;
        <Button type='primary' style={{
            verticalAlign: 'top',
            backgroundColor: 'grey'
        }} onClick={() => { setSearchTerm(''); setInputs(initInputs); }}>
            {advancedSearch ? null : 'Reset'}
        </Button>&nbsp;&nbsp;&nbsp;
        <Button type='primary' style={{
            verticalAlign: 'top'
        }} onClick={() => setAdvancedSearch(!advancedSearch)}>
            {advancedSearch ? null : 'Advanced Search'}
        </Button>
        <Modal
            title='Advanced Search'
            visible={advancedSearch}
            onOk={() => { setAdvancedSearch(false); }}
            onCancel={() => { setAdvancedSearch(false); }}
            okText='OK'
            cancelText='Reset'
        >
            <Descriptions title='Requester Name'    ></Descriptions>
            <Input {...inputControl('requesterName')} style={{ marginBottom: '20px' }} />
            <Descriptions title='Requester Type'></Descriptions>
            <Checkbox.Group options={Object.keys(userTypes)} {...checkboxControl('requesterType')} style={{ marginBottom: '20px' }} />
            <Descriptions title='Request From'></Descriptions>
            <Checkbox.Group options={Object.keys(USER_AGENT)} {...checkboxControl('userAgent')} style={{ marginBottom: '20px' }} />
            <Descriptions title='Log Type'></Descriptions>
            <Checkbox.Group options={Object.keys(LOG_TYPE)} {...checkboxControl('logType')} style={{ marginBottom: '20px' }} />
            <Descriptions title='Request Type'></Descriptions>
            <Checkbox.Group options={Object.values(LOG_ACTION)} {...checkboxControl('actionType')} style={{ marginBottom: '20px' }} />
            <Descriptions title='Status'></Descriptions>
            <Checkbox.Group options={Object.keys(LOG_STATUS)} {...checkboxControl('status')} style={{ marginBottom: '20px' }} />
            <Descriptions title='Date Range'></Descriptions>
            <DatePicker.RangePicker
                defaultValue={[dayjs('2015-06-06', dateFormat), dayjs('2015-06-06', dateFormat)]}
                {...inputControl('dateRange')}
            />
        </Modal>
        <Table
            rowKey={(rec) => rec.id}
            onRow={(record: ILogEntry) => ({
                onClick: () => {
                    setVerbose(true);
                    setVerboseInfo(record);
                },
                style: {
                    cursor: 'pointer'
                }
            })}
            pagination={
                {
                    defaultPageSize: 10,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    defaultCurrent: 1,
                    showQuickJumper: true
                }
            }
            columns={columns}
            dataSource={dataSourceFilter(list)}
            size='small'
        >
        </Table>
        <Modal
            title='Details'
            visible={verbose}
            onOk={() => { setVerbose(false); }}
            onCancel={() => { setVerbose(false); }}
        >
            <Table
                pagination={false}
                columns={detailColumns}
                dataSource={[formatActionData(verboseInfo)]}
                size='small'
                scroll={{ x: true }}
            >
            </Table>
        </Modal>
    </>;
};
