import * as React from 'react';
import { Mutation } from '@apollo/client/react/components';
import { NavLink, Redirect } from 'react-router-dom';
import { CREATE_PROJECT, GET_STUDY, WHO_AM_I } from 'itmat-commons';
import css from './tabContent.module.css';

export const ProjectListSection: React.FunctionComponent<{ studyId: string; projectList: Array<{ id: string; name: string }> }> = ({ studyId, projectList }) => {
    return <div>
        {projectList.map((el) => <OneProject studyId={studyId} key={el.id} id={el.id} name={el.name} />)}
    </div>;
};

const OneProject: React.FunctionComponent<{ studyId: string; id: string; name: string }> = ({ id, name, studyId }) =>
    <NavLink to={`/datasets/${studyId}/projects/${id}`}><button className={css.project_badge}>{name}</button></NavLink>;



export const AddNewProject: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const [input, setInput] = React.useState('');
    const [error, setError] = React.useState('');

    return <div>
        <input value={input} onChange={(e) => { setError(''); setInput(e.target.value); }} type='text' placeholder='Enter name' />
        <Mutation<any, any>
            mutation={CREATE_PROJECT}
            update={(store, { data: { createProject } }) => {
                // Read the data from our cache for this query.
                const data: any = store.readQuery({ query: GET_STUDY, variables: { studyId, admin: true } });
                // Add our comment from the mutation to the end.
                const newProjects = data.getStudy.projects.concat(createProject);
                data.getStudy.projects = newProjects;
                // Write our data back to the cache.
                store.writeQuery({ query: GET_STUDY, variables: { studyId, admin: true }, data });

                // Read the data from our cache for this query.
                const whoAmI: any = store.readQuery({ query: WHO_AM_I });
                // Add our comment from the mutation to the end.
                // const newWhoAmIProjects = whoAmI.whoAmI.access.projects.concat(createProject);
                whoAmI.whoAmI.access.projects = newProjects;
                // Write our data back to the cache.
                store.writeQuery({ query: WHO_AM_I, data: whoAmI });
            }}
        >
            {(addNewProject, { loading, data }) =>
                <>
                    {data ? <Redirect to={`/datasets/${studyId}/projects/${data.createProject.id}`} /> : null}
                    {
                        loading ?
                            <button>Loading...</button> :
                            <button onClick={() => {
                                if (!input) {
                                    setError('Please enter project name.');
                                    return;
                                }
                                addNewProject({ variables: { studyId, projectName: input, approvedFields: [] } });
                            }}>Add new project</button>
                    }
                </>
            }
        </Mutation>
        {
            error ? <div className='error_banner'>{error}</div> : null
        }
    </div>;
};
