import * as React from 'react';
import { DatasetList } from './datasetList';
import * as css from './datasetPage.module.css';

export const DatasetListPage: React.FunctionComponent = (props) => {
    return (
        <div className={css.page_container}>
            <div className={css.project_list + ' page_section'}>
                <div className="page_ariane">DATASETS</div>
                <div className="page_content">
                    <DatasetList/>
                </div>
            </div>
        </div>
    );
};
