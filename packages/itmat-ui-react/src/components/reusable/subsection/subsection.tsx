import { FunctionComponent } from 'react';
import css from './subsection.module.css';

export const Subsection: FunctionComponent<{ title: any; children: any }> = ({ title, children }) => {
    return <div className={css.content_section}>
        <h5>{title}</h5>
        <div>
            {children}
        </div>
    </div>;
};

export const SubsectionWithComment: FunctionComponent<{ title: any; comment: any; children: any; float?: any }> = ({ title, comment, children, float }) => {
    return <div className={css.content_section}>
        <h5>{title} <span style={{ float: float ? float : 'right', whiteSpace: 'pre' }}>{comment}</span></h5>
        <div>
            {children}
        </div>
    </div>;
};
