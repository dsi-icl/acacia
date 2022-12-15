import { FunctionComponent, useState } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { NavLink, Navigate } from 'react-router-dom';
import { CREATE_PROJECT } from '@itmat-broker/itmat-models';
import css from './tabContent.module.css';
import { Button, Input } from 'antd';

export const ProjectListSection: FunctionComponent<{ studyId: string; projectList: Array<{ id: string; name: string }> }> = ({ studyId, projectList }) => {
    return <div>
        {projectList.map((el) => <OneProject studyId={studyId} key={el.id} id={el.id} name={el.name} />)}
    </div>;
};

const OneProject: FunctionComponent<{ studyId: string; id: string; name: string }> = ({ id, name, studyId }) => {
    return (<>
        <NavLink to={`/datasets/${studyId}/projects/${id}`}><Button className={css.project_badge}>{name}</Button></NavLink><br />
    </>);
};



export const AddNewProject: FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const [projectName, setProjectName] = useState('');
    const [error, setError] = useState('');

    return <div>
        <span>Project Name: </span>
        <Input value={projectName} style={{ width: '50%' }} onChange={(e) => { setError(''); setProjectName(e.target.value); }} type='text' placeholder='Enter name' /> <br /><br />
        <Mutation<any, any> mutation={CREATE_PROJECT}
        // update={(store, { data: { createProject } }) => {
        //     // Read the data from our cache for this query.
        //     const data: any = store.readQuery({ query: GET_STUDY, variables: { studyId, admin: true } });
        //     // Add our comment from the mutation to the end.
        //     const newProjects = data.getStudy.projects.concat(createProject);
        //     data.getStudy.projects = newProjects;
        //     // Write our data back to the cache.
        //     store.writeQuery({ query: GET_STUDY, variables: { studyId, admin: true }, data });

        //     // Read the data from our cache for this query.
        //     const whoAmI: any = store.readQuery({ query: WHO_AM_I });
        //     // Add our comment from the mutation to the end.
        //     // const newWhoAmIProjects = whoAmI.whoAmI.access.projects.concat(createProject);
        //     whoAmI.whoAmI.access.projects = newProjects;
        //     // Write our data back to the cache.
        //     store.writeQuery({ query: WHO_AM_I, data: whoAmI });
        // }}
        >
            {(addNewProject, { loading, data }) =>
                <>
                    {data ? <Navigate to={`/datasets/${studyId}/projects/${data.createProject.id}`} /> : null}
                    {
                        loading ?
                            <Button>Loading...</Button> :
                            <Button onClick={() => {
                                if (!projectName) {
                                    setError('Please enter project name.');
                                    return;
                                }
                                addNewProject({ variables: { studyId, projectName: projectName, approvedFields: [] } });
                            }}>Add new project</Button>
                    }
                </>
            }
        </Mutation>
        {
            error ? <div className='error_banner'>{error}</div> : null
        }
    </div>;
};
