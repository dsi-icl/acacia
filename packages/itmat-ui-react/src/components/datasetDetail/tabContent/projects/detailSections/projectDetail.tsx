import React from 'react';
import { GET_PROJECT } from '../../../../../graphql/projects';
import { LoadingBalls } from '../../../../reusable/loadingBalls';
import { Query } from 'react-apollo';
import { Subsection } from '../../../../reusable';
import { IRole } from 'itmat-utils/dist/models/study';
import { OneRole } from '../../admin/adminTab';
import { AddRole } from '../../../../projectDetail/tabContent/admin/adminTab';
import { DeleteProjectSection } from './deleteProjectSection';

export const ProjectDetail: React.FunctionComponent<{ projectId: string, studyId: string }> = ({ projectId, studyId }) => {
    return <Query
        query={GET_PROJECT}
        variables={{ projectId, admin: true }}
    >
    {({ data, loading, error }) => {
        if (loading) return <LoadingBalls/>;
        if (error) return <p>{error.toString()}</p>;
        if (!data || !data.getProject) return <p>Cannot find this project! Please contact admin.</p>;
        console.log(data);

        return <div>
            <h5>{data.getProject.name}</h5>
            <Subsection title='Role'>
                <div>
                    {
                        data.getProject.roles.map((el: IRole) => <OneRole key={el.id} role={el}/>)
                    }
                    <AddRole studyId={studyId} projectId={projectId}/>
                </div>
            </Subsection>
            <Subsection title='Granted Fields'>

            </Subsection>
            <Subsection title='Patient ID Mapping'>

            </Subsection>
            <Subsection title='Delete this project'>
                    <DeleteProjectSection projectId={projectId} projectName={data.getProject.name}/>
            </Subsection>
        </div>;
    }}
    </Query>;
};