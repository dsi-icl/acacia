import React from 'react';
import { Query } from 'react-apollo';
import { GET_AVAILABLE_FIELDS } from '../../../../../graphql/fields';
import { LoadingBalls } from '../../../../reusable/loadingBalls';
import { FieldListSection } from '../../../../projectDetail/tabContent/data/fieldList';

export const GrantedFieldListSection: React.FunctionComponent<{ originalCheckedList: string[], studyId: string }> = ({ originalCheckedList, studyId }) => {
    const [checkedList, setCheckedList] = React.useState(originalCheckedList || []);

    const onCheck = (checkedList: string[]) => {
        setCheckedList(checkedList);
    };

    return <Query query={GET_AVAILABLE_FIELDS} variables={{ studyId }}>
        {({ loading, data: fieldData, error }) => {
            if (loading) return <LoadingBalls/>;
            if (error) return <p>Error :( {JSON.stringify(error)}</p>; 

            return <FieldListSection onCheck={onCheck} checkedList={checkedList} checkable={true} fieldList={fieldData.getAvailableFields}/>;
        }}
    </Query>;
};