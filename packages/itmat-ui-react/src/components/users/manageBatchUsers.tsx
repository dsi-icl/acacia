import { Models } from 'itmat-commons';
import * as React from 'react';
import { Query, Mutation } from 'react-apollo';
import { NavLink } from 'react-router-dom';
import { WHO_AM_I } from 'itmat-commons/dist/graphql/user';
import css from './userList.module.css';
import { useQuery } from 'react-apollo';
import { GET_PROJECT } from 'itmat-commons/dist/graphql/projects';
import { LoadingBalls } from '../reusable/icons/loadingBalls';
import { EDIT_USER } from 'itmat-commons/dist/graphql';

export const ManageBatchUsers: React.FunctionComponent = (props) => {
    
    return (
        <Query<any, any>
            query={WHO_AM_I}
            pollInterval={5000}
        >
            {({ loading, error, data }) => {
                if (loading) { return <p>Loading...</p>; }
                if (error) { return <p>Error :( {error}</p>; }
                if (data.whoAmI.type === 'STANDARD') {
                    return <p>You have no access to this page.</p>;
                }
                if (data.whoAmI && data.whoAmI.access && data.whoAmI.access.projects) {
                    const projects = data.whoAmI.access.projects;
                    const datasets = data.whoAmI.access.studies;

                    if (projects.length === 0) {
                        return <p>There is no project or you have not been added to any. Please contact admin.</p>;        
                    }
                    else {
                        return <BatchFilter projects={projects} datasets={datasets}/>
                    }
                }
                return <p>This page is blank.</p>;
            }
            }
        </Query>
    );
};

export const BatchFilter: React.FunctionComponent<{projects: Models.Study.IProject[], datasets: Models.Study.IStudy[]}> = ({projects, datasets}) => {
    const projectsNames = projects.map(value => value.name); 
    const datasetsNames = datasets.map(value => value.name); 
    
    const projectsIDs = projects.map(value => value.id);
    const datasetsIDs = datasets.map(value => value.id);

    const [selectedProjects, setSelectedProjects] = React.useState(projectsIDs.reduce((a, b) => (a[b]=false, a), {}));
    const [selectedDatasets, setSelectedDatasets] = React.useState(projectsIDs.reduce((a, b) => (a[b]=false, a), {}));
    const initialUsers: Models.UserModels.IUser[] =  [];
    const [selectedUsers, setSelectedUsers] = React.useState(initialUsers); 

    const [submitConfirm, setSubmitConfirm] = React.useState(true);
    function checkObjectExists(element: any, array: any) {
        var i;
        for (i = 0; i < array.length; i++){
            if (array[i] === element) {
                return true;
            }
        }
        return false;
    }
    function stateFunction(element: Models.UserModels.IUser){
        if (checkObjectExists(element, selectedUsers)) { 
            return;
        } else {
            setSelectedUsers([...selectedUsers, element]) 
        }
    }
    return (
        <form>
        <label><h2>Projects: </h2><br/>
            {projectsNames.map(o => <><input type="checkbox" name="projects[]" value={o} onChange={o => { setSelectedProjects({ ...selectedProjects, [projectsIDs[projectsNames.indexOf(o.target.value)]]: o.target.checked }); setSelectedUsers([])}} />{o}<br/></> )}      
        </label><br/>
        {/* <label><h2>Datasets: </h2><br/>
            {datasetsNames.map(o => <><input type="checkbox" name="datasets[]" value={o} onChange={o => { setSelectedDatasets({ ...selectedDatasets, [datasetsIDs[datasetsNames.indexOf(o.target.value)]]: o.target.checked }); setSelectedUsers([])}} />{o}<br/></> )}      
        </label> */}
        {selectedUsers.length !== 0 ? <h2>The following users will be operated.</h2> : <h2>No users are selected.</h2>}
        {selectedUsers.map((value => <h1>{value.username}</h1>))}
        {Object.keys(selectedProjects).filter(function(key){ return selectedProjects[key] === true}).map((el) => <QueryProject projectID={el} recordFunc={stateFunction}/>)}
        <div className={css.submit_cancel_button_wrapper}>
                <NavLink to='/users'><button className='button_grey'>Cancel</button></NavLink>
        </div>
        {selectedUsers.map((el) => <SubmitUser user={el} confirm={submitConfirm} />)}
        </form>
    );
}

export const QueryProject: React.FunctionComponent<{projectID: string, recordFunc: any}> = ({projectID, recordFunc}) => {
    const { data: projectData, loading: projectFetchLoading } = useQuery(GET_PROJECT, { variables: { projectId: projectID, admin: true } });
    if (projectFetchLoading) { return <LoadingBalls />; }
    const roles = projectData.getProject.roles;
    return <div>
        {roles.map((el: Models.Study.IRole) => <QueryRole role={el} recordFunc={recordFunc} />)}
        </div>;
}

export const QueryRole: React.FunctionComponent<{role: Models.Study.IRole, recordFunc: any}> = ({role, recordFunc}) => {
    return <div>
        {role.users.map((el) => <QueryUser user={el as any} recordFunc={recordFunc} />)}
    </div>
}   

export const QueryUser: React.FunctionComponent<{user: Models.UserModels.IUser, recordFunc: any}> = ({user, recordFunc}) => {
    recordFunc(user);
    return null;

} 

export const SubmitUser: React.FunctionComponent<{user: Models.UserModels.IUser, confirm: boolean}> = ({user, confirm}) => {
    const [inputs, setInputs] = React.useState({ ...user, password: '' });
    const [savedSuccessfully, setSavedSuccessfully] = React.useState(false);
    
    function formatSubmitObj() {
        const editUserObj = { ...inputs };
        return editUserObj;
    }
    if (confirm) {
        return (
            <Mutation<any, any>
                mutation={EDIT_USER}
                onCompleted={() => setSavedSuccessfully(true)}
            >
                {(submit, { loading, error, data }) =>
                    <>
                        <div className={css.submit_cancel_button_wrapper}>
                            {loading ? null : submit({ variables: { ...formatSubmitObj() } }) }
                        </div>
                        {
                            error ? <div className='error_banner'>{JSON.stringify(error)}</div> : null
                        }
                        {/* {
                            savedSuccessfully ? <div className="saved_banner">Saved!</div> : null
                        } */}
                        <br /><br /><br />
                    </>
                }

            </Mutation>
        );} else {
        return null;
    }
    
} 

