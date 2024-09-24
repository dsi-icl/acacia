import { FunctionComponent } from 'react';
import { MyFile } from '../drive/file';
import css from './drive.module.css';

export const DrivePage: FunctionComponent = () => {
    return (
        <div className={css.page_container}>
            <MyFile />
        </div>
    );
};
