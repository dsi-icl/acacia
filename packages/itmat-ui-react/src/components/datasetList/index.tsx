import * as React from 'react';
import { DatasetList } from './datasetList';
import * as css from './datasetPage.module.css';
import { useMutation } from 'react-apollo';
import { GQLRequests } from 'itmat-commons';
import { AddNewDataSet } from './addNewDataSet';

export const DatasetListPage: React.FunctionComponent = (props) => {
    const [createStudy, { error, data, loading }] = useMutation(GQLRequests.CREATE_STUDY);

    return (
        <div className={css.page_container}>
            <div className={css.project_list + ' page_section'}>
                <div className='page_ariane'>DATASETS</div>
                <div className='page_content'>
                    <AddNewDataSet/>
                    <DatasetList />
                </div>
            </div>
        </div>
    );
};
