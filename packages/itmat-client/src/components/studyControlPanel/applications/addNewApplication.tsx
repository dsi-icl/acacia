import * as React from 'react';
import { Mutation } from 'react-apollo';
import { CREATE_APPLICATION, GET_APPLICATION } from '../../../graphql/studyDetails';


export const AddApplication: React.FunctionComponent<{studyName: string}> = ({ studyName }) => {
    const [applicationNameInput, setApplicationNameInput] = React.useState('');
    const [approvedFieldsInput, setApprovedFieldsInput] = React.useState('');

    function handleSubmit(createApplication: Function) {
        return function() {
            const variables: any = { study: studyName, application: applicationNameInput };
            if (approvedFieldsInput !== '') {
                // TO_DO: parse and validate approvedfieldsinupts?
                variables.approvedFields = approvedFieldsInput;
            }
            createApplication({ variables });
        }
    }

    return (
        <>
            <Mutation
                mutation={CREATE_APPLICATION}
            >
            {(createApplication, { loading, error, data }) => {
                if (data && data.createApplication && data.createApplication.successful) { return `Created application.` }

                return (
                    <>
                        <label>Application name: </label><input value={applicationNameInput} onChange={e => { setApplicationNameInput(e.target.value); }}/> <br/><br/>
                        <label>Approved fields: </label><textarea value={approvedFieldsInput} onChange={e => { setApprovedFieldsInput(e.target.value); }}></textarea>
                        { loading ? <button>Loading...</button> : <button onClick={handleSubmit(createApplication)}>Submit</button> }
                    </>
                );
            }}
            </Mutation>
        </>
    );
};