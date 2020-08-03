import React, { useState } from 'react';
import { Query } from '@apollo/client/react/components';
import { GET_PROJECT_PATIENT_MAPPING } from 'itmat-commons';
import { LoadingBalls } from '../../../../reusable/icons/loadingBalls';

export const PatientIdMappingSection: React.FunctionComponent<{ projectId: string }> = ({ projectId }) => {
    const [clickedFetch, setClickedFetch] = useState(false);
    const [currentProjectId, setCurrentProjectId] = useState(projectId);

    if (projectId !== currentProjectId) {
        setClickedFetch(false);
        setCurrentProjectId(projectId);
    }

    if (!clickedFetch) { return <button onClick={() => setClickedFetch(true)}>Fetch mapping</button>; }
    return <Query<any, any> query={GET_PROJECT_PATIENT_MAPPING} variables={{ projectId }}>
        {({ data, loading, error }) => {
            if (loading) { return <LoadingBalls />; }
            if (error) { return <p>{error.toString()}</p>; }
            if (!data || !data.getProject || !data.getProject.patientMapping) { return <p>'Cannot fetch data'</p>; }
            return <textarea>{JSON.stringify(data.getProject.patientMapping)}</textarea>;
        }}
    </Query>;
};
