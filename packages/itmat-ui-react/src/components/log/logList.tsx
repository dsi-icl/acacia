import { Models, GET_LOGS, userTypes, LOG_ACTION } from 'itmat-commons';
import * as React from 'react';
import { Query } from 'react-apollo';
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
        const keysMap = keys.map((el) => <><span>{el}</span><br/></> );
        const valuesMap = keys.map((el) => <><span>{obj[el]}</span><br/></> );
        return [keysMap, valuesMap];
    }

    return (
        <tr>
            <td>{data.requesterName}</td>
            <td>{data.requesterType}</td>
            <td>{data.logType}</td>
            <td>{data.actionType === null ? 'NA' : data.actionType}</td>
            { verbose ? <td>{formatActionData()[0]}</td> : null }
            { verbose ? <td>{formatActionData()[1]}</td> : null }
            <td>{new Date(data.time).toUTCString()}</td>
            <td>{data.status}</td>
        </tr>
    );
};

const LogList: React.FunctionComponent<{ list: Models.Log.ILogEntry[] }> = ({ list }) => {
    const [inputs, setInputs]: [{ [key: string]: any }, any] = React.useState({
        requesterName: '',
        requesterType: '',
        logType: '',
        actionType: '',
        time: '',
        status: ''
    });
    const [verbose, setVerbose] = React.useState(true);

    const inputControl = (property: string) => ({
        value: inputs[property],
        onChange: (e: any) => {
            setInputs({ ...inputs, [property]: e.target.value });
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
                return <Log key={el.id} data={el} verbose={!verbose} />;
            };
        }
        return (el: Models.Log.ILogEntry) => {
            if (
                (inputs.requesterName === '' || el.requesterName.toLowerCase().indexOf(inputs.requesterName.toLowerCase()) !== -1)
                && (inputs.requesterType === '' || el.requesterType === inputs.requesterType)
                && (inputs.logType === '' || el.logType === inputs.logType)
                && (inputs.actionType === '' || inputs.actionType === LOG_ACTION[el.actionType])
                && (inputs.status === '' || el.status === inputs.status)
            ) {
                return <Log key={el.id} data={el} verbose={!verbose}/>;
            }
            return null;
        };
    }

    return (
        <div className={css.user_list}>
            <table>
                <thead>
                    <tr>
                        <th>
                            <label>Requester Name</label>
                            <input name='searchRequesterName' {...inputControl('requesterName')} />
                        </th>
                        <th>
                            <label>Requester Type</label>
                            <select {...inputControl('requesterType')} >
                                <option value=''>All</option>
                                {Object.keys(userTypes).map((el) => <option value={el}>{el}</option>)}
                            </select>
                        </th>
                        <th>
                            <label>Log Type</label>
                            <select {...inputControl('logType')} >
                                <option value=''>All</option>
                                {Object.keys(Models.Log.LOG_TYPE).map((el) => <option value={el}>{el}</option>)}
                            </select>
                        </th>
                        <th>
                            <label>Action Type</label>
                            <select {...inputControl('actionType')} >
                                <option value=''>All</option>
                                {Object.keys(Models.Log.LOG_ACTION).map((el) => <option value={el}>{LOG_ACTION[el]}</option>)}
                            </select>
                        </th>
                        <th>
                            <label>Status</label>
                            <select {...inputControl('status')} >
                                <option value=''>All</option>
                                {Object.keys(Models.Log.LOG_STATUS).map((el) => <option value={el}>{el}</option>)}
                            </select>
                        </th>
                        <th>
                            <label>Verbose</label>
                            <label className={css.switch}>
                                <input type='checkbox' onClick={() => setVerbose(!verbose)}/>
                                <span className={css.slider} ></span>
                            </label>
                        </th>
                        <th />
                        <th />
                        {/* <th><NavLink to='/users/createNewUser' activeClassName={css.button_clicked}><button>Create new user</button></NavLink></th> */}
                    </tr>
                </thead>
            </table>

            <table>
                <thead>
                    <tr>
                        <th>Requester Name</th>
                        <th>Requester Type</th>
                        <th>Log Type</th>
                        <th>Action Type</th>
                        {!verbose ? <th colSpan={2}>Action Data</th> : null}
                        <th>Time</th>
                        <th>Status</th>
                        <th></th>
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

    );
};
