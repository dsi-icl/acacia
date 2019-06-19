import * as React from 'react';
import { NavLink } from 'react-router-dom';
import * as css from './tabContent.module.css';

export const ProjectListSection: React.FunctionComponent<{ studyId: string, projectList: { id: string, name: string }[] }> = ({ studyId, projectList }) => {
    return <table>
        <thead>
            <tr>
                <th>Name</th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            {projectList.map(el => <OneProject studyId={studyId} key={el.id} id={el.id} name={el.name}/>)}

            <tr className={css.add_new_project_tr}>
                <td><input type='text' placeholder='Enter name'/></td>
                <td><button>Add new project</button></td>
            </tr>
        </tbody>
    </table>;
};

const OneProject: React.FunctionComponent<{ studyId: string, id: string, name: string }> = ({ id, name, studyId }) => 
    <tr>
        <td>{name}</td>
        <td><NavLink to={`/datasets/${studyId}/projects/${id}`}><button>more/edit</button></NavLink></td>
    </tr>
;