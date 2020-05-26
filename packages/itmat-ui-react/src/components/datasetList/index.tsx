import * as React from 'react';
import { DatasetList } from './datasetList';
import css from './datasetPage.module.css';
import { AddNewDataSet } from './addNewDataSet';

export const DatasetListPage: React.FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <div className={css.project_list + ' page_section'}>
                <div className='page_ariane'>DATASETS</div>
                <div className='page_content'>
                    <AddNewDataSet/>
                    <DatasetList />
                </div>
            </div>
            <div></div>
        </div>
    );
};
