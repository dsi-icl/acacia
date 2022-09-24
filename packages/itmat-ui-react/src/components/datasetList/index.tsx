import { FunctionComponent } from 'react';
import { DatasetList } from './datasetList';
import css from './datasetPage.module.css';
import { AddNewDataSet } from './addNewDataSet';

export const DatasetListPage: FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <div className={css.project_list + ' page_section'}>
                <div className='page_ariane'>Datasets</div>
                <div className='page_content'>
                    <DatasetList />
                    <AddNewDataSet />
                </div>
            </div>
            <div className={'page_section additional_panel'}>
                <div className='page_ariane '></div>
                <div className='page_content'>
                    Select a dataset on the left hand side to open it.
                </div>
            </div>
        </div>
    );
};
