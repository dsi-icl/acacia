import { Models } from 'itmat-commons';
import * as React from 'react';
import { Query, useMutation } from 'react-apollo';
import { NavLink, Redirect } from 'react-router-dom';
import { userTypes } from 'itmat-commons/dist/models/user';
import { WHO_AM_I } from 'itmat-commons/dist/graphql/user';
import { CREATE_STUDY } from 'itmat-commons/dist/graphql/study';

export const AddNewDataSet: React.FunctionComponent = (props) => {
    const [showMore, setShowMore] = React.useState(false);
    const [createStudy, { loading: createStudyLoading, error: createStudyError }] = useMutation(CREATE_STUDY, { onCompleted: () => { setNewName(''); setShowMore(false); }, refetchQueries: [{ query: WHO_AM_I }]});
    const [newName, setNewName] = React.useState('');
    return (
        <Query
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
                            <label>Enter name: <input value={newName} onChange={e => setNewName(e.target.value)} type='text'/> </label>
                            <button className='button_grey' onClick={() => { setShowMore(false); setNewName(''); }}>Cancel</button>
                            {
                                createStudyLoading ?
                                <button>Loading...</button>
                                :
                                <button onClick={() => createStudy({ variables: { name: newName } })}>Submit</button>
                            }
                        </div>
                    );
                } else {
                    return null;
                }
            } }
        </Query>
    );
};
