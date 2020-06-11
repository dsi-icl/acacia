import { IProject } from 'itmat-commons';
import * as React from 'react';
import { NavLink } from 'react-router-dom';
import css from './sections.module.css';
export const ProjectSection: React.FunctionComponent<{ study?: boolean; projects: IProject[] }> = ({ study, projects }) => {
    if (projects.length === 0) {
        return <p>{`User has not been added to any ${study ? 'study' : 'project'}.`}</p>;
    }
    return <>
        {projects.map((el) => <OneProject key={el.id} project={el} study={study} />)}
    </>;
};


const OneProject: React.FunctionComponent<{ project: IProject; study?: boolean }> = ({ project, study }) => {
    return <div className={css.one_project}>
        <NavLink to={`/${study ? 'datasets' : 'projects'}/${project.id}/dashboard`}><h5>{project.name}</h5></NavLink>
    </div>;
};
