import { FunctionComponent, useState } from 'react';
import { useQuery } from '@apollo/client/react/hooks';
import { Subsection } from '../../../reusable';
import LoadSpinner from '../../../reusable/loadSpinner';
import css from './tabContent.module.css';
import { RoleControlSection } from '../../../reusable/roleControlSection/roleControlSection';
import { GET_STUDY, DELETE_STUDY, WHO_AM_I } from '@itmat-broker/itmat-models';
import { Mutation, Query } from '@apollo/client/react/components';
import { Navigate, useParams } from 'react-router-dom';
import { Button } from 'antd';

export const AdminTabContent: FunctionComponent = () => {

    const { studyId } = useParams();
    const [deleteButtonShown, setDeleteButtonShown] = useState(false);
    const { data, loading } = useQuery(GET_STUDY, { variables: { studyId } });

    if (!studyId)
        return null;
    if (loading)
        return <LoadSpinner />;

    return (
        <div className={`${css.tab_page_wrapper_grid} fade_in`}>
            <div className={`${css.tab_page_wrapper} ${css.cover_page}`}>
                <Subsection title='Roles'>
                    <RoleControlSection studyId={studyId} roles={data.getStudy.roles} />
                </Subsection>
                <br />
                <br />
                <Subsection title='Dataset Deletion'>
                    <p>Be careful to check all related projects and files before deleting this dataset!</p>
                    <Query<any, any> query={GET_STUDY} variables={{ studyId }}>
                        {({ loading, data, error }) => {
                            if (loading) { return <LoadSpinner />; }
                            if (error) { return <p>{error.toString()}</p>; }

                            return <Mutation<any, any>
                                mutation={DELETE_STUDY}
                                refetchQueries={[
                                    { query: WHO_AM_I, variables: { fetchDetailsAdminOnly: false, fetchAccessPrivileges: false } }
                                ]}
                            >

                                {(deleteStudy, { loading, error, data: StudyDeletedData }) => {
                                    if (StudyDeletedData && StudyDeletedData.deleteStudy && StudyDeletedData.deleteStudy.successful) {
                                        return <Navigate to={'/datasets'} />;
                                    }
                                    if (error) return <p>{error.message}</p>;
                                    if (loading)
                                        return <LoadSpinner />;
                                    return (
                                        <>
                                            {!deleteButtonShown ? <Button onClick={() => setDeleteButtonShown(true)}>Delete the dataset</Button> : <><Button danger type='primary' onClick={() => { deleteStudy({ variables: { studyId: data.getStudy.id } }); }}>Delete&nbsp;<i>{data.getStudy.name}</i></Button>&nbsp;&nbsp;&nbsp;&nbsp;<Button onClick={() => { setDeleteButtonShown(false); }} style={{ cursor: 'pointer' }}> Cancel </Button></>}
                                        </>
                                    );
                                }}

                            </Mutation>;
                        }}
                    </Query>

                </Subsection>

            </div>
        </div>
    );
};
