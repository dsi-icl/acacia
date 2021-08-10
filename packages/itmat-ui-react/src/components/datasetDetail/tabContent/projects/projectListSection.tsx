import * as React from 'react';
import { Mutation } from '@apollo/client/react/components';
import { NavLink, Redirect } from 'react-router-dom';
import { CREATE_PROJECT, GET_STUDY } from 'itmat-commons';
import { useQuery } from '@apollo/client/react/hooks';
import css from './tabContent.module.css';
import LoadSpinner from '../../../reusable/loadSpinner';
import { Button, Input, Select } from 'antd';
const Option = Select;

export const ProjectListSection: React.FunctionComponent<{ studyId: string; projectList: Array<{ id: string; name: string }> }> = ({ studyId, projectList }) => {
    return <div>
        {projectList.map((el) => <OneProject studyId={studyId} key={el.id} id={el.id} name={el.name} />)}
    </div>;
};

const OneProject: React.FunctionComponent<{ studyId: string; id: string; name: string }> = ({ id, name, studyId }) => {
    return (<>
        <NavLink to={`/datasets/${studyId}/projects/${id}`}><Button className={css.project_badge}>{name}</Button></NavLink><br/>
    </>);
};



export const AddNewProject: React.FunctionComponent<{ studyId: string }> = ({ studyId }) => {
    const { data: getStudyData, loading: getStudyLoading, error: getStudyError } = useQuery(GET_STUDY, { variables: { studyId } });
    const [projectName, setProjectName] = React.useState('');
    const [selectedDataVersion, setSelectedDataVersion] = React.useState('');
    const [error, setError] = React.useState('');
    if (getStudyLoading) { return <LoadSpinner />; }
    if (getStudyError) {
        return <p>
            A error occured, please contact your administrator
        </p>;
    }
    const availableDataVersions: any[] = getStudyData.getStudy.dataVersions.map(el => el);
    console.log(availableDataVersions);

    return <div>
        <span>Project Name: </span>
        <Input value={projectName} style={{width: '50%'}} onChange={(e) => { setError(''); setProjectName(e.target.value); }} type='text' placeholder='Enter name' /> <br/><br/>
        <span>Data Version: </span>
        <Select style={{width: '50%'}} value={selectedDataVersion} onChange={(value) => { setSelectedDataVersion(value); }} placeholder='Select base data versions'>{availableDataVersions.map((el: any) => <Option key={el.id} value={el.id}>{el.version + '(' + el.tag + ')'}</Option>)}</Select><br /><br />
        <Mutation<any, any>
            mutation={CREATE_PROJECT}
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
                    {data ? <Redirect to={`/datasets/${studyId}/projects/${data.createProject.id}`} /> : null}
                    {
                        loading ?
                            <Button>Loading...</Button> :
                            <Button onClick={() => {
                                if (!projectName) {
                                    setError('Please enter project name.');
                                    return;
                                }
                                if (selectedDataVersion === '') {
                                    setError('You have to choose one data version.');
                                    return;
                                }
                                addNewProject({ variables: { studyId, projectName: projectName, dataVersion: selectedDataVersion, approvedFields: [] } });
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
