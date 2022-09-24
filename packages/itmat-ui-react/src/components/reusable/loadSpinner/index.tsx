import { FunctionComponent } from 'react';
import css from './loadSpinner.module.css';

type LoadSpinnerProps = {
    cover?: boolean;
}

const LoadSpinner: FunctionComponent<LoadSpinnerProps> = ({ cover = true }) => {
    return (
        <div className={cover ? css.cover : undefined}>
            <div className={css.loader}>
                <svg viewBox='0 0 86 80'>
                    <polygon points='43 8 79 72 7 72'></polygon>
                </svg>
            </div>
        </div>
    );
};

export default LoadSpinner;
