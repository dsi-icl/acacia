import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { EDIT_USER, GET_USERS, DELETE_USER } from '../../graphql/appUsers';
import { IUserWithoutToken } from 'itmat-utils/dist/models/user';
import { NavLink } from 'react-router-dom';
import { Subsection } from '../reusable';
import { IProject, IStudy } from 'itmat-utils/dist/models/study';
import * as css from './sections.module.css';
export const ProjectSection: React.FunctionComponent<{ projects: IProject[] }> = ({ projects }) => {
    if (projects.length === 0) {
        return <p>User has not been added to any project.</p>;
    }
    return <>
        {projects.map(el => <OneProject key={el.id} project={el}/>)}
    </>;
};


const OneProject: React.FunctionComponent<{ project: IProject }> = ({ project }) => {
    return <div className={css.one_project}>
        <NavLink to={`/projects/${project.id}/dashboard`}><h5>{project.name}</h5></NavLink>
        <label>Role: </label><br/><br/>
    </div>;
};