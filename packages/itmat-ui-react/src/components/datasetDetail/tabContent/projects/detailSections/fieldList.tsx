import { FunctionComponent } from 'react';
import { useQuery } from '@apollo/client/react/hooks';
import { GET_STUDY } from '@itmat-broker/itmat-models';
import LoadSpinner from '../../../../reusable/loadSpinner';

export const GrantedFieldListSection: FunctionComponent<{ originalCheckedList: string[]; studyId: string; projectId: string }> = ({ studyId }) => {
    const { loading, data, error } = useQuery(GET_STUDY, { variables: { studyId } });
    if (loading) { return <LoadSpinner />; }
    if (error) { return <p>{error.toString()}</p>; }
    const { getStudy } = data;

    if (!getStudy || !getStudy.dataVersions || getStudy.dataVersions.length === 0) {
        return <p>No data has been uploaded.</p>;
    }
    return null;
};
