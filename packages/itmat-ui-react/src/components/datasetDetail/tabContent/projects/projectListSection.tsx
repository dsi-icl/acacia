import * as React from 'react';
import { NavLink, Redirect } from 'react-router-dom';
import * as css from './tabContent.module.css';
import { Mutation } from 'react-apollo';
import { CREATE_PROJECT, GET_STUDY } from '../../../../graphql/study';

export const ProjectListSection: React.FunctionComponent<{ studyId: string, projectList: { id: string, name: string }[] }> = ({ studyId, projectList }) => {
    return <div>
            {projectList.map(el => <OneProject studyId={studyId} key={el.id} id={el.id} name={el.name}/>)}
            <AddNewProject studyId={studyId}/>
        </div>;
};

const OneProject: React.FunctionComponent<{ studyId: string, id: string, name: string }> = ({ id, name, studyId }) => 
    <NavLink to={`/datasets/${studyId}/projects/${id}`} activeClassName={css.active_project}><button className={css.project_badge + ' button_grey'}>{name}</button></NavLink>;
;


const AddNewProject: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const [input, setInput] = React.useState('');
    const [error, setError] = React.useState('');

    return <div>
        <input value={input} onChange={e => { setError(''); setInput(e.target.value); }} type='text' placeholder='Enter name'/>
        <Mutation mutation={CREATE_PROJECT} refetchQueries={[{ query: GET_STUDY, variables: { studyId }}]}>
            {(addNewProject, { loading, data }) =>
                {
                    if (data) return <Redirect to={`/datasets/${studyId}/projects/${data.createProject.id}`}/>;
                    return (
                        loading ?
                        <button>Loading...</button> :
                        <button onClick={() => {
                            if (!input) {
                                setError('Please enter project name.');
                                return;
                            }
                            addNewProject({ variables: { studyId, projectName: input, approvedFields: []}});
                        }}>Add new project</button>
                    );
                }
            }
        </Mutation>
        {
            error ? <div className='error_banner'>{error}</div> : null
        }
    </div>;
};