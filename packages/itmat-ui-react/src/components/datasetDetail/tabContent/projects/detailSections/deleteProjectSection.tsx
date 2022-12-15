import { FunctionComponent, useState } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { Navigate } from 'react-router';
import { WHO_AM_I, DELETE_PROJECT, GET_STUDY } from '@itmat-broker/itmat-models';
import { IProject } from '@itmat-broker/itmat-types';

export const DeleteProjectSection: FunctionComponent<{ studyId: string; projectId: string; projectName: string }> = ({ studyId, projectId, projectName }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [inputText, setInput] = useState('');
    const [error, setError] = useState('');
    const [deleted, setDeleted] = useState(false);

    if (!isExpanded) {
        return <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => { setIsExpanded(true); setInput(''); }}>Click to delete</span>;
    }

    if (deleted) {
        return <Navigate to={`/datasets/${studyId}/projects/`} />;
    }

    return <>
        <p style={{ color: 'red' }}>Warning! This is irreversible! If you really want to delete this project, please type the name of the project ({projectName}) below to confirm.</p>
        <input type='text' placeholder={projectName} value={inputText} onChange={(e) => { setInput(e.target.value); setError(''); }} /> <br /><br />
        <Mutation<any, any>
            mutation={DELETE_PROJECT}
            update={(store) => {
                // Read the data from our cache for this query.
                const data: any = store.readQuery({ query: GET_STUDY, variables: { studyId, admin: true } });
                // Add our comment from the mutation to the end.
                const newProjects = data.getStudy.projects.filter((el: IProject) => el.id !== projectId);
                data.getStudy.projects = newProjects;
                // Write our data back to the cache.
                store.writeQuery({ query: GET_STUDY, variables: { studyId, admin: true }, data });

                // Read the data from our cache for this query.
                const whoAmI: any = store.readQuery({ query: WHO_AM_I });
                // Add our comment from the mutation to the end.
                // const newWhoAmIProjects = whoAmI.whoAmI.access.projects.filter((el: IProject) => el.id !== projectId);
                whoAmI.whoAmI.access.projects = newProjects;
                // Write our data back to the cache.
                store.writeQuery({ query: WHO_AM_I, data: whoAmI });
            }}
            onCompleted={() => setDeleted(true)}
        >
            {(deleteProject, { loading }) =>
                loading ?
                    <button style={{ display: 'inline-block', width: '30%' }}>Loading...</button> :
                    <button onClick={() => {
                        if (inputText !== projectName) {
                            setError('Project name not matched.');
                        } else {
                            deleteProject({ variables: { projectId } });
                        }
                    }} style={{ display: 'inline-block', width: '30%' }}>Really delete!
                    </button>
            }
        </Mutation><button style={{ display: 'inline-block', width: '30%' }} className='button_grey' onClick={() => setIsExpanded(false)}>Cancel</button>
        <br />
        {error ? <div className='error_banner'>{error}</div> : null}
    </>;
};
