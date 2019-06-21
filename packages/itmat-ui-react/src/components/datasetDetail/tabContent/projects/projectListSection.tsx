import * as React from 'react';
import { NavLink } from 'react-router-dom';
import * as css from './tabContent.module.css';

export const ProjectListSection: React.FunctionComponent<{ studyId: string, projectList: { id: string, name: string }[] }> = ({ studyId, projectList }) => {
    return <div>
            {projectList.map(el => <OneProject studyId={studyId} key={el.id} id={el.id} name={el.name}/>)}

            <input type='text' placeholder='Enter name'/>
            <button>Add new project</button>
        </div>;
};

const OneProject: React.FunctionComponent<{ studyId: string, id: string, name: string }> = ({ id, name, studyId }) => 
    <NavLink to={`/datasets/${studyId}/projects/${id}`} activeClassName={css.active_project}><button className={css.project_badge + ' button_grey'}>{name}</button></NavLink>;
;