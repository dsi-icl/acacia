import { FunctionComponent, useState } from 'react';
import { Query } from '@apollo/client/react/components';
import { GET_PROJECT_PATIENT_MAPPING } from '@itmat-broker/itmat-models';
import LoadSpinner from '../../../../reusable/loadSpinner';
import { Button } from 'antd';

export const PatientIdMappingSection: FunctionComponent<{ projectId: string }> = ({ projectId }) => {
    const [clickedFetch, setClickedFetch] = useState(false);
    const [currentProjectId, setCurrentProjectId] = useState(projectId);

    if (projectId !== currentProjectId) {
        setClickedFetch(false);
        setCurrentProjectId(projectId);
    }

    if (!clickedFetch) { return <Button onClick={() => setClickedFetch(true)}>Fetch mapping</Button>; }
    return <Query<any, any> query={GET_PROJECT_PATIENT_MAPPING} variables={{ projectId }}>
        {({ data, loading, error }) => {
            if (loading) { return <LoadSpinner />; }
            if (error) { return <p>{error.toString()}</p>; }
            if (!data || !data.getProject || !data.getProject.patientMapping) { return <p>'Cannot fetch data'</p>; }
            return <textarea title="PatientIdMappingSection">{JSON.stringify(data.getProject.patientMapping)}</textarea>;
        }}
    </Query>;
};
