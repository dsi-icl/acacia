import { Models, GET_LOGS, userTypes, LOG_ACTION, LOG_TYPE, LOG_STATUS } from 'itmat-commons';
import * as React from 'react';
import { Query } from '@apollo/client/react/components';
import { LoadingBalls } from '../reusable/icons/loadingBalls';
import css from './logList.module.css';
export const LogListSection: React.FunctionComponent = () => {

    return (
        <Query<any, any>
            query={GET_LOGS}
            variables={{}}
        >
            {({ loading, error, data }) => {
                if (loading) { return <LoadingBalls />; }
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

const Log: React.FunctionComponent<{ data: Models.Log.ILogEntry, verbose: boolean }> = ({ data, verbose }) => {
    function formatActionData() {
        const obj = JSON.parse(data.actionData);
        const keys = Object.keys(obj);
        const keysMap = keys.map((el) => <><span>{el}</span><br /></>);
        const valuesMap = keys.map((el) => <><span>{obj[el].toString()}</span><br /></>);
        return [keysMap, valuesMap];
    }
    return (
        <tr>
            <td>{data.requesterName}</td>
            <td>{data.requesterType}</td>
            <td>{data.logType}</td>
            <td>{data.actionType === null ? 'NA' : data.actionType}</td>
            {verbose ? <td>{formatActionData()[0]}</td> : null}
            {verbose ? <td>{formatActionData()[1]}</td> : null}
            <td>{new Date(data.time).toUTCString()}</td>
            <td>{data.status}</td>
        </tr>
    );
};

const LogList: React.FunctionComponent<{ list: Models.Log.ILogEntry[] }> = ({ list }) => {
    const [inputs, setInputs]: [{ [key: string]: any }, any] = React.useState({
        requesterName: '',
        requesterType: { ...Object.keys(userTypes).reduce((a, b) => ({ ...a, [b]: false }), {}), all: true },
        logType: { ...Object.keys(LOG_TYPE).reduce((a, b) => ({ ...a, [b]: false }), {}), all: true },
        actionType: { ...Object.keys(LOG_ACTION).reduce((a, b) => ({ ...a, [b]: false }), {}), all: true },
        time: '',
        status: { ...Object.keys(LOG_STATUS).reduce((a, b) => ({ ...a, [b]: false }), {}), all: true },
        startDate: '',
        endDate: ''
    });
    const [verbose, setVerbose] = React.useState(false);

    // style
    const input_checkbox_color: React.CSSProperties = {
        color: 'blue'
    };

    const inputControl = (property: string) => ({
        value: inputs[property],
        onChange: (e: any) => {
            setInputs({ ...inputs, [property]: e.target.value });
        }
    });

    const checkboxControl = (property: string, subProperty: string) => ({
        checked: inputs[property][subProperty],
        onChange: (e: any) => {
            setInputs({ ...inputs, [property]: { ...inputs[property], [subProperty]: e.target.checked } });
        }
    });
    function checkInputsAllEmpty() {
        let key: any;
        for (key in inputs) {
            if (inputs[key] !== '') {
                return false;
            }
        }
        return true;
    }

    function highermappingfunction() {
        if (checkInputsAllEmpty() === true) {
            return (el: Models.Log.ILogEntry) => {
                return <Log key={el.id} data={el} verbose={verbose} />;
            };
        }
        return (el: Models.Log.ILogEntry) => {
            const findKey = Object.keys(LOG_ACTION).find(key => LOG_ACTION[key] === el.actionType);
            const usedKey = findKey === undefined ? 'all' : findKey;
            if (
                (inputs.requesterName === '' || el.requesterName.toLowerCase().indexOf(inputs.requesterName.toLowerCase()) !== -1)
                && (inputs.requesterType.all === true || inputs.requesterType[el.requesterType] === true)
                && (inputs.logType.all === true || inputs.logType[el.logType] === true)
                && (inputs.actionType.all === true || inputs.actionType[usedKey] === true)
                && (inputs.status.all === true || inputs.status[el.status] === true)
                && (inputs.startDate === '' || new Date(inputs.startDate).valueOf() < el.time)
                && (inputs.endDate === '' || (new Date(inputs.endDate).valueOf() + 24 * 60 * 60 * 1000 /* ONE DAY IN MILLSEC */) > el.time)
            ) {
                return <Log key={el.id} data={el} verbose={verbose} />;
            }
            return null;
        };
    }

    return (
        <div>
            <div>
                <table>
                    <thead>
                        <tr>
                            <th>
                                <label>Requester Name</label>
                            </th>
                            <th>
                                <input style={input_checkbox_color} name='searchRequesterName' {...inputControl('requesterName')} />
                            </th>
                        </tr>
                        <tr>
                            <th>
                                <label>Requester Type</label>
                            </th>
                            <th>
                                <label style={input_checkbox_color}><input type='checkbox' {...checkboxControl('requesterType', 'all')} />All</label>
                                {Object.keys(userTypes).map((el) => <label style={input_checkbox_color}><input type='checkbox' {...checkboxControl('requesterType', el)} />{el}</label>)}
                            </th>
                        </tr>
                        <tr>
                            <th>
                                <label>Log Type</label>
                            </th>
                            <th>
                                <label style={input_checkbox_color}><input type='checkbox' {...checkboxControl('logType', 'all')} />All</label>
                                {Object.keys(LOG_TYPE).map((el) => <label style={input_checkbox_color}><input type='checkbox' {...checkboxControl('logType', el)} />{el}</label>)}
                            </th>
                        </tr>
                        <tr>
                            <th>
                                <label>Action Type</label>
                            </th>
                            <th>
                                <label style={input_checkbox_color}><input type='checkbox' {...checkboxControl('actionType', 'all')} />All</label>
                                {Object.keys(LOG_ACTION).map((el) => <label style={input_checkbox_color}><input type='checkbox' {...checkboxControl('actionType', el)} />{el}</label>)}
                            </th>
                        </tr>
                        <tr>
                            <th>
                                <label>Status</label>
                            </th>
                            <th>
                                <label style={input_checkbox_color}><input type='checkbox' {...checkboxControl('status', 'all')} />All</label>
                                {Object.keys(LOG_STATUS).map((el) => <label style={input_checkbox_color}><input type='checkbox' {...checkboxControl('status', el)} />{el}</label>)}
                            </th>
                        </tr>
                        <tr>
                            <th>
                                <label>Start Date</label>
                            </th>
                            <th>
                                <input style={input_checkbox_color} name='startDate' type='date' {...inputControl('startDate')} />
                            </th>
                        </tr>
                        <tr>
                            <th>
                                <label>End Date</label>
                            </th>
                            <th>
                                <input style={input_checkbox_color} name='endDate' type='date' {...inputControl('endDate')} />
                            </th>
                        </tr>
                        <tr>
                            <th>
                                <label>Verbose</label>
                                <label className={css.switch}>
                                    <input type='checkbox' onClick={() => setVerbose(!verbose)} />
                                    <span className={css.slider} ></span>
                                </label>
                            </th>
                        </tr>
                    </thead>
                </table>
            </div>

            <div className={css.log_list}>
                <table>
                    <thead>
                        <tr>
                            <th>Requester Name</th>
                            <th>Requester Type</th>
                            <th>Log Type</th>
                            <th>Action Type</th>
                            {verbose ? <th colSpan={2}>Action Data</th> : null}
                            <th>Time</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {verbose ?
                            <tr>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td>Field</td>
                                <td>Value</td>
                                <td></td>
                                <td></td>
                            </tr> : null
                        }
                        {list.map(highermappingfunction())}
                    </tbody>
                </table>
            </div>
        </div>

    );
};
