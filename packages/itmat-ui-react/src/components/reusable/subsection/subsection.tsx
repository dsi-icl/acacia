import { FunctionComponent } from 'react';
import css from './subsection.module.css';

export const Subsection: FunctionComponent<{ title; children }> = ({ title, children }) => {
    return <div className={css.content_section}>
        <h5>{title}</h5>
        <div>
            {children}
        </div>
    </div>;
};

export const SubsectionWithComment: FunctionComponent<{ title; comment; children; float?}> = ({ title, comment, children, float }) => {
    return <div className={css.content_section}>
        <h5>{title} <span style={{ float: float ? float : 'right', whiteSpace: 'pre' }}>{comment}</span></h5>
        <div>
            {children}
        </div>
    </div>;
};
