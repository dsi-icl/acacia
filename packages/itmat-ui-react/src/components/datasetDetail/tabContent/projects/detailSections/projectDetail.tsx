import { FunctionComponent } from 'react';
import { Query } from '@apollo/client/react/components';
import { GET_PROJECT, WHO_AM_I } from '@itmat-broker/itmat-models';
import { Subsection } from '../../../../reusable';
import LoadSpinner from '../../../../reusable/loadSpinner';
import { RoleControlSection } from '../../../../reusable/roleControlSection/roleControlSection';
import { DeleteProjectSection } from './deleteProjectSection';
import { PatientIdMappingSection } from './patientIdMapping';
import css from './projectDetail.module.css';
import { NavLink, useParams } from 'react-router-dom';
import { useQuery } from '@apollo/client/react/hooks';
import { IProject, IRole, enumUserTypes } from '@itmat-broker/itmat-types';

export const ProjectDetail: FunctionComponent = () => {
    const { projectId, studyId } = useParams();
    const { loading: whoamiloading, error: whoamierror, data: whoamidata } = useQuery(WHO_AM_I);
    if (whoamiloading) { return <p>Loading..</p>; }
    if (whoamierror) { return <p>ERROR: please try again.</p>; }

    if (!projectId || !studyId)
        return null;
    return <Query<{ getProject: IProject & { roles: IRole[] } }, { projectId: string, admin: boolean }>
        query={GET_PROJECT}
        variables={{ projectId, admin: whoamidata.whoAmI.type === enumUserTypes.ADMIN }}
    >
        {({ data, loading, error }) => {
            if (loading) { return <LoadSpinner />; }
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
                </div>
            </div>;
        }}
    </Query>;
};
