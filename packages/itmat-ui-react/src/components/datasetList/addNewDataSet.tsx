import * as React from 'react';
import { Query, useMutation } from 'react-apollo';
import { userTypes, WHO_AM_I, CREATE_STUDY, WRITE_LOG, LOG_ACTION, LOG_STATUS } from 'itmat-commons';
import { logFun } from '../../utils/logUtils';

export const AddNewDataSet: React.FunctionComponent = () => {
    const [showMore, setShowMore] = React.useState(false);
    const [createStudy, { loading: createStudyLoading, error: createStudyError }] = useMutation(CREATE_STUDY,
        { onCompleted: () => {
            setNewName('');
            setShowMore(false);
            logFun(writeLog, whoAmI, LOG_ACTION.CREATE_STUDY, {studyName: stduyName}, LOG_STATUS.SUCCESS);
        },
        refetchQueries: [{ query: WHO_AM_I }],
        onError: (err) => {
            logFun(writeLog, whoAmI, LOG_ACTION.CREATE_STUDY, {ERROR: err, studyName: stduyName}, LOG_STATUS.FAIL);
            return;
        } });
    const [newName, setNewName] = React.useState('');
    const [inputError, setInputError] = React.useState('');
    const [writeLog, { loading: writeLogLoading }] = useMutation(WRITE_LOG);
    const [whoAmI, setWhoAmI] = React.useState({});
    const [stduyName, setStudyName] = React.useState('');

    return (
        <Query<any, any>
            query={WHO_AM_I}
            pollInterval={5000}
        >
            {({ loading, error, data }) => {
                if (loading) { return <p>Loading...</p>; }
                if (error) { return <p>Error :( {error}</p>; }
                if (data.whoAmI && data.whoAmI.type && data.whoAmI.type === userTypes.ADMIN) {
                    return (
                        !showMore ?
                            <button onClick={() => setShowMore(true)}>Add new dataset</button>
                            :
                            <div>
                                <label>Enter name: <input value={newName} onChange={e => { setNewName(e.target.value); setInputError(''); }} type='text' /> </label>
                                <button className='button_grey' onClick={() => { setShowMore(false); setNewName(''); }}>Cancel</button>
                                {
                                    (createStudyLoading && writeLogLoading) ?
                                        <button>Loading...</button>
                                        :
                                        <button onClick={() => {
                                            if (newName === '') {
                                                setInputError('Please provide a study name.');
                                                return;
                                            }
                                            createStudy({ variables: { name: newName } });
                                            setStudyName(newName);
                                            setWhoAmI(data);
                                        }}>Submit</button>
                                }
                                {
                                    createStudyError ?
                                        <div className='error_banner'>Error creating study. Please contact admin.</div>
                                        :
                                        null
                                }
                                {
                                    inputError !== '' ?
                                        <div className='error_banner'>{inputError}</div>
                                        :
                                        null
                                }
                            </div>
                    );
                } else {
                    return null;
                }
            }}
        </Query>
    );
};
