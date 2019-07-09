import React from 'react';
import { GET_PROJECT } from '../../../../../graphql/projects';
import { LoadingBalls } from '../../../../reusable/loadingBalls';
import { Query } from 'react-apollo';
import { Subsection } from '../../../../reusable';
import { IRole, IProject } from 'itmat-utils/dist/models/study';
import { OneRole } from '../../admin/adminTab';
import { AddRole } from '../../../../projectDetail/tabContent/admin/adminTab';
import { DeleteProjectSection } from './deleteProjectSection';
import { PatientIdMappingSection } from './patientIdMapping';
import { GrantedFieldListSection } from './fieldList';
import * as css from './projectDetail.module.css';
import { GrantedFileListSelection } from './fileList';

export const ProjectDetail: React.FunctionComponent<{ projectId: string, studyId: string }> = ({ projectId, studyId }) => {
    return <Query
        query={GET_PROJECT}
        variables={{ projectId, admin: true }}
    >
    {({ data, loading, error }) => {
        if (loading) return <LoadingBalls/>;
        if (error) return <p>{error.toString()}</p>;
        if (!data || !data.getProject) return <p>Cannot find this project! Please contact admin.</p>;

        return <div className={css.project_detail_scaffold}>
            <div className={css.project_detail_title}>
                {data.getProject.name}
            </div>
            <div className={css.project_detail_left}>
                <Subsection title='Role'>
                    <div>
                        {
                            data.getProject.roles.map((el: IRole) => <OneRole key={el.id} role={el}/>)
                        }
                        <AddRole studyId={studyId} projectId={projectId}/>
                    </div>
                </Subsection>
                <Subsection title='Patient ID Mapping'>
                    <PatientIdMappingSection projectId={projectId}/>
                </Subsection>
                <Subsection title='Delete this project'>
                    <DeleteProjectSection studyId={studyId} projectId={projectId} projectName={data.getProject.name}/>
                </Subsection>
            </div>
            <div className={css.project_detail_right}>
                <Subsection title='Granted Fields'>
                    <GrantedFieldListSection projectId={projectId} studyId={studyId} originalCheckedList={data.getProject.approvedFields}/>
                </Subsection>
                <br/><br/>
                <Subsection title='Granted Files'>
                    <GrantedFileListSelection projectId={projectId} studyId={studyId} originalCheckedList={data.getProject.approvedFiles}/>
                </Subsection>
            </div>
        </div>;
    }}
    </Query>;
};