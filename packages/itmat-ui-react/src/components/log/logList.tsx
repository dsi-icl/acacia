import { Models, GET_LOGS, userTypes, LOG_ACTION, LOG_TYPE, LOG_STATUS } from 'itmat-commons';
import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import LoadSpinner from '../reusable/loadSpinner';
import { Table, Input, Button, Checkbox, Descriptions, DatePicker } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import Highlighter from 'react-highlight-words';
import moment from 'moment';

export const LogListSection: React.FunctionComponent = () => {

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
                            Error :(
                            {error.message}
                        </p>
                    );
                }
                const logList: Models.Log.ILogEntry[] = data.getLogs;
                return (
                    <LogList list={logList} />
                );
            }}
        </Query>
    );
};

const LogList: React.FunctionComponent<{ list: Models.Log.ILogEntry[] }> = ({ list }) => {
    const [searchTerm, setSearchTerm] = React.useState('');
    const initInputs = {
        requesterName: '',
        requesterType: [],
        logType: [],
        actionType: [],
        time: '',
        status: [],
        dateRange: ['', '']
    };
    const [inputs, setInputs]: [{ [key: string]: any }, any] = React.useState(initInputs);
    const [verbose, setVerbose] = React.useState(false);
    const [verboseInfo, setVerboseInfo] = React.useState(({ actionData: JSON.stringify({}) }));
    const [advancedSearch, setAdvancedSearch] = React.useState(false);
    const dateFormat = 'YYYY-MM-DD';
    function formatActionData(data: any) {
        const obj = JSON.parse(data.actionData);
        const keys = Object.keys(obj);
        const keysMap = keys.map((el) => <><span>{el}</span><br /></>);
        const valuesMap = keys.map((el) => <><span>{obj[el].toString()}</span><br /></>);
        return { keyList: keysMap, valueList: valuesMap };
    }
    /* time offset, when filter by time, adjust all date to utc time */
    const timeOffset = moment().zone() /* minutes */ * 60 /* seconds */ * 1000 /* to UNIX millisec */;

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

    function dataSourceFilter(logList: Models.ILogEntry[]) {
        return logList.filter(log =>
            (searchTerm === '' || (log.requesterName.toUpperCase().search(searchTerm) > -1 || log.requesterType.toUpperCase().search(searchTerm) > -1
                || log.logType.toUpperCase().search(searchTerm) > -1 || log.actionType.toUpperCase().search(searchTerm) > -1
                || new Date(log.time).toUTCString().toUpperCase().search(searchTerm) > -1 || log.status.toUpperCase().search(searchTerm) > -1))
            && (inputs.requesterName === '' || log.requesterName.toLowerCase().indexOf(inputs.requesterName.toLowerCase()) !== -1)
            && (inputs.requesterType.length === 0 || inputs.requesterType.includes(log.requesterType))
            && (inputs.logType.length === 0 || inputs.logType.includes(log.logType))
            && (inputs.actionType.length === 0 || inputs.actionType.includes(log.actionType))
            && (inputs.status.length === 0 || inputs.status.includes(log.status))
            && (inputs.dateRange[0] === '' || (moment(inputs.dateRange[0].startOf('day')).valueOf() - timeOffset) < log.time)
            && (inputs.dateRange[1] === '' || (moment(inputs.dateRange[1].startOf('day')).valueOf() + 24 * 60 * 60 * 1000 /* ONE DAY IN MILLSEC */ - timeOffset) > log.time)
        );
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
            title: 'Operation Type',
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
                if (searchTerm)
                    return <Highlighter searchWords={[searchTerm]} textToHighlight={new Date(record.time).toUTCString()} highlightStyle={{
                        backgroundColor: '#FFC733',
                        padding: 0
                    }} />;
                else
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
            <Descriptions title='Log Type'></Descriptions>
            <Checkbox.Group options={Object.keys(LOG_TYPE)} {...checkboxControl('logType')} style={{ marginBottom: '20px' }} />
            <Descriptions title='Request Type'></Descriptions>
            <Checkbox.Group options={Object.values(LOG_ACTION)} {...checkboxControl('actionType')} style={{ marginBottom: '20px' }} />
            <Descriptions title='Status'></Descriptions>
            <Checkbox.Group options={Object.keys(LOG_STATUS)} {...checkboxControl('status')} style={{ marginBottom: '20px' }} />
            <Descriptions title='Date Range'></Descriptions>
            <DatePicker.RangePicker
                defaultValue={[moment('2015-06-06', dateFormat), moment('2015-06-06', dateFormat)]}
                {...inputControl('dateRange')}
            />
        </Modal>
        <Table
            rowKey={(rec) => rec.id}
            onRow={(record: Models.ILogEntry) => ({
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
            >
            </Table>
        </Modal>
    </>;
};
