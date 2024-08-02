import { FunctionComponent, useState } from 'react';
import { Subsection } from '../../../reusable';
import LoadSpinner from '../../../reusable/loadSpinner';
import css from './tabContent.module.css';
import { RoleControlSection } from '../../../reusable/roleControlSection/roleControlSection';
import { Navigate, useParams } from 'react-router-dom';
import { Button, message } from 'antd';
import { trpc } from './../../../../utils/trpc';

export const AdminTabContent: FunctionComponent = () => {
    const { studyId } = useParams();
    const [deleteButtonShown, setDeleteButtonShown] = useState(false);
    const getStudy = trpc.study.getStudies.useQuery({ studyId });
    const deleteStudy = trpc.study.deleteStudy.useMutation({
        onSuccess: () => {
            void message.success('Study deleted successfully');
        },
        onError: () => {
            void message.error('Failed to delete study');
        }
    });

    if (getStudy.isLoading) {
        return <LoadSpinner />;
    }

    if (getStudy.isError) {
        return <p>An error occured</p>;
    }

    if (!getStudy.data[0]) {
        return null;
    }

    return (
        <div className={`${css.tab_page_wrapper_grid} fade_in`}>
            <div className={`${css.tab_page_wrapper} ${css.cover_page}`}>
                <RoleControlSection studyId={getStudy.data[0].id} />
                <br />
                <br />
                <Subsection title='Dataset Deletion'>
                    <p>Be careful to check all related projects and files before deleting this dataset!</p>
                    {(() => {
                        if (!deleteStudy.isLoading && !deleteStudy.isError && deleteStudy.data) {
                            return <Navigate to={'/datasets'} />;
                        }
                        return !deleteButtonShown ? <Button onClick={() => setDeleteButtonShown(true)}>Delete the dataset</Button> :
                            <>
                                <Button danger type='primary' onClick={() => { deleteStudy.mutate({ studyId: getStudy.data[0].id }); }}>Delete&nbsp;<i>{getStudy.data[0].name}</i></Button>
                                <Button onClick={() => { setDeleteButtonShown(false); }} style={{ cursor: 'pointer' }}> Cancel </Button>
                            </>;
                    })()}
                </Subsection>

            </div>
        </div>
    );
};
