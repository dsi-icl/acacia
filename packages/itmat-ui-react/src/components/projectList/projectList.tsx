import { FunctionComponent } from 'react';
import { Query } from '@apollo/client/react/components';
import { NavLink, Navigate } from 'react-router-dom';
import { IProject } from '@itmat-broker/itmat-types';
import { WHO_AM_I } from '@itmat-broker/itmat-models';
import { Button } from 'antd';

export const ProjectList: FunctionComponent = () => {
    return (
        <Query<any, any> query={WHO_AM_I}>
            {({ loading, error, data }) => {
                if (loading) { return <p>Loading...</p>; }
                if (error) { return <p>Error {error.name}: {error.message}</p>; }
                if (data.whoAmI && data.whoAmI.access && data.whoAmI.access.projects) {
                    const projects = data.whoAmI.access.projects;
                    if (projects.length === 1) {
                        return <Navigate to={`/projects/${projects[0].id}/dashboard`} />;
                    }
                    if (projects.length > 1) {
                        return <PickProjectSection projects={projects} />;
                    }
                }
                return <p>There is no project or you have not been added to any. Please contact admin.</p>;
            }
            }
        </Query>
    );
};

const PickProjectSection: FunctionComponent<{ projects: IProject[] }> = ({ projects }) => {
    return <>
        You have access to two or more projects. Please pick the one you would like to access: <br /><br /><br />
        {projects.map((el) =>
            <NavLink key={el.id} to={`/projects/${el.id}/dashboard`}>
                <Button>{el.name}</Button><br /><br />
            </NavLink>
        )}
    </>;
};
