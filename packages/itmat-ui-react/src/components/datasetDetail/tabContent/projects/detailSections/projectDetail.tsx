import React from 'react';
import { Query } from 'react-apollo';
import { GET_PROJECT } from '../../../../../graphql/projects';
import { Subsection } from '../../../../reusable';
import { LoadingBalls } from '../../../../reusable/loadingBalls';
import { RoleControlSection } from '../../../../reusable/roleControlSection';
import { DeleteProjectSection } from './deleteProjectSection';
import { GrantedFieldListSection } from './fieldList';
import { GrantedFileListSelection } from './fileList';
import { PatientIdMappingSection } from './patientIdMapping';
import * as css from './projectDetail.module.css';

export const ProjectDetail: React.FunctionComponent<{ projectId: string, studyId: string }> = ({ projectId, studyId }) => {
    return <Query
        query={GET_PROJECT}
        variables={{ projectId, admin: true }}
    >
        {({ data, loading, error }) => {
            if (loading) { return <LoadingBalls />; }
            if (error) { return <p>{error.toString()}</p>; }
            if (!data || !data.getProject) { return <p>Cannot find this project! Please contact admin.</p>; }

            return <div className={css.project_detail_scaffold}>
                <div className={css.project_detail_title}>
                    {data.getProject.name}
                </div>
                <div className={css.project_detail_left}>
                    <Subsection title="Role">
                        <RoleControlSection studyId={studyId} projectId={projectId} roles={data.getProject.roles} />
                    </Subsection>
                    <Subsection title="Patient ID Mapping">
                        <PatientIdMappingSection projectId={projectId} />
                    </Subsection>
                    <Subsection title="Delete this project">
                        <DeleteProjectSection studyId={studyId} projectId={projectId} projectName={data.getProject.name} />
                    </Subsection>
                </div>
                <div className={css.project_detail_right}>
                    <Subsection title="Granted Fields">
                        <GrantedFieldListSection projectId={projectId} studyId={studyId} originalCheckedList={data.getProject.approvedFields} />
                    </Subsection>
                    <br /><br />
                    <Subsection title="Granted Files">
                        <GrantedFileListSelection projectId={projectId} studyId={studyId} originalCheckedList={data.getProject.approvedFiles} />
                    </Subsection>
                </div>
            </div>;
        }}
    </Query>;
};
