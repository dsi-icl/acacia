import React from 'react';
import { Query } from '@apollo/client/react/components';
import { GET_PROJECT } from 'itmat-commons';
import { Subsection } from '../../../../reusable';
import { LoadingBalls } from '../../../../reusable/icons/loadingBalls';
import { RoleControlSection } from '../../../../reusable/roleControlSection/roleControlSection';
import { DeleteProjectSection } from './deleteProjectSection';
import { GrantedFieldListSection } from './fieldList';
import { GrantedFileListSelection } from './fileList';
import { PatientIdMappingSection } from './patientIdMapping';
import css from './projectDetail.module.css';
import { NavLink } from 'react-router-dom';

export const ProjectDetail: React.FunctionComponent<{ projectId: string; studyId: string }> = ({ projectId, studyId }) => {
    return <Query<any, any>
        query={GET_PROJECT}
        variables={{ projectId, admin: true }}
    >
        {({ data, loading, error }) => {
            if (loading) { return <LoadingBalls />; }
            if (error) { return <p>{error.toString()}</p>; }
            if (!data || !data.getProject) { return <p>Cannot find this project! Please contact admin.</p>; }

            return <div className={`${css.project_detail_scaffold} fade_in`}>
                <div className={css.project_detail_title}>
                    <NavLink to={`/datasets/${studyId}/projects`}><div>&#11013;</div></NavLink>{data.getProject.name}
                </div>
                <div className={css.project_detail_left}>
                    <Subsection title='Role'>
                        <RoleControlSection studyId={studyId} projectId={projectId} roles={data.getProject.roles} />
                    </Subsection>
                    <Subsection title='Patient ID Mapping'>
                        <PatientIdMappingSection projectId={projectId} />
                    </Subsection>
                    <Subsection title='Delete this project'>
                        <DeleteProjectSection studyId={studyId} projectId={projectId} projectName={data.getProject.name} />
                    </Subsection>
                </div>
                <div className={css.project_detail_right}>
                    <Subsection title='Granted Fields'>
                        <GrantedFieldListSection projectId={projectId} studyId={studyId} originalCheckedList={data.getProject.approvedFields} />
                    </Subsection>
                    <br /><br />
                    <Subsection title='Granted Files'>
                        <GrantedFileListSelection projectId={projectId} studyId={studyId} originalCheckedList={data.getProject.approvedFiles} />
                    </Subsection>
                </div>
            </div>;
        }}
    </Query>;
};
