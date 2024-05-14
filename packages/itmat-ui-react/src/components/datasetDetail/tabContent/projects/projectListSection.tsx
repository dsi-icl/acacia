import { FunctionComponent, useState } from 'react';
import { Mutation } from '@apollo/client/react/components';
import { NavLink, Navigate } from 'react-router-dom';
import { CREATE_PROJECT } from '@itmat-broker/itmat-models';
import css from './tabContent.module.css';
import { Button, Input } from 'antd';
import { IProject } from '@itmat-broker/itmat-types';

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
        <Mutation<{ createProject: IProject }, { studyId: string, projectName: string }> mutation={CREATE_PROJECT}
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
                                addNewProject({ variables: { studyId, projectName: projectName } }).catch(() => { return; });
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
